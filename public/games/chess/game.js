export const INITIAL_BOARD = Object.freeze([
  'br','bn','bb','bq','bk','bb','bn','br',
  'bp','bp','bp','bp','bp','bp','bp','bp',
  ...Array(32).fill(null),
  'wp','wp','wp','wp','wp','wp','wp','wp',
  'wr','wn','wb','wq','wk','wb','wn','wr'
]);
export const PIECES = Object.freeze({
  wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',
  bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'
});
const FILES = 'abcdefgh';
const opposite = color => color === 'w' ? 'b' : 'w';
const inside = (row, col) => row >= 0 && row < 8 && col >= 0 && col < 8;
const squareName = index => `${FILES[index % 8]}${8 - Math.floor(index / 8)}`;
const cloneMove = move => ({ ...move });

export function isSquareAttacked(board, target, byColor) {
  const tr = Math.floor(target / 8), tc = target % 8;
  const pawnRow = tr + (byColor === 'w' ? 1 : -1);
  for (const dc of [-1, 1]) if (inside(pawnRow, tc + dc) && board[pawnRow * 8 + tc + dc] === `${byColor}p`) return true;
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const r = tr + dr, c = tc + dc;
    if (inside(r,c) && board[r * 8 + c] === `${byColor}n`) return true;
  }
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
    let r = tr + dr, c = tc + dc;
    while (inside(r,c)) {
      const piece = board[r * 8 + c];
      if (piece) { if (piece[0] === byColor && (piece[1] === 'b' || piece[1] === 'q')) return true; break; }
      r += dr; c += dc;
    }
  }
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
    let r = tr + dr, c = tc + dc;
    while (inside(r,c)) {
      const piece = board[r * 8 + c];
      if (piece) { if (piece[0] === byColor && (piece[1] === 'r' || piece[1] === 'q')) return true; break; }
      r += dr; c += dc;
    }
  }
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const r = tr + dr, c = tc + dc;
    if (inside(r,c) && board[r * 8 + c] === `${byColor}k`) return true;
  }
  return false;
}

export class ChessGame {
  constructor(setup = null) {
    this.board = setup?.board ? [...setup.board] : [...INITIAL_BOARD];
    this.turn = setup?.turn === 'b' ? 'b' : 'w';
    this.castling = { wK:true,wQ:true,bK:true,bQ:true, ...(setup?.castling || {}) };
    this.enPassant = Number.isInteger(setup?.enPassant) ? setup.enPassant : null;
    this.halfmove = Number.isInteger(setup?.halfmove) ? setup.halfmove : 0;
    this.fullmove = Number.isInteger(setup?.fullmove) ? setup.fullmove : 1;
    this.lastMove = null;
    this.moveLog = [];
    this.captured = { w:[], b:[] };
    this.history = [];
    this.repetitions = new Map([[this.positionKey(), 1]]);
    this.result = this.getResult();
  }

  positionKey() {
    return `${this.board.map(piece => piece || '..').join('')}/${this.turn}/${Object.entries(this.castling).filter(([,value]) => value).map(([key]) => key).join('') || '-'}/${this.enPassant ?? '-'}`;
  }

  kingSquare(color, board = this.board) { return board.indexOf(`${color}k`); }
  inCheck(color = this.turn, board = this.board) {
    const king = this.kingSquare(color, board);
    return king < 0 || isSquareAttacked(board, king, opposite(color));
  }

  pseudoMoves(from) {
    const piece = this.board[from];
    if (!piece) return [];
    const color = piece[0], type = piece[1], enemy = opposite(color);
    const row = Math.floor(from / 8), col = from % 8, moves = [];
    const add = (to, extra = {}) => {
      const target = this.board[to];
      if (!target) moves.push({ from, to, ...extra });
      else if (target[0] === enemy && target[1] !== 'k') moves.push({ from, to, capture: target, ...extra });
    };
    const slide = directions => {
      for (const [dr, dc] of directions) {
        let r = row + dr, c = col + dc;
        while (inside(r,c)) {
          const to = r * 8 + c, target = this.board[to];
          if (!target) moves.push({ from, to });
          else { if (target[0] === enemy && target[1] !== 'k') moves.push({ from, to, capture: target }); break; }
          r += dr; c += dc;
        }
      }
    };
    if (type === 'p') {
      const direction = color === 'w' ? -1 : 1, start = color === 'w' ? 6 : 1, promotionRow = color === 'w' ? 0 : 7;
      const oneRow = row + direction;
      if (inside(oneRow,col) && !this.board[oneRow * 8 + col]) {
        const to = oneRow * 8 + col;
        if (oneRow === promotionRow) for (const promotion of ['q','r','b','n']) moves.push({ from, to, promotion });
        else moves.push({ from, to });
        const two = (row + direction * 2) * 8 + col;
        if (row === start && !this.board[two]) moves.push({ from, to: two, doublePawn: true });
      }
      for (const dc of [-1,1]) {
        const r = row + direction, c = col + dc;
        if (!inside(r,c)) continue;
        const to = r * 8 + c, target = this.board[to];
        if (target && target[0] === enemy && target[1] !== 'k') {
          if (r === promotionRow) for (const promotion of ['q','r','b','n']) moves.push({ from, to, capture: target, promotion });
          else moves.push({ from, to, capture: target });
        } else if (to === this.enPassant && this.board[row * 8 + c] === `${enemy}p`) {
          moves.push({ from, to, capture: `${enemy}p`, enPassant: true });
        }
      }
    } else if (type === 'n') {
      for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
        const r = row + dr, c = col + dc; if (inside(r,c)) add(r * 8 + c);
      }
    } else if (type === 'b') slide([[-1,-1],[-1,1],[1,-1],[1,1]]);
    else if (type === 'r') slide([[-1,0],[1,0],[0,-1],[0,1]]);
    else if (type === 'q') slide([[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]);
    else if (type === 'k') {
      for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++) if (dr||dc) { const r=row+dr,c=col+dc;if(inside(r,c)) add(r*8+c); }
      const home = color === 'w' ? 60 : 4, rookKing = color === 'w' ? 63 : 7, rookQueen = color === 'w' ? 56 : 0;
      if (from === home && !this.inCheck(color)) {
        if (this.castling[`${color}K`] && this.board[rookKing] === `${color}r` && !this.board[home+1] && !this.board[home+2]
          && !isSquareAttacked(this.board,home+1,enemy) && !isSquareAttacked(this.board,home+2,enemy)) moves.push({from,to:home+2,castle:'K'});
        if (this.castling[`${color}Q`] && this.board[rookQueen] === `${color}r` && !this.board[home-1] && !this.board[home-2] && !this.board[home-3]
          && !isSquareAttacked(this.board,home-1,enemy) && !isSquareAttacked(this.board,home-2,enemy)) moves.push({from,to:home-2,castle:'Q'});
      }
    }
    return moves;
  }

  boardAfter(move) {
    const board = [...this.board], piece = board[move.from];
    board[move.from] = null;
    if (move.enPassant) board[move.to + (piece[0] === 'w' ? 8 : -8)] = null;
    board[move.to] = move.promotion ? `${piece[0]}${move.promotion}` : piece;
    if (move.castle === 'K') { board[move.to - 1] = board[move.to + 1]; board[move.to + 1] = null; }
    if (move.castle === 'Q') { board[move.to + 1] = board[move.to - 2]; board[move.to - 2] = null; }
    return board;
  }

  legalMoves(from = null) {
    const sources = from === null ? this.board.map((_,index)=>index) : [from], moves = [];
    for (const source of sources) {
      const piece = this.board[source];
      if (!piece || piece[0] !== this.turn) continue;
      for (const move of this.pseudoMoves(source)) if (!this.inCheck(this.turn, this.boardAfter(move))) moves.push(move);
    }
    return moves;
  }

  snapshot() {
    return { board:[...this.board],turn:this.turn,castling:{...this.castling},enPassant:this.enPassant,halfmove:this.halfmove,fullmove:this.fullmove,lastMove:this.lastMove&&cloneMove(this.lastMove),moveLog:[...this.moveLog],captured:{w:[...this.captured.w],b:[...this.captured.b]},repetitions:[...this.repetitions] };
  }

  move(from, to, promotion = null) {
    const legal = this.legalMoves(from).filter(move => move.to === to && (promotion ? move.promotion === promotion : !move.promotion));
    if (legal.length !== 1) return false;
    const move = legal[0], piece = this.board[from], color = piece[0];
    this.history.push(this.snapshot());
    if (move.capture) this.captured[color].push(move.capture);
    this.board = this.boardAfter(move);
    if (piece[1] === 'k') { this.castling[`${color}K`] = false; this.castling[`${color}Q`] = false; }
    if (from === 63 || to === 63) this.castling.wK = false;
    if (from === 56 || to === 56) this.castling.wQ = false;
    if (from === 7 || to === 7) this.castling.bK = false;
    if (from === 0 || to === 0) this.castling.bQ = false;
    this.enPassant = move.doublePawn ? (from + to) / 2 : null;
    this.halfmove = piece[1] === 'p' || move.capture ? 0 : this.halfmove + 1;
    const notation = move.castle === 'K' ? 'O-O' : move.castle === 'Q' ? 'O-O-O' : `${piece[1] === 'p' ? '' : piece[1].toUpperCase()}${squareName(from)}${move.capture ? '×' : '–'}${squareName(to)}${move.promotion ? `=${move.promotion.toUpperCase()}` : ''}`;
    this.lastMove = { ...move, piece, notation };
    this.moveLog.push(notation);
    if (color === 'b') this.fullmove++;
    this.turn = opposite(color);
    const key = this.positionKey();
    this.repetitions.set(key, (this.repetitions.get(key) || 0) + 1);
    this.result = this.getResult();
    if (this.result.check && !this.result.finished) this.lastMove.notation += '+';
    if (this.result.type === 'checkmate') this.lastMove.notation = this.lastMove.notation.replace(/\+$/,'') + '#';
    this.moveLog[this.moveLog.length - 1] = this.lastMove.notation;
    return true;
  }

  undo() {
    const state = this.history.pop();
    if (!state) return false;
    Object.assign(this, { board:state.board,turn:state.turn,castling:state.castling,enPassant:state.enPassant,halfmove:state.halfmove,fullmove:state.fullmove,lastMove:state.lastMove,moveLog:state.moveLog,captured:state.captured,repetitions:new Map(state.repetitions) });
    this.result = this.getResult();
    return true;
  }

  insufficientMaterial() {
    const pieces = this.board.map((piece,index)=>({piece,index})).filter(({piece})=>piece && piece[1] !== 'k');
    if (!pieces.length) return true;
    if (pieces.length === 1 && ['b','n'].includes(pieces[0].piece[1])) return true;
    if (pieces.every(({piece}) => piece[1] === 'b')) {
      const colors = new Set(pieces.map(({index}) => (Math.floor(index/8) + index%8) % 2));
      return colors.size === 1;
    }
    return false;
  }

  getResult() {
    const check = this.inCheck(this.turn), moves = this.legalMoves();
    if (!moves.length) return check ? {finished:true,type:'checkmate',check,winner:opposite(this.turn)} : {finished:true,type:'stalemate',check:false,winner:null};
    if (this.insufficientMaterial()) return {finished:true,type:'insufficient',check,winner:null};
    if (this.halfmove >= 100) return {finished:true,type:'fifty',check,winner:null};
    if ((this.repetitions.get(this.positionKey()) || 0) >= 3) return {finished:true,type:'repetition',check,winner:null};
    return {finished:false,type:check?'check':'playing',check,winner:null};
  }
}

function mountGame(){
  const $=id=>document.getElementById(id),boardElement=$('board'),promotionDialog=$('promotion-dialog');
  let game=new ChessGame(),selected=null,choices=[],flipped=false,focusSquare=60,buttons=new Map(),pendingPromotion=null;
  const colorName=color=>color==='w'?'白方':'黑方';
  function displayOrder(){return Array.from({length:64},(_,i)=>flipped?63-i:i)}
  function buildBoard(){
    buttons=new Map();boardElement.replaceChildren();
    const order=displayOrder();
    order.forEach((square,displayIndex)=>{
      const row=Math.floor(square/8),col=square%8,button=document.createElement('button');
      button.type='button';button.className='square';button.dataset.square=String(square);button.setAttribute('role','gridcell');
      button.tabIndex=square===focusSquare?0:-1;
      button.addEventListener('focus',()=>{focusSquare=square;for(const b of buttons.values())b.tabIndex=-1;button.tabIndex=0});
      button.addEventListener('click',()=>activate(square));
      button.addEventListener('keydown',event=>{
        const directions={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
        if(!directions[event.key])return;event.preventDefault();
        const position=order.indexOf(square),r=Math.floor(position/8),c=position%8,[dr,dc]=directions[event.key],nr=Math.max(0,Math.min(7,r+dr)),nc=Math.max(0,Math.min(7,c+dc));
        buttons.get(order[nr*8+nc]).focus();
      });
      const displayRow=Math.floor(displayIndex/8),displayCol=displayIndex%8;
      if(displayCol===0){const rank=document.createElement('span');rank.className='coordinate rank';rank.textContent=String(8-row);button.append(rank)}
      if(displayRow===7){const file=document.createElement('span');file.className='coordinate file';file.textContent=FILES[col];button.append(file)}
      boardElement.append(button);buttons.set(square,button);
    });
    boardElement.setAttribute('aria-label',`国际象棋棋盘，${flipped?'黑方':'白方'}在下`);
  }
  function activate(square){
    if(game.result.finished)return;
    const piece=game.board[square];
    if(selected!==null){
      const matching=choices.filter(move=>move.to===square);
      if(matching.length){
        if(matching.some(move=>move.promotion)){pendingPromotion={from:selected,to:square};const color=game.turn;promotionDialog.querySelectorAll('[data-promotion]').forEach(button=>button.textContent=PIECES[`${color}${button.dataset.promotion}`]);promotionDialog.showModal();return}
        play(selected,square);return;
      }
    }
    if(piece&&piece[0]===game.turn){selected=square;choices=game.legalMoves(square)}else{selected=null;choices=[]}
    render();
  }
  function play(from,to,promotion=null){if(!game.move(from,to,promotion))return;selected=null;choices=[];focusSquare=to;render()}
  function resultText(){
    const result=game.result;
    if(result.type==='checkmate')return [`将死，${colorName(result.winner)}获胜！`,'国王无处可走，也无法解除将军。好棋！','✧'];
    if(result.type==='stalemate')return ['无子可走，本局和棋','当前一方没有合法走法，但国王没有被将军。','◎'];
    if(result.type==='insufficient')return ['子力不足，本局和棋','棋盘上已经没有可能完成将死的子力。','◎'];
    if(result.type==='repetition')return ['局面三次重复，本局和棋','相同局面第三次出现，歇一会儿吧。','◎'];
    if(result.type==='fifty')return ['五十回合规则，本局和棋','连续五十回合没有兵移动或吃子。','◎'];
    if(result.check)return [`${colorName(game.turn)}被将军`,'必须保护国王：移动国王、挡住攻击，或吃掉进攻棋子。','!'];
    return [`轮到${colorName(game.turn)}`,'选择一枚棋子，绿色标记就是可以到达的位置。','✦'];
  }
  function render(){
    if(!buttons.size)buildBoard();
    const targets=new Map();for(const move of choices)targets.set(move.to,move);
    const checkSquare=game.result.check?game.kingSquare(game.turn):-1;
    for(const [square,button] of buttons){
      const row=Math.floor(square/8),col=square%8,piece=game.board[square],target=targets.get(square);
      button.className=`square ${(row+col)%2?'dark-square':'light-square'}${square===selected?' selected':''}${game.lastMove&&(square===game.lastMove.from||square===game.lastMove.to)?' last':''}${square===checkSquare?' in-check':''}${target?' legal':''}${target?.capture?' capture':''}`;
      button.querySelectorAll('.piece,.move-dot').forEach(element=>element.remove());
      if(target){const dot=document.createElement('span');dot.className='move-dot';dot.setAttribute('aria-hidden','true');button.append(dot)}
      if(piece){const span=document.createElement('span');span.className=`piece ${piece[0]==='w'?'white':'black'}`;span.textContent=PIECES[piece];span.setAttribute('aria-hidden','true');button.append(span)}
      const pieceNames={k:'王',q:'后',r:'车',b:'象',n:'马',p:'兵'};
      button.setAttribute('aria-label',`${squareName(square)}，${piece?`${colorName(piece[0])}${pieceNames[piece[1]]}`:'空格'}${target?'，可以走到这里':''}`);
      button.setAttribute('aria-disabled',String(game.result.finished));
    }
    const [title,detail,icon]=resultText();$('status-title').textContent=title;$('status-detail').textContent=detail;$('status-icon').textContent=icon;$('status').dataset.state=game.result.finished?'finished':game.result.check?'check':'playing';
    $('game-state').textContent=game.result.finished?'对局已结束':game.result.check?'将军':'对局进行中';
    for(const color of ['w','b']){const element=$(`${color==='w'?'white':'black'}-player`),active=!game.result.finished&&game.turn===color;element.classList.toggle('active',active);element.querySelector('.turn-label').textContent=game.result.finished?'结束':active?'落子':'等待'}
    $('undo').disabled=!game.history.length;$('move-number').textContent=`第 ${game.fullmove} 回合`;$('last-move').textContent=game.lastMove?`最近：${game.lastMove.notation}`:'白方先行';
    $('white-captures').textContent=game.captured.w.length?game.captured.w.map(piece=>PIECES[piece]).join(' '):'—';$('black-captures').textContent=game.captured.b.length?game.captured.b.map(piece=>PIECES[piece]).join(' '):'—';
    const list=$('move-list');list.replaceChildren();if(!game.moveLog.length){const item=document.createElement('li');item.className='empty-history';item.textContent='第一步，等你落下。';list.append(item)}else game.moveLog.forEach(move=>{const item=document.createElement('li');item.textContent=move;list.append(item)});list.scrollTop=list.scrollHeight;
  }
  $('flip').addEventListener('click',()=>{flipped=!flipped;buildBoard();render();buttons.get(focusSquare)?.focus()});
  $('undo').addEventListener('click',()=>{if(game.undo()){selected=null;choices=[];focusSquare=game.lastMove?.to??60;render()}});
  $('restart').addEventListener('click',()=>{if(game.history.length)$('restart-dialog').showModal();else reset()});
  $('cancel-restart').addEventListener('click',()=>$('restart-dialog').close());$('confirm-restart').addEventListener('click',()=>{$('restart-dialog').close();reset()});
  promotionDialog.addEventListener('cancel',event=>event.preventDefault());promotionDialog.querySelectorAll('[data-promotion]').forEach(button=>button.addEventListener('click',()=>{const pending=pendingPromotion;pendingPromotion=null;promotionDialog.close();if(pending)play(pending.from,pending.to,button.dataset.promotion)}));
  function reset(){game=new ChessGame();selected=null;choices=[];focusSquare=60;render()}
  buildBoard();render();
}
if(typeof document!=='undefined'&&document.getElementById('board'))mountGame();
