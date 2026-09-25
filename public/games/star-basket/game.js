const $ = id => document.getElementById(id);
const baskets = [...document.querySelectorAll('.basket')];
const ROUND_SECONDS = 45;
let score = 0;
let combo = 0;
let remaining = ROUND_SECONDS;
let running = false;
let paused = false;
let item = null;
let itemTimer = 0;
let clockTimer = 0;
let storageOK = true;

function readBest() { try { return Number(localStorage.getItem('star-basket-best')) || 0; } catch { storageOK = false; return 0; } }
function saveBest(value) { try { localStorage.setItem('star-basket-best', String(value)); } catch { storageOK = false; } }
let best = readBest();
function render() {
  $('score').textContent = String(score);
  $('combo').textContent = String(combo);
  $('best').textContent = String(best);
  $('time').textContent = `${remaining} 秒`;
  $('progress-fill').style.width = `${((ROUND_SECONDS - remaining) / ROUND_SECONDS) * 100}%`;
  $('level').textContent = `第 ${Math.min(3, Math.floor((ROUND_SECONDS - remaining) / 15) + 1)} 段星路`;
  if (!storageOK) $('save-note').textContent = '浏览器没有开放存储，不过星星照样可以接。';
}
function clearItem() {
  clearTimeout(itemTimer);
  item = null;
  $('prompt').className = 'prompt';
  $('prompt').textContent = running ? '看看哪片云朵亮起来' : '准备好就出发吧';
  $('prompt').removeAttribute('aria-label');
  baskets.forEach((button, lane) => { button.classList.remove('active'); button.setAttribute('aria-label', `${['左边','中间','右边'][lane]}云朵，按数字 ${lane + 1}`); });
}
function nextDelay() { return Math.max(540, 980 - (ROUND_SECONDS - remaining) * 9); }
function spawn() {
  if (!running || paused) return;
  const dropChance = 0.18;
  item = { type: Math.random() < dropChance ? 'drop' : 'star', lane: Math.floor(Math.random() * 3) };
  const prompt = $('prompt');
  prompt.className = `prompt ${item.type}`;
  prompt.textContent = item.type === 'star' ? '★' : '💧';
  baskets[item.lane].classList.add('active');
  baskets[item.lane].setAttribute('aria-label', `${['左边','中间','右边'][item.lane]}云朵，${item.type === 'star' ? '有星星，请接住' : '有雨滴，请等待'}，按数字 ${item.lane + 1}`);
  prompt.setAttribute('aria-label', item.type === 'star' ? `星星在${['左边','中间','右边'][item.lane]}云朵` : `雨滴在${['左边','中间','右边'][item.lane]}云朵，请等待`);
  const current = item;
  itemTimer = setTimeout(() => {
    if (item !== current) return;
    if (item.type === 'star') { combo = 0; $('message').textContent = '这颗星星去照亮别处啦，下一颗再见'; }
    else $('message').textContent = '雨滴轻轻路过啦';
    clearItem(); render();
    itemTimer = setTimeout(spawn, 230);
  }, nextDelay());
}
function choose(lane) {
  if (!running || paused || !item) return;
  if (item.type === 'star' && lane === item.lane) {
    combo += 1;
    score += 1 + Math.floor(combo / 5);
    baskets[lane].classList.add('caught');
    setTimeout(() => baskets[lane].classList.remove('caught'), 320);
    $('message').textContent = combo >= 3 ? `连续接住 ${combo} 颗，星光亮晶晶！` : '接住啦！篮子里多了一颗星';
  } else if (item.type === 'drop' && lane === item.lane) {
    combo = 0; $('message').textContent = '是一滴小雨，擦擦篮子继续等星星';
  } else {
    combo = 0; $('message').textContent = '星星在另一片云上，再看一眼';
  }
  clearItem(); render();
  itemTimer = setTimeout(spawn, 180);
}
function start() {
  clearTimeout(itemTimer); clearInterval(clockTimer);
  score = 0; combo = 0; remaining = ROUND_SECONDS; running = true; paused = false;
  $('start').disabled = true; $('pause').disabled = false; $('pause').textContent = 'Ⅱ 暂停一下';
  $('message').textContent = '第一颗星星就要来啦'; clearItem(); render();
  itemTimer = setTimeout(spawn, 450);
  clockTimer = setInterval(() => { if (paused) return; remaining -= 1; render(); if (remaining <= 0) finish(); }, 1000);
}
function finish() {
  running = false; paused = false; clearInterval(clockTimer); clearItem();
  if (score > best) { best = score; saveBest(best); }
  $('start').disabled = false; $('pause').disabled = true;
  $('start').textContent = '✦ 再接一篮星星';
  $('prompt').textContent = `收好 ${score} 颗星星 ✦`;
  $('message').textContent = '这一篮星光真温暖，想玩时再出发'; render();
}
function togglePause(auto = false) {
  if (!running) return;
  paused = !paused;
  if (paused) {
    clearTimeout(itemTimer); $('pause').textContent = '▶ 继续接星星';
    $('prompt').className = 'prompt'; $('prompt').textContent = auto ? '先歇一会儿，回来再继续' : '星星也停下来等你';
    $('message').textContent = '暂停中，慢慢休息';
  } else {
    $('pause').textContent = 'Ⅱ 暂停一下'; $('message').textContent = '继续寻找亮晶晶的星星'; clearItem(); itemTimer = setTimeout(spawn, 300);
  }
}
baskets.forEach(button => button.addEventListener('click', () => choose(Number(button.dataset.lane))));
$('start').addEventListener('click', start);
$('restart').addEventListener('click', start);
$('pause').addEventListener('click', () => togglePause());
document.addEventListener('keydown', event => {
  if (['1','2','3'].includes(event.key)) { event.preventDefault(); choose(Number(event.key) - 1); }
  if (event.key.toLowerCase() === 'p') { event.preventDefault(); togglePause(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused) togglePause(true); });
render();
