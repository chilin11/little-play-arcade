export const SYMBOL_LABELS = Object.freeze({
  leaf: '叶子',
  flower: '花朵',
  mushroom: '蘑菇',
  berry: '浆果'
});

const SYMBOL_IDS = Object.freeze(Object.keys(SYMBOL_LABELS));
const TEMPLATE_LABELS = Object.freeze({
  AB: '两节一组',
  AAB: '三节一组（前两节相同）',
  ABC: '三节一组'
});

function freezeLevel(level) {
  return Object.freeze({
    ...level,
    mapping: Object.freeze({ ...level.mapping }),
    sequence: Object.freeze([...level.sequence]),
    groups: Object.freeze(level.groups.map(group => Object.freeze([...group]))),
    choices: Object.freeze([...level.choices])
  });
}

function makeLevel(station, template, mapping, blankIndex, distractor, note) {
  const { A: a, B: b, C: c } = mapping;
  const sequence = template === 'AB'
    ? [a, b, a, b, a, b]
    : template === 'AAB'
      ? [a, a, b, a, a, b]
      : [a, b, c, a, b, c];
  const groups = template === 'AB'
    ? [[0, 1], [2, 3], [4, 5]]
    : [[0, 1, 2], [3, 4, 5]];
  // AB/AAB offer two pattern symbols plus a distinct distractor. ABC offers
  // the three symbols in its repeated group, with no duplicate candidate.
  const choices = template === 'ABC' ? [a, b, c] : [a, b, distractor];
  return freezeLevel({
    index: station - 1,
    station,
    name: `第 ${station} 站`,
    template,
    pattern: template,
    templateLabel: TEMPLATE_LABELS[template],
    mapping,
    sequence,
    blankIndex,
    answer: sequence[blankIndex],
    answerSymbol: sequence[blankIndex],
    groups,
    choices,
    note
  });
}

// Nine authored stations: three AB, three AAB, and three ABC. Each mapping is
// different so the child must observe the current symbols rather than memorize
// an answer from a previous station.
export const LEVELS = Object.freeze([
  makeLevel(1, 'AB', { A: 'leaf', B: 'flower' }, 5, 'mushroom', '叶子、花朵轮流出现，找找两节一组。'),
  makeLevel(2, 'AB', { A: 'mushroom', B: 'berry' }, 5, 'leaf', '蘑菇、浆果轮流出现，前面已经重复了两次。'),
  makeLevel(3, 'AB', { A: 'flower', B: 'mushroom' }, 5, 'berry', '花朵、蘑菇轮流出现，接着前面的顺序走。'),
  makeLevel(4, 'AAB', { A: 'leaf', B: 'berry' }, 5, 'flower', '两片叶子后面跟一串浆果，三节车厢是一组。'),
  makeLevel(5, 'AAB', { A: 'flower', B: 'leaf' }, 5, 'mushroom', '两朵花后面跟一片叶子，看看这组三节。'),
  makeLevel(6, 'AAB', { A: 'berry', B: 'mushroom' }, 5, 'leaf', '两串浆果后面跟一朵蘑菇，前面有两组线索。'),
  makeLevel(7, 'ABC', { A: 'leaf', B: 'flower', C: 'berry' }, 3, null, '叶子、花朵、浆果，三种图案轮流排队。'),
  makeLevel(8, 'ABC', { A: 'mushroom', B: 'leaf', C: 'flower' }, 4, null, '蘑菇、叶子、花朵，接着第二组的中间图案。'),
  makeLevel(9, 'ABC', { A: 'berry', B: 'mushroom', C: 'leaf' }, 5, null, '浆果、蘑菇、叶子，最后一节接着第三种图案。')
]);

const clampLevel = value => Math.max(0, Math.min(
  LEVELS.length - 1,
  Number.isInteger(value) ? value : 0
));

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export class PatternTrain {
  constructor(levelIndex = 0, random = Math.random) {
    this.random = random;
    this.load(levelIndex);
  }

  load(levelIndex = 0) {
    this.levelIndex = clampLevel(levelIndex);
    this.level = LEVELS[this.levelIndex];
    this.selected = null;
    this.solved = false;
    this.hintShown = false;
    // Shuffle once per station. Wrong answers and hints never reshuffle the
    // choices, keeping the visual comparison stable for the child.
    this.choices = shuffle(this.level.choices, this.random);
    return this;
  }

  get answer() { return this.level.answer; }
  get sequence() { return this.level.sequence; }
  get complete() { return this.solved; }

  choose(symbol) {
    if (!SYMBOL_IDS.includes(symbol)) return { ok: false, reason: 'unknown' };
    if (this.solved) return { ok: false, reason: 'solved' };
    this.selected = symbol;
    if (symbol !== this.answer) {
      return { ok: false, reason: 'wrong', symbol };
    }
    this.solved = true;
    return { ok: true, symbol, explanation: this.level.note };
  }

  select(symbol) { return this.choose(symbol); }

  hint() {
    this.hintShown = true;
    const groups = this.level.groups.map(group => group.map(index => (
      index === this.level.blankIndex ? null : this.level.sequence[index]
    )));
    return {
      groups,
      text: groups.map(group => group.map(symbol => symbol ? SYMBOL_LABELS[symbol] : '空位').join('、')).join('；'),
      templateLabel: this.level.templateLabel
    };
  }

  reset() {
    this.selected = null;
    this.solved = false;
    this.hintShown = false;
    return this;
  }
}

export const PatternTrainGame = PatternTrain;

function createSymbolIcon(symbol, className = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  if (className) svg.setAttribute('class', className);
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `assets/pattern-sprite.svg#${symbol}`);
  svg.append(use);
  return svg;
}

function mountGame() {
  const $ = id => document.getElementById(id);
  const trainLine = $('train-line');
  const choices = $('choices');
  const dialog = $('win-dialog');
  const storageKey = 'little-play:pattern-train:v1';
  let levelIndex = 0;
  let game = new PatternTrain(levelIndex);
  let unlocked = 0;
  let storageAvailable = true;
  let feedbackState = 'neutral';
  let feedbackText = '先从左往右看，找找重复的小组吧。';

  try {
    const stored = Number(localStorage.getItem(storageKey));
    if (Number.isInteger(stored)) unlocked = Math.max(0, Math.min(LEVELS.length - 1, stored));
  } catch {
    storageAvailable = false;
  }

  function saveUnlocked() {
    try {
      localStorage.setItem(storageKey, String(unlocked));
    } catch {
      storageAvailable = false;
    }
  }

  function announce(text, state = 'neutral') {
    feedbackText = text;
    feedbackState = state;
  }

  function renderProgress() {
    $('progress').replaceChildren(...LEVELS.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.level = String(index);
      button.className = `${index < unlocked ? 'done ' : ''}${index === levelIndex ? 'current ' : ''}${index <= unlocked ? 'unlocked' : ''}`;
      button.disabled = index > unlocked;
      button.textContent = index < unlocked ? '✓' : String(index + 1);
      button.setAttribute('aria-current', index === levelIndex ? 'step' : 'false');
      button.setAttribute('aria-label', `${item.name}${index === levelIndex ? '，当前站点' : index <= unlocked ? '，可以游玩' : '，尚未解锁'}`);
      button.addEventListener('click', () => {
        if (index <= unlocked && index !== levelIndex) loadLevel(index);
      });
      return button;
    }));
  }

  function renderTrain() {
    trainLine.classList.toggle('hinted', game.hintShown);
    trainLine.replaceChildren();
    game.sequence.forEach((symbol, index) => {
      const wagon = document.createElement('div');
      wagon.className = 'wagon';
      wagon.dataset.index = String(index);

      const art = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      art.setAttribute('viewBox', '0 0 160 130');
      art.setAttribute('class', 'wagon-art');
      art.setAttribute('aria-hidden', 'true');
      const wagonUse = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      wagonUse.setAttribute('href', 'assets/pattern-sprite.svg#wagon');
      art.append(wagonUse);
      wagon.append(art);

      if (index === game.level.blankIndex && !game.solved) {
        const empty = document.createElement('span');
        empty.className = 'missing';
        empty.textContent = '?';
        empty.setAttribute('aria-hidden', 'true');
        wagon.append(empty);
        wagon.setAttribute('aria-label', `第 ${index + 1} 节车厢，空着，等待图案`);
      } else {
        wagon.append(createSymbolIcon(symbol, 'cargo'));
        wagon.setAttribute('aria-label', `第 ${index + 1} 节车厢，${SYMBOL_LABELS[symbol]}`);
      }
      trainLine.append(wagon);
    });

    if (game.hintShown) {
      game.level.groups.forEach((group, groupIndex) => {
        const bracket = document.createElement('div');
        bracket.className = 'group-bracket';
        bracket.style.left = `${(group[0] / 6) * 100 + 1}%`;
        bracket.style.width = `${(group.length / 6) * 100 - 2}%`;
        bracket.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span');
        label.textContent = `第 ${groupIndex + 1} 组`;
        bracket.append(label);
        trainLine.append(bracket);
      });
    }

    const plain = game.sequence
      .map((symbol, index) => index === game.level.blankIndex && !game.solved ? '空车厢' : SYMBOL_LABELS[symbol])
      .join('、');
    $('pattern-caption').textContent = `从左往右：${plain}。${game.hintShown ? `括线标出了${game.level.templateLabel}的重复小组。` : ''}`;
  }

  function renderChoices(focusSymbol = null) {
    choices.replaceChildren(...game.choices.map(symbol => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice choice-button';
      button.dataset.symbol = symbol;
      button.setAttribute('aria-pressed', String(game.selected === symbol));
      button.setAttribute('aria-label', `选择${SYMBOL_LABELS[symbol]}`);
      button.disabled = game.solved;
      button.append(createSymbolIcon(symbol));
      button.append(document.createTextNode(SYMBOL_LABELS[symbol]));
      button.addEventListener('click', () => choose(symbol));
      return button;
    }));
    if (focusSymbol) choices.querySelector(`[data-symbol="${focusSymbol}"]`)?.focus();
  }

  function render() {
    const item = LEVELS[levelIndex];
    $('level-name').textContent = item.name;
    $('station-status').textContent = game.solved ? '规律找到了' : '不计时，慢慢找';
    $('station-title').textContent = `第 ${item.station} / ${LEVELS.length} 站`;
    $('station-instruction').textContent = game.solved
      ? '装对啦！准备好后，点击下一站。'
      : `找出${item.templateLabel}，给空车厢补上图案。`;
    $('feedback').textContent = feedbackText;
    $('feedback').dataset.state = feedbackState;
    $('hint-readout').hidden = !game.hintShown;
    if (game.hintShown) {
      $('hint-readout').textContent = `提示：${game.hint().text}。括线已经把重复小组圈起来了。`;
    }
    $('retry').hidden = !game.solved;
    $('save-note').textContent = storageAvailable
      ? '走过的站点会在这台设备上留下小树叶。'
      : '浏览器没有保存小树叶，但所有站点仍然可以玩。';
    renderProgress();
    renderTrain();
    renderChoices();
  }

  function completeStation() {
    unlocked = Math.max(unlocked, Math.min(LEVELS.length - 1, levelIndex + 1));
    saveUnlocked();
    const final = levelIndex === LEVELS.length - 1;
    announce(`✓ 找到规律啦！${game.level.note}`, 'success');
    render();
    $('win-title').textContent = final ? '九站都到啦！' : '找到规律啦！';
    $('win-copy').textContent = final
      ? '花花小火车跑完了九站。你已经是规律观察小专家！'
      : `${game.level.note}准备好后，去下一站。`;
    $('next-level').textContent = final ? '再玩一次 ↻' : '下一站 →';
    $('replay').textContent = final ? '再试第九站' : '再试一次';
    dialog.showModal();
  }

  function choose(symbol) {
    const result = game.choose(symbol);
    if (!result.ok) {
      if (result.reason === 'wrong') {
        announce('再看看前面的一组。找找重复出现的图案，再试一次吧。', 'retry');
        render();
        choices.querySelector(`[data-symbol="${symbol}"]`)?.focus();
      }
      return;
    }
    completeStation();
  }

  function loadLevel(index, focus = true) {
    levelIndex = Math.max(0, Math.min(LEVELS.length - 1, index));
    game = new PatternTrain(levelIndex);
    feedbackState = 'neutral';
    feedbackText = '先从左往右看，找找重复的小组吧。';
    if (dialog.open) dialog.close();
    render();
    if (focus) $('station-title').focus({ preventScroll: true });
  }

  $('hint').addEventListener('click', () => {
    if (game.solved) return;
    const hint = game.hint();
    announce(`提示：${hint.text}。先看清每一组，再决定空车厢里的图案。`, 'hint');
    render();
  });
  $('restart').addEventListener('click', () => {
    if (dialog.open) dialog.close();
    game.reset();
    announce('这一站重新开始。先从左往右看吧。');
    render();
  });
  $('retry').addEventListener('click', () => {
    if (dialog.open) dialog.close();
    game.reset();
    announce('再试一次，图案还在这里等你。');
    render();
    $('station-title').focus({ preventScroll: true });
  });
  $('replay').addEventListener('click', () => {
    dialog.close();
    game.reset();
    announce('再来一次，看看这组图案怎么重复。');
    render();
    $('station-title').focus({ preventScroll: true });
  });
  $('next-level').addEventListener('click', () => {
    loadLevel(levelIndex === LEVELS.length - 1 ? 0 : levelIndex + 1);
  });
  document.addEventListener('keydown', event => {
    if (event.key >= '1' && event.key <= '3'
      && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      choices.querySelectorAll('button')[Number(event.key) - 1]?.click();
    }
  });

  loadLevel(0, false);
}

if (typeof document !== 'undefined' && document.getElementById('train-line')) mountGame();
