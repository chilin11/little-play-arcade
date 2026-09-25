const CONFIG = {
  sprout: { pairs: 6, name: '蒲公英小径' },
  bloom: { pairs: 8, name: '郁金香花圃' },
  meadow: { pairs: 10, name: '彩虹草甸' }
};
const ICONS = ['🌼','🐝','🍓','🐞','🌷','🦋','🍀','🐌','🌻','🐿️'];
const $ = id => document.getElementById(id);
const board = $('board');
let difficulty = 'sprout';
let cards = [];
let open = [];
let matched = 0;
let moves = 0;
let streak = 0;
let locked = false;
let storageOK = true;
let mismatchTimer = 0;
let winTimer = 0;

function storageGet(key) { try { return localStorage.getItem(key); } catch { storageOK = false; return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { storageOK = false; } }
function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
function updateBest() {
  const best = Number(storageGet(`memory-garden-best-${difficulty}`));
  $('best').textContent = best ? `${best} 步` : '还在等你';
  if (!storageOK) $('save-note').textContent = '浏览器没有开放存储，不过花园照样可以玩。';
}
function updateStats() {
  const pairs = CONFIG[difficulty].pairs;
  $('matched-count').textContent = `${matched} / ${pairs}`;
  $('progress-text').textContent = `已找到 ${matched} / ${pairs} 对`;
  $('moves').textContent = String(moves);
  $('streak').textContent = String(streak);
}
function build() {
  clearTimeout(mismatchTimer);
  clearTimeout(winTimer);
  if ($('win-dialog').open) $('win-dialog').close();
  const config = CONFIG[difficulty];
  cards = shuffle(ICONS.slice(0, config.pairs).flatMap((icon, pair) => [{ icon, pair }, { icon, pair }]));
  open = []; matched = 0; moves = 0; streak = 0; locked = false;
  board.dataset.pairs = String(config.pairs);
  board.innerHTML = '';
  cards.forEach((card, index) => {
    const button = document.createElement('button');
    button.className = 'memory-card';
    button.dataset.index = String(index);
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', `第 ${index + 1} 张卡片，背面`);
    button.innerHTML = `<span class="card-inner"><span class="card-face card-back" aria-hidden="true"></span><span class="card-face card-front" aria-hidden="true">${card.icon}</span></span>`;
    button.addEventListener('click', () => flip(index));
    button.addEventListener('keydown', event => moveFocus(event, index));
    board.append(button);
  });
  $('round-label').textContent = config.name;
  $('message').textContent = '选两张卡片看看吧';
  updateStats(); updateBest();
}
function moveFocus(event, index) {
  const columns = 4;
  let next = index;
  if (event.key === 'ArrowRight') next = Math.min(cards.length - 1, index + 1);
  else if (event.key === 'ArrowLeft') next = Math.max(0, index - 1);
  else if (event.key === 'ArrowDown') next = Math.min(cards.length - 1, index + columns);
  else if (event.key === 'ArrowUp') next = Math.max(0, index - columns);
  else return;
  event.preventDefault(); board.children[next].focus();
}
function flip(index) {
  if (locked || open.includes(index)) return;
  const button = board.children[index];
  if (button.classList.contains('matched')) return;
  button.classList.add('flipped');
  button.setAttribute('aria-label', `第 ${index + 1} 张卡片，${cards[index].icon}`);
  open.push(index);
  if (open.length < 2) { $('message').textContent = '再找一张好朋友'; return; }
  moves += 1; updateStats();
  const [a, b] = open;
  if (cards[a].pair === cards[b].pair) {
    board.children[a].classList.add('matched'); board.children[b].classList.add('matched');
    board.children[a].setAttribute('aria-label', `${cards[a].icon}，已配对`); board.children[b].setAttribute('aria-label', `${cards[b].icon}，已配对`);
    matched += 1; streak += 1; open = [];
    $('message').textContent = `找到一对 ${cards[a].icon}，真棒！`;
    updateStats();
    if (matched === CONFIG[difficulty].pairs) finish();
  } else {
    locked = true; streak = 0; updateStats(); $('message').textContent = '它们还不是一对，再记一记位置';
    const opened = [...open];
    mismatchTimer = setTimeout(() => {
      for (const i of opened) { board.children[i]?.classList.remove('flipped'); board.children[i]?.setAttribute('aria-label', `第 ${i + 1} 张卡片，背面`); }
      open = []; locked = false;
    }, 700);
  }
}
function finish() {
  const key = `memory-garden-best-${difficulty}`;
  const previous = Number(storageGet(key));
  if (!previous || moves < previous) storageSet(key, String(moves));
  updateBest();
  $('win-copy').textContent = `你用 ${moves} 步找到了 ${matched} 对朋友。每一次翻开都很有帮助！`;
  $('next').hidden = difficulty === 'meadow';
  winTimer = setTimeout(() => $('win-dialog').showModal(), 250);
}
$('difficulty').addEventListener('change', event => { difficulty = event.target.value; build(); });
$('restart').addEventListener('click', build);
$('replay').addEventListener('click', build);
$('next').addEventListener('click', () => {
  difficulty = difficulty === 'sprout' ? 'bloom' : 'meadow';
  $('difficulty').value = difficulty; build();
});
build();
