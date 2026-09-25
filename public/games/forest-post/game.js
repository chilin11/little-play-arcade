export const LEVELS = Object.freeze([
  Object.freeze({ name:'蒲公英小径', size:5, note:'两位朋友住得不远，先试试短短的小路。', routes:Object.freeze([
    Object.freeze({id:'sun',animal:'🐰',name:'小兔',color:'#e2b955',solution:Object.freeze([0,1,2,7,12])}),
    Object.freeze({id:'berry',animal:'🦊',name:'小狐',color:'#db8588',solution:Object.freeze([20,15,16,17,18,19,14,9,4])})
  ]), rocks:Object.freeze([6,8,11,13,21,23]) }),
  Object.freeze({ name:'莓果转弯处', size:5, note:'三封信出发啦，记得给每条小路留一点位置。', routes:Object.freeze([
    Object.freeze({id:'blue',animal:'🐱',name:'小猫',color:'#73a9bd',solution:Object.freeze([4,3,2,7,12,17,22])}),
    Object.freeze({id:'sun',animal:'🐻',name:'小熊',color:'#e2b955',solution:Object.freeze([20,15,10,5,0])}),
    Object.freeze({id:'berry',animal:'🐰',name:'小兔',color:'#db8588',solution:Object.freeze([24,19,14,9,8,13,18,23])})
  ]), rocks:Object.freeze([1,6,11,16,21]) }),
  Object.freeze({ name:'萤火虫草地', size:6, note:'石头变多了，绕一绕，也许会找到更温柔的路。', routes:Object.freeze([
    Object.freeze({id:'sun',animal:'🐰',name:'小兔',color:'#e2b955',solution:Object.freeze([0,1,2,8,14,20])}),
    Object.freeze({id:'berry',animal:'🦊',name:'小狐',color:'#db8588',solution:Object.freeze([30,24,25,26,27,21,15,9,3])}),
    Object.freeze({id:'purple',animal:'🦉',name:'小鸮',color:'#9b86ba',solution:Object.freeze([35,34,33,32,31])})
  ]), rocks:Object.freeze([4,5,10,11,16,17,22,23,28,29]) }),
  Object.freeze({ name:'四叶草广场', size:6, note:'四位朋友一起送信。先走外面，再看看中间。', routes:Object.freeze([
    Object.freeze({id:'sun',animal:'🐰',name:'小兔',color:'#e2b955',solution:Object.freeze([0,1,7,13,19])}),
    Object.freeze({id:'berry',animal:'🦊',name:'小狐',color:'#db8588',solution:Object.freeze([5,4,10,16,22])}),
    Object.freeze({id:'blue',animal:'🐱',name:'小猫',color:'#73a9bd',solution:Object.freeze([30,31,25,26,27])}),
    Object.freeze({id:'purple',animal:'🦉',name:'小鸮',color:'#9b86ba',solution:Object.freeze([35,34,28,29,23])})
  ]), rocks:Object.freeze([2,3,8,9,14,15,20,21,24,32,33]) }),
  Object.freeze({ name:'蘑菇桥', size:6, note:'小路长长的，转弯时慢一点，不要碰到别人的路。', routes:Object.freeze([
    Object.freeze({id:'sun',animal:'🐰',name:'小兔',color:'#e2b955',solution:Object.freeze([0,1,2,8,14,20,26,32])}),
    Object.freeze({id:'berry',animal:'🦊',name:'小狐',color:'#db8588',solution:Object.freeze([5,4,3,9,15,21,27,33])}),
    Object.freeze({id:'blue',animal:'🐱',name:'小猫',color:'#73a9bd',solution:Object.freeze([30,24,25,19,13,7])}),
    Object.freeze({id:'purple',animal:'🦉',name:'小鸮',color:'#9b86ba',solution:Object.freeze([35,29,28,22,16,10])})
  ]), rocks:Object.freeze([6,11,12,17,18,23,31,34]) }),
  Object.freeze({ name:'月光大森林', size:7, note:'最后一片森林很宽广。别着急，每次只想下一步。', routes:Object.freeze([
    Object.freeze({id:'sun',animal:'🐰',name:'小兔',color:'#e2b955',solution:Object.freeze([0,1,2,3,10,17,24])}),
    Object.freeze({id:'berry',animal:'🦊',name:'小狐',color:'#db8588',solution:Object.freeze([6,5,4,11,18,25])}),
    Object.freeze({id:'blue',animal:'🐱',name:'小猫',color:'#73a9bd',solution:Object.freeze([42,35,36,37,38,31,30,29,28])}),
    Object.freeze({id:'purple',animal:'🦉',name:'小鸮',color:'#9b86ba',solution:Object.freeze([48,41,40,39,32,33,34,27,20,13])})
  ]), rocks:Object.freeze([7,8,9,12,14,15,16,19,21,22,23,26,43,44,45,46,47]) })
]);

const adjacent = (a,b,size) => Math.abs(Math.floor(a/size)-Math.floor(b/size)) + Math.abs(a%size-b%size) === 1;
export class ForestPost {
  constructor(level=0){this.load(level)}
  load(level){
    this.level=Math.max(0,Math.min(LEVELS.length-1,level));this.config=LEVELS[this.level];this.active=null;this.lastActive=null;
    this.paths=Object.fromEntries(this.config.routes.map(route=>[route.id,[route.solution[0]]]));
  }
  route(id){return this.config.routes.find(route=>route.id===id)}
  ownerAt(cell){for(const route of this.config.routes)if(this.paths[route.id].includes(cell))return route.id;return null}
  endpointAt(cell){for(const route of this.config.routes){if(route.solution[0]===cell)return{route,type:'start'};if(route.solution.at(-1)===cell)return{route,type:'home'}}return null}
  isComplete(id){const route=this.route(id),path=this.paths[id];return path.at(-1)===route.solution.at(-1)}
  get complete(){return this.config.routes.every(route=>this.isComplete(route.id))}
  select(id){
    const route=this.route(id);if(!route)return false;this.active=id;this.lastActive=id;
    if(this.isComplete(id))this.paths[id]=[route.solution[0]];
    return true;
  }
  step(cell){
    if(!this.active)return{ok:false,reason:'select'};
    const route=this.route(this.active),path=this.paths[this.active],start=route.solution[0],home=route.solution.at(-1),last=path.at(-1);
    if(cell===start){this.paths[this.active]=[start];return{ok:true,reset:true}}
    const prior=path.indexOf(cell);
    if(prior>=0){if(prior===path.length-1)return{ok:false,reason:'same'};this.paths[this.active]=path.slice(0,prior+1);return{ok:true,back:true}}
    if(!adjacent(last,cell,this.config.size))return{ok:false,reason:'far'};
    if(this.config.rocks.includes(cell))return{ok:false,reason:'rock'};
    const endpoint=this.endpointAt(cell);
    if(endpoint&&!(endpoint.type==='home'&&endpoint.route.id===this.active))return{ok:false,reason:'endpoint'};
    const owner=this.ownerAt(cell);if(owner&&owner!==this.active)return{ok:false,reason:'route'};
    if(this.isComplete(this.active))return{ok:false,reason:'done'};
    path.push(cell);this.lastActive=this.active;
    return{ok:true,delivered:cell===home,complete:this.complete};
  }
  resetRoute(id=this.active||this.lastActive){if(!id||!this.route(id))return false;this.paths[id]=[this.route(id).solution[0]];this.active=id;this.lastActive=id;return true}
  hint(){
    const route=this.config.routes.find(item=>item.id===this.active&&!this.isComplete(item.id))||this.config.routes.find(item=>!this.isComplete(item.id));
    if(!route)return null;this.active=route.id;this.lastActive=route.id;
    const path=this.paths[route.id],prefix=path.every((cell,index)=>route.solution[index]===cell);
    return{route,cell:prefix?(route.solution[path.length]??route.solution.at(-1)):route.solution[0],restart:!prefix};
  }
}

function mountGame(){
  const $=id=>document.getElementById(id),board=$('board'),dialog=$('win-dialog');let level=0,game,buttons=[],hintCell=null,hintTimer=null,pointer=null,unlocked=0,storageAvailable=true;
  try{const value=Number(localStorage.getItem('forest-post.unlocked.v1'));if(Number.isInteger(value))unlocked=Math.max(0,Math.min(LEVELS.length-1,value))}catch{storageAvailable=false}
  const routeFor=id=>game.config.routes.find(route=>route.id===id);
  function announce(title,detail,icon='✧',state='playing'){$('status-title').textContent=title;$('status-detail').textContent=detail;$('status-icon').textContent=icon;$('status').dataset.state=state}
  function linksFor(path,index,size){const links=[];for(const neighbor of [path[index-1],path[index+1]]){if(neighbor===undefined)continue;const delta=neighbor-path[index];if(delta===-size)links.push('up');else if(delta===size)links.push('down');else if(delta===-1)links.push('left');else if(delta===1)links.push('right')}return links}
  function build(){
    buttons=[];board.replaceChildren();board.style.gridTemplateColumns=`repeat(${game.config.size},minmax(0,1fr))`;board.style.gridTemplateRows=`repeat(${game.config.size},minmax(0,1fr))`;board.setAttribute('aria-rowcount',String(game.config.size));board.setAttribute('aria-colcount',String(game.config.size));
    for(let cell=0;cell<game.config.size**2;cell++){
      const button=document.createElement('button');button.type='button';button.className='cell grass';button.dataset.cell=String(cell);button.setAttribute('role','gridcell');button.setAttribute('aria-rowindex',String(Math.floor(cell/game.config.size)+1));button.setAttribute('aria-colindex',String(cell%game.config.size+1));button.tabIndex=cell===0?0:-1;
      button.addEventListener('click',event=>{if(event.detail===0)activate(cell)});button.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();pointer=event.pointerId;activate(cell);board.setPointerCapture?.(event.pointerId)});
      button.addEventListener('keydown',event=>{const directions={ArrowUp:-game.config.size,ArrowDown:game.config.size,ArrowLeft:-1,ArrowRight:1};if(!(event.key in directions))return;event.preventDefault();const next=cell+directions[event.key];if(next>=0&&next<buttons.length&&adjacent(cell,next,game.config.size))buttons[next].focus()});
      button.addEventListener('focus',()=>buttons.forEach(item=>item.tabIndex=item===button?0:-1));board.append(button);buttons.push(button);
    }
  }
  board.addEventListener('pointermove',event=>{if(pointer!==event.pointerId)return;const element=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-cell]');if(element&&board.contains(element))extend(Number(element.dataset.cell))});
  for(const type of ['pointerup','pointercancel'])board.addEventListener(type,event=>{if(event.pointerId===pointer){pointer=null;try{board.releasePointerCapture(event.pointerId)}catch{}}});
  function activate(cell){
    const endpoint=game.endpointAt(cell),owner=game.ownerAt(cell);
    if(endpoint?.type==='start'){game.select(endpoint.route.id);announce(`${endpoint.route.name}准备出发`,`沿着上下左右相邻的草地，找到门牌上有${endpoint.route.animal}的小屋。`,endpoint.route.animal);render();return}
    if(owner){game.active=owner;game.lastActive=owner;const path=game.paths[owner],position=path.indexOf(cell);if(position<path.length-1)game.paths[owner]=path.slice(0,position+1);announce(`继续画${routeFor(owner).name}的小路`,'往回走可以擦掉刚才经过的格子。',routeFor(owner).animal);render();return}
    extend(cell);
  }
  function extend(cell){
    const result=game.step(cell);if(!result.ok){if(['rock','route','endpoint'].includes(result.reason))announce('这边过不去','小路不能穿过石头、屋子或另一条小路。换一格试试。','❧');return}
    hintCell=null;clearTimeout(hintTimer);
    if(result.complete){finish();return}if(result.delivered){const route=routeFor(game.active);announce(`${route.name}送到啦！`,'太棒了！再选一位小邮差，继续送信。','💌','done')}else announce('小路正在长长','继续走到门牌上有它头像的小屋；走回刚才的格子可以擦掉一段。','❧');render();
  }
  function finish(){
    unlocked=Math.max(unlocked,Math.min(LEVELS.length-1,level+1));try{localStorage.setItem('forest-post.unlocked.v1',String(unlocked))}catch{storageAvailable=false}
    announce('全部送到啦！','每一位朋友都收到信了。你为森林铺好了路！','✿','done');render();
    $('win-message').textContent=level===LEVELS.length-1?'六片森林都亮起了小灯。你是最棒的森林邮差！':'小动物们收到信，森林里开出了一朵小花。';$('next-level').textContent=level===LEVELS.length-1?'从第一片森林再出发 ↻':'去下一片森林 →';dialog.showModal();
  }
  function render(){
    const occupied=new Map();for(const route of game.config.routes)game.paths[route.id].forEach((cell,index)=>occupied.set(cell,{route,index,path:game.paths[route.id]}));
    buttons.forEach((button,cell)=>{
      const endpoint=game.endpointAt(cell),entry=occupied.get(cell),rock=game.config.rocks.includes(cell);button.className=`cell ${rock?'rock':'grass'}${endpoint?` ${endpoint.type}`:''}${game.active&&entry?.route.id===game.active?' active-mail':''}${cell===hintCell?' hint-cell':''}`;button.replaceChildren();button.style.removeProperty('--route');
      if(rock){button.textContent='●';button.setAttribute('aria-label','大石头，不能经过');button.setAttribute('aria-disabled','true');return}
      const route=endpoint?.route||entry?.route;if(route)button.style.setProperty('--route',route.color);
      if(entry){const layer=document.createElement('span');layer.className='route-layer';const core=document.createElement('i');core.className='route-core';layer.append(core);for(const direction of linksFor(entry.path,entry.index,game.config.size)){const link=document.createElement('i');link.className=`route-link ${direction}`;layer.append(link)}button.append(layer)}
      if(endpoint?.type==='home'){const ring=document.createElement('i');ring.className='home-roof';button.append(ring)}
      if(endpoint){const face=document.createElement('span');face.className='endpoint';if(endpoint.type==='start')face.textContent=endpoint.route.animal;else{face.classList.add('house-endpoint');const house=document.createElement('span');house.className='house-picture';house.textContent='🏡';const sign=document.createElement('span');sign.className='house-sign';sign.textContent=endpoint.route.animal;face.append(house,sign)}face.setAttribute('aria-hidden','true');button.append(face)}
      const label=endpoint?.type==='start'?`${endpoint.route.name}，点这里开始画路`:endpoint?.type==='home'?`门牌上有${endpoint.route.animal}的${endpoint.route.name}小屋`:entry?`${entry.route.name}的小路`:'空草地';button.setAttribute('aria-label',label);button.setAttribute('aria-disabled','false');
    });
    $('level-name').textContent=game.config.name;const remaining=game.config.routes.filter(route=>!game.isComplete(route.id)).length;$('route-status').textContent=remaining?`${['','一','两','三','四'][remaining]||remaining}封信等着出发`:'全部送达';$('little-message').textContent=game.complete?'森林的灯都亮起来啦':game.active?`${routeFor(game.active).name}正在送信`:'先点一下小动物吧';
    $('undo').disabled=!(game.active||game.lastActive);$('save-note').textContent=storageAvailable?'走过的关卡会在这台设备上留下小树叶。':'浏览器没有保存小树叶，但所有关卡仍然可以玩。';
    const mail=$('mail-list');mail.replaceChildren(...game.config.routes.map(route=>{const item=document.createElement('div');item.className=`mail-item${game.active===route.id?' active':''}${game.isComplete(route.id)?' done':''}`;item.style.setProperty('--route',route.color);const face=document.createElement('span');face.textContent=route.animal;const text=document.createElement('small');text.textContent=game.isComplete(route.id)?'送到啦':'等出发';item.append(face,text);return item}));
    const progress=$('progress');progress.replaceChildren(...LEVELS.map((item,index)=>{const button=document.createElement('button');button.type='button';button.className=`${index<unlocked?'done ':''}${index===level?'current ':''}${index<=unlocked?'unlocked':''}`;button.disabled=index>unlocked;button.setAttribute('aria-label',`${item.name}${index===level?'，当前关卡':index<=unlocked?'，可以游玩':'，还未解锁'}`);button.textContent=index<=unlocked?'✓':'';button.addEventListener('click',()=>{if(index<=unlocked&&index!==level)load(index)});return button}));
  }
  $('hint').addEventListener('click',()=>{const hint=game.hint();if(!hint)return;if(hint.restart){game.resetRoute(hint.route.id);hintCell=hint.route.solution[1];announce('先回到起点吧',`${hint.route.name}的小路已经轻轻擦掉，试试走向亮起来的草地。`,hint.route.animal)}else{hintCell=hint.cell;announce('这里亮起来了','试试走向亮起来的草地。',hint.route.animal)}render();clearTimeout(hintTimer);hintTimer=setTimeout(()=>{hintCell=null;render()},2600)});
  $('undo').addEventListener('click',()=>{if(game.resetRoute()){const route=routeFor(game.active);announce(`${route.name}回到起点`,'没关系，换一条路再试一次。',route.animal);render()}});$('restart').addEventListener('click',()=>load(level));$('replay').addEventListener('click',()=>{dialog.close();load(level)});$('next-level').addEventListener('click',()=>{dialog.close();load(level===LEVELS.length-1?0:level+1)});
  function load(index){level=index;game=new ForestPost(index);hintCell=null;clearTimeout(hintTimer);build();announce('选一位小邮差',game.config.note);render()}
  load(level);
}
if(typeof document!=='undefined'&&document.getElementById('board'))mountGame();
