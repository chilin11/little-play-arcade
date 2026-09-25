export const FRUIT_LABELS = Object.freeze({ apple: '苹果', pear: '梨子' });
export const FRIEND_LABELS = Object.freeze({ rabbit: '小兔', bear: '小熊' });

function freezeLevel(level) {
  return Object.freeze({
    ...level,
    rabbit: Object.freeze({ ...level.rabbit }),
    bear: Object.freeze({ ...level.bear })
  });
}

export const LEVELS = Object.freeze([
  freezeLevel({ rabbit: { fruit: 'apple', count: 1 }, bear: { fruit: 'apple', count: 2 } }),
  freezeLevel({ rabbit: { fruit: 'apple', count: 2 }, bear: { fruit: 'apple', count: 3 } }),
  freezeLevel({ rabbit: { fruit: 'pear', count: 1 }, bear: { fruit: 'pear', count: 3 } }),
  freezeLevel({ rabbit: { fruit: 'apple', count: 3 }, bear: { fruit: 'pear', count: 2 } }),
  freezeLevel({ rabbit: { fruit: 'pear', count: 4 }, bear: { fruit: 'apple', count: 2 } }),
  freezeLevel({ rabbit: { fruit: 'apple', count: 4 }, bear: { fruit: 'pear', count: 3 } }),
  freezeLevel({ rabbit: { fruit: 'pear', count: 5 }, bear: { fruit: 'apple', count: 3 } }),
  freezeLevel({ rabbit: { fruit: 'apple', count: 5 }, bear: { fruit: 'pear', count: 5 } })
].map((level, index) => Object.freeze({ ...level, index })));

const FRIENDS = Object.freeze(Object.keys(FRIEND_LABELS));
const FRUITS = Object.freeze(Object.keys(FRUIT_LABELS));
const MAX_FRUIT = 5;
const clampLevel = value => Math.max(0, Math.min(LEVELS.length - 1, Number.isInteger(value) ? value : 0));

function emptyPlates() {
  return { rabbit: [], bear: [] };
}

export class PicnicCount {
  constructor(levelIndex = 0) {
    this.load(levelIndex);
  }

  load(levelIndex = 0) {
    this.levelIndex = clampLevel(levelIndex);
    this.level = LEVELS[this.levelIndex];
    this.selectedFruit = null;
    this.plates = emptyPlates();
    this.checked = false;
    this.solved = false;
    return this;
  }

  get targets() { return this.level; }
  get complete() { return this.solved; }

  selectFruit(fruit) {
    if (!FRUITS.includes(fruit)) return { ok: false, reason: 'unknown-fruit' };
    this.selectedFruit = fruit;
    return { ok: true, fruit };
  }

  add(friend) {
    if (!FRIENDS.includes(friend)) return { ok: false, reason: 'unknown-friend' };
    if (this.solved) return { ok: false, reason: 'solved' };
    if (!this.selectedFruit) return { ok: false, reason: 'no-fruit' };
    if (this.plates[friend].length >= MAX_FRUIT) return { ok: false, reason: 'full' };
    this.plates[friend].push(this.selectedFruit);
    this.checked = false;
    return { ok: true, friend, fruit: this.selectedFruit, count: this.plates[friend].length };
  }

  remove(friend) {
    if (!FRIENDS.includes(friend)) return { ok: false, reason: 'unknown-friend' };
    if (!this.plates[friend].length) return { ok: false, reason: 'empty' };
    // Last in, first out: the visible control always removes the last fruit
    // placed in this friend's plate, regardless of the currently selected fruit.
    const fruit = this.plates[friend].pop();
    this.checked = false;
    return { ok: true, friend, fruit, count: this.plates[friend].length };
  }

  check() {
    this.checked = true;
    const result = { ok: true, solved: true, issues: [] };
    for (const friend of FRIENDS) {
      const target = this.level[friend];
      const plate = this.plates[friend];
      const typeCorrect = plate.every(fruit => fruit === target.fruit);
      const countCorrect = plate.length === target.count;
      if (!typeCorrect || !countCorrect) {
        result.solved = false;
        result.issues.push({
          friend,
          expectedFruit: target.fruit,
          expectedCount: target.count,
          actualFruits: [...plate],
          typeCorrect,
          countCorrect
        });
      }
    }
    this.solved = result.solved;
    return result;
  }

  reset() {
    this.selectedFruit = null;
    this.plates = emptyPlates();
    this.checked = false;
    this.solved = false;
    return this;
  }
}

export const PicnicCountGame = PicnicCount;

function mountGame() {
  const $ = id => document.getElementById(id);
  const dialog = $('win-dialog');
  const fruitButtons = [...document.querySelectorAll('.fruit-choice')];
  let levelIndex = 0;
  let game = new PicnicCount(levelIndex);
  let unlocked = 0;
  let storageAvailable = true;
  let feedbackState = 'neutral';
  let feedbackText = '先选一种水果，再给朋友放一个吧。';

  try {
    const stored = Number(localStorage.getItem('little-play:picnic-count:v1'));
    if (Number.isInteger(stored)) unlocked = Math.max(0, Math.min(LEVELS.length - 1, stored));
  } catch {
    storageAvailable = false;
  }

  function saveUnlocked() {
    try {
      localStorage.setItem('little-play:picnic-count:v1', String(unlocked));
    } catch {
      storageAvailable = false;
    }
  }

  function announce(text, state = 'neutral') {
    feedbackText = text;
    feedbackState = state;
  }

  function fruitIcon(fruit) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `assets/picnic-sprite.svg#${fruit}`);
    svg.append(use);
    return svg;
  }

  function renderProgress() {
    $('progress').replaceChildren(...LEVELS.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `${index < unlocked ? 'done ' : ''}${index === levelIndex ? 'current ' : ''}${index <= unlocked ? 'unlocked' : ''}`;
      button.disabled = index > unlocked;
      button.textContent = index < unlocked ? '✓' : String(index + 1);
      button.setAttribute('aria-current', index === levelIndex ? 'step' : 'false');
      button.setAttribute('aria-label', `第 ${index + 1} 次野餐${index === levelIndex ? '，当前关卡' : index <= unlocked ? '，可以游玩' : '，尚未解锁'}`);
      button.addEventListener('click', () => { if (index <= unlocked && index !== levelIndex) loadLevel(index); });
      return button;
    }));
  }

  function renderDots(friend) {
    const target = game.level[friend];
    const dots = $( `${friend}-dots` );
    dots.replaceChildren(...Array.from({ length: target.count }, (_, index) => {
      const dot = document.createElement('i');
      dot.setAttribute('aria-hidden', 'true');
      dot.dataset.index = String(index);
      return dot;
    }));
    dots.setAttribute('aria-label', `${FRIEND_LABELS[friend]}需要${target.count}个${FRUIT_LABELS[target.fruit]}`);
  }

  function renderPlate(friend) {
    const target = game.level[friend];
    const plate = $( `${friend}-plate` );
    const fruits = game.plates[friend];
    plate.replaceChildren(...fruits.map((fruit, index) => {
      const item = document.createElement('span');
      item.className = 'fruit-item';
      item.setAttribute('role', 'listitem');
      item.setAttribute('aria-label', `第 ${index + 1} 个${FRUIT_LABELS[fruit]}`);
      item.append(fruitIcon(fruit));
      return item;
    }));
    plate.setAttribute('aria-label', `${FRIEND_LABELS[friend]}盘子里有${fruits.length}个水果${fruits.length ? `：${fruits.map(fruit => FRUIT_LABELS[fruit]).join('、')}` : ''}`);
    $( `${friend}-count` ).textContent = `现在有 ${fruits.length} 个`;
    $( `${friend}-add` ).disabled = !game.selectedFruit || fruits.length >= MAX_FRUIT || game.solved;
    $( `${friend}-remove` ).disabled = fruits.length === 0 || game.solved;
    $( `${friend}-add` ).setAttribute('aria-label', game.selectedFruit ? `给${FRIEND_LABELS[friend]}放一个${FRUIT_LABELS[game.selectedFruit]}` : `先选水果，再给${FRIEND_LABELS[friend]}放一个`);
    $( `${friend}-remove` ).setAttribute('aria-label', fruits.length ? `从${FRIEND_LABELS[friend]}盘里拿回最后放入的一个水果` : `${FRIEND_LABELS[friend]}盘子是空的，不能拿回水果`);
  }

  function render() {
    const rabbit = game.level.rabbit;
    const bear = game.level.bear;
    $('level-name').textContent = `第 ${levelIndex + 1} 次野餐`;
    $('level-status').textContent = game.solved ? '分得刚刚好' : '点一下，放一个';
    $('level-title').textContent = `第 ${levelIndex + 1} / ${LEVELS.length} 次野餐`;
    $('level-instruction').textContent = game.solved ? '两位朋友都拿到了刚刚好的水果。' : '看水果和小圆点，给每位朋友分好刚刚好的数量。';
    for (const friend of ['rabbit', 'bear']) {
      const target = game.level[friend];
      $(`${friend}-request`).textContent = `${FRIEND_LABELS[friend]}想要 ${target.count} 个${FRUIT_LABELS[target.fruit]}`;
      renderDots(friend);
      renderPlate(friend);
    }
    fruitButtons.forEach(button => {
      const selected = game.selectedFruit === button.dataset.fruit;
      button.setAttribute('aria-pressed', String(selected));
    });
    $('selected-fruit').textContent = game.selectedFruit ? `已选${FRUIT_LABELS[game.selectedFruit]}。现在可以给任一位朋友放一个。` : '还没有选水果';
    $('selection-status').textContent = game.selectedFruit ? `当前选中${FRUIT_LABELS[game.selectedFruit]}；点朋友下面的「放一个」，一次放一个。` : '还没有选水果。先选苹果或梨。';
    $('feedback').textContent = feedbackText;
    $('feedback').dataset.state = feedbackState;
    $('check').disabled = game.solved;
    $('save-note').textContent = storageAvailable ? '走过的野餐会在这台设备上留下小树叶。' : '浏览器没有保存小树叶，但所有野餐仍然可以玩。';
    renderProgress();
  }

  function describeIssue(issue) {
    const friend = FRIEND_LABELS[issue.friend];
    const expectedFruit = FRUIT_LABELS[issue.expectedFruit];
    if (!issue.typeCorrect) return `把${friend}盘里的水果拿回来，换成${expectedFruit}。`;
    if (issue.actualFruits.length > issue.expectedCount) return `${friend}多了 ${issue.actualFruits.length - issue.expectedCount} 个${expectedFruit}，拿回${issue.actualFruits.length - issue.expectedCount}个吧。`;
    if (issue.actualFruits.length < issue.expectedCount) return `${friend}还差 ${issue.expectedCount - issue.actualFruits.length} 个${expectedFruit}，再放${issue.expectedCount - issue.actualFruits.length}个吧。`;
    return `再看看${friend}盘里的水果。`;
  }

  function check() {
    const result = game.check();
    if (result.solved) {
      unlocked = Math.max(unlocked, Math.min(LEVELS.length - 1, levelIndex + 1));
      saveUnlocked();
      announce('✓ 刚刚好！谢谢你照顾每位朋友。', 'success');
      render();
      $('win-title').textContent = levelIndex === LEVELS.length - 1 ? '八次野餐都完成啦！' : '刚刚好！';
      $('win-copy').textContent = levelIndex === LEVELS.length - 1 ? '八次野餐都分好了，你是最会照顾朋友的小帮手！' : '谢谢你照顾每位朋友。准备好后，再来一次野餐。';
      $('next-level').textContent = levelIndex === LEVELS.length - 1 ? '再玩一次 ↻' : '下一次野餐 →';
      dialog.showModal();
      return;
    }
    const issue = result.issues.find(item => !item.typeCorrect) || result.issues[0];
    announce(`再看看：${describeIssue(issue)}`, 'retry');
    render();
  }

  function chooseFruit(fruit) {
    const result = game.selectFruit(fruit);
    if (!result.ok) return;
    announce(`已选${FRUIT_LABELS[fruit]}。点朋友下面的「放一个」，一次放一个。`, 'hint');
    render();
    $(`choose-${fruit}`).focus();
  }

  function add(friend) {
    const result = game.add(friend);
    if (!result.ok) {
      if (result.reason === 'no-fruit') announce('先从篮子里选苹果或梨，再放进盘子。', 'hint');
      if (result.reason === 'full') announce(`${FRIEND_LABELS[friend]}的盘子最多放 5 个，先拿回一个吧。`, 'retry');
      render();
      return;
    }
    announce(`给${FRIEND_LABELS[friend]}放了一个${FRUIT_LABELS[result.fruit]}。`, 'neutral');
    render();
    $(`${friend}-add`).focus();
  }

  function remove(friend) {
    const result = game.remove(friend);
    if (!result.ok) {
      announce(`${FRIEND_LABELS[friend]}的盘子是空的，还不能拿回水果。`, 'hint');
      render();
      return;
    }
    announce(`从${FRIEND_LABELS[friend]}盘里拿回了最后放入的${FRUIT_LABELS[result.fruit]}。`, 'neutral');
    render();
    $(`${friend}-remove`).focus();
  }

  function loadLevel(index, focus = true) {
    levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    game = new PicnicCount(levelIndex);
    feedbackState = 'neutral';
    feedbackText = '先选一种水果，再给朋友放一个吧。';
    if (dialog.open) dialog.close();
    render();
    if (focus) $('level-title').focus({ preventScroll: true });
  }

  fruitButtons.forEach(button => button.addEventListener('click', () => chooseFruit(button.dataset.fruit)));
  document.querySelectorAll('.add-button').forEach(button => button.addEventListener('click', () => add(button.dataset.friend)));
  document.querySelectorAll('.remove-button').forEach(button => button.addEventListener('click', () => remove(button.dataset.friend)));
  $('check').addEventListener('click', check);
  $('restart').addEventListener('click', () => { game.reset(); announce('这一场重新分一分。先选水果吧。'); if (dialog.open) dialog.close(); render(); });
  $('replay').addEventListener('click', () => { game.reset(); announce('再来一次，慢慢数小圆点。'); render(); dialog.close(); $('level-title').focus({ preventScroll: true }); });
  $('next-level').addEventListener('click', () => loadLevel(levelIndex === LEVELS.length - 1 ? 0 : levelIndex + 1));
  document.addEventListener('keydown', event => {
    if ((event.key === '1' || event.key === '2') && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      fruitButtons[Number(event.key) - 1]?.click();
    }
  });

  loadLevel(0, false);
}

if (typeof document !== 'undefined' && document.getElementById('rabbit-card')) mountGame();
