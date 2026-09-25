import { CATALOG, CATEGORY_LABELS, createItemPreview, createLookSVG } from './assets/catalog.js';

const LOOK_KEYS = ['character', 'top', 'bottom', 'dress', 'shoes', 'hat', 'neck', 'accessory'];
const CATEGORY_ORDER = ['tops', 'bottoms', 'dresses', 'shoes', 'hats', 'neck', 'accessories'];
const CATEGORY_META = {
  tops: { label: '上衣', slot: 'top', unit: '件' },
  bottoms: { label: '下装', slot: 'bottom', unit: '件' },
  dresses: { label: '连衣裙', slot: 'dress', unit: '件' },
  shoes: { label: '鞋子', slot: 'shoes', unit: '双' },
  hats: { label: '帽子', slot: 'hat', unit: '件' },
  neck: { label: '颈饰', slot: 'neck', unit: '件' },
  accessories: { label: '配饰', slot: 'accessory', unit: '件' }
};
const SLOT_LABELS = {
  character: '角色',
  top: '上衣',
  bottom: '下装',
  dress: '连衣裙',
  shoes: '鞋子',
  hat: '帽子',
  neck: '颈饰',
  accessory: '配饰'
};
const STORAGE_KEY = 'magic-wardrobe-v2';
const LEGACY_KEYS = ['magic-wardrobe-save', 'magic-wardrobe-state', 'magic-wardrobe-works'];
const $ = id => document.getElementById(id);

const DEFAULT_LOOK = {
  character: 'character-rabbit',
  top: 'top-tshirt',
  bottom: 'bottom-pleated',
  dress: null,
  shoes: 'shoe-sneakers',
  hat: 'hat-none',
  neck: 'neck-none',
  accessory: 'acc-none'
};

// Each order asks for one character and four to six concrete symbol IDs.
const ORDERS = [
  { id: 'wish-01', character: 'character-rabbit', items: ['top-shirt', 'bottom-pleated', 'shoe-canvas', 'hat-beret', 'neck-bowtie', 'acc-glasses'] },
  { id: 'wish-02', character: 'character-cat', items: ['dress-starlight', 'shoe-ballet', 'hat-wreath', 'neck-shawl', 'acc-bracelet'] },
  { id: 'wish-03', character: 'character-bear', items: ['top-puff', 'bottom-denim-shorts', 'shoe-sneakers', 'hat-cap', 'acc-backpack'] },
  { id: 'wish-04', character: 'character-deer', items: ['dress-garden', 'shoe-sandals', 'hat-wreath', 'neck-silk', 'acc-satchel'] },
  { id: 'wish-05', character: 'character-rabbit', items: ['top-hoodie', 'bottom-denim-shorts', 'shoe-rainboots', 'hat-beanie', 'neck-scarf'] },
  { id: 'wish-06', character: 'character-cat', items: ['dress-academy', 'shoe-boots', 'hat-cap', 'neck-bowtie', 'acc-badge'] },
  { id: 'wish-07', character: 'character-bear', items: ['top-knit', 'bottom-wide', 'shoe-boots', 'neck-shawl', 'acc-handbag'] },
  { id: 'wish-08', character: 'character-deer', items: ['dress-festival', 'shoe-canvas', 'hat-beret', 'neck-silk'] },
  { id: 'wish-09', character: 'character-rabbit', items: ['top-sailor', 'bottom-overalls', 'shoe-sneakers', 'hat-cap', 'acc-backpack'] },
  { id: 'wish-10', character: 'character-cat', items: ['dress-pinafore', 'shoe-ballet', 'hat-sun', 'neck-snood', 'acc-hairclip'] },
  { id: 'wish-11', character: 'character-bear', items: ['top-jacket', 'bottom-straight', 'shoe-rainboots', 'hat-beanie', 'neck-scarf', 'acc-badge'] },
  { id: 'wish-12', character: 'character-deer', items: ['dress-aline', 'shoe-sandals', 'hat-wreath', 'neck-bowtie', 'acc-handbag'] }
];

const itemById = new Map();
const categoryById = new Map();
for (const [category, items] of Object.entries(CATALOG)) {
  for (const item of items) {
    itemById.set(item.id, item);
    categoryById.set(item.id, category);
  }
}
const orderById = new Map(ORDERS.map(order => [order.id, order]));

let storageOK = true;
let mode = 'wish';
let activeCategory = 'tops';
let orderIndex = 0;
let orderComplete = false;
let completedOrders = new Set();
let works = [];
let wishState = null;
let freeState = cloneLook(DEFAULT_LOOK);
const state = cloneLook(DEFAULT_LOOK);

function cloneLook(look) {
  return Object.fromEntries(LOOK_KEYS.map(key => [key, look?.[key] ?? null]));
}

function lookKey(look) {
  return LOOK_KEYS.map(key => look[key] ?? '').join('|');
}

function itemFor(id) {
  return itemById.get(id) || null;
}

function labelFor(id) {
  return itemFor(id)?.label || '未命名单品';
}

function validId(category, id) {
  return typeof id === 'string' && CATALOG[category]?.some(item => item.id === id);
}

function slotForItem(id) {
  const category = categoryById.get(id);
  if (category === 'characters') return 'character';
  return CATEGORY_META[category]?.slot || null;
}

function normalizeLook(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).length !== LOOK_KEYS.length) return null;
  const normalized = {};
  for (const key of LOOK_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return null;
    const category = key === 'character'
      ? 'characters'
      : Object.entries(CATEGORY_META).find(([, meta]) => meta.slot === key)?.[0];
    const current = value[key];
    if (['top', 'bottom', 'dress'].includes(key) && current === null) {
      normalized[key] = null;
      continue;
    }
    if (!category || !validId(category, current)) return null;
    normalized[key] = current;
  }
  if (normalized.dress !== null && (normalized.top !== null || normalized.bottom !== null)) return null;
  if (normalized.dress === null && (normalized.top === null || normalized.bottom === null)) return null;
  return normalized;
}

function normalizeWorks(value) {
  if (!Array.isArray(value)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of value) {
    const work = normalizeLook(entry);
    if (!work) continue;
    const key = lookKey(work);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(work);
    if (result.length === 12) break;
  }
  return result;
}

function safeIndex(value) {
  return Number.isInteger(value) && value >= 0 && value < ORDERS.length ? value : 0;
}

function normalizeCompleted(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(id => typeof id === 'string' && orderById.has(id)))].slice(0, ORDERS.length);
}

function normalizeSave(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.version !== 2) return null;
  const completed = normalizeCompleted(value.completedOrders);
  return {
    orderIndex: safeIndex(value.orderIndex),
    orderId: typeof value.orderId === 'string' && orderById.has(value.orderId) ? value.orderId : null,
    completedOrders: completed,
    works: normalizeWorks(value.works),
    wishState: normalizeLook(value.wishState || value.state),
    freeState: normalizeLook(value.freeState)
  };
}

function emptySave() {
  return { orderIndex: 0, orderId: null, completedOrders: [], works: [], wishState: null, freeState: null };
}

function parseJSON(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    storageOK = false;
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    storageOK = false;
    updateSaveNote();
  }
}

function legacyMigration(value) {
  const envelope = normalizeSave(value);
  if (envelope) return envelope;
  if (value && typeof value === 'object' && !Array.isArray(value) && value.version !== 2) {
    const directLook = normalizeLook(value.look || value.state);
    if (directLook) return { ...emptySave(), freeState: directLook };
    const directWorks = normalizeWorks(value.works);
    if (directWorks.length) return { ...emptySave(), works: directWorks };
  }
  const directWorks = normalizeWorks(value);
  return directWorks.length ? { ...emptySave(), works: directWorks } : null;
}

function readSave() {
  const current = normalizeSave(parseJSON(storageGet(STORAGE_KEY)));
  if (current) return current;

  // Old color/pattern/emoji records do not contain stable symbol IDs and are
  // deliberately ignored. A complete symbol-ID look can be migrated safely.
  for (const key of LEGACY_KEYS) {
    const migrated = legacyMigration(parseJSON(storageGet(key)));
    if (!migrated) continue;
    storageSet(STORAGE_KEY, JSON.stringify({ version: 2, ...migrated }));
    return migrated;
  }
  return emptySave();
}

function persist() {
  storageSet(STORAGE_KEY, JSON.stringify({
    version: 2,
    orderIndex,
    orderId: currentOrder().id,
    completedOrders: [...completedOrders],
    stickers: completedOrders.size,
    works,
    wishState,
    freeState
  }));
}

function updateSaveNote() {
  const note = $('save-note');
  if (!note) return;
  note.textContent = storageOK
    ? '贴纸、订单和作品会留在当前浏览器。'
    : '浏览器存储不可用，不过衣橱照样可以玩；刷新后不会保留记录。';
}

function currentOrder() {
  return ORDERS[orderIndex];
}

function baseWishLook(order) {
  const look = cloneLook(DEFAULT_LOOK);
  look.character = order.character;
  return look;
}

function orderLook(order) {
  const look = baseWishLook(order);
  for (const id of order.items) {
    const slot = slotForItem(id);
    if (!slot) continue;
    if (slot === 'dress') {
      look.dress = id;
      look.top = null;
      look.bottom = null;
    } else {
      look[slot] = id;
      if (slot === 'top' || slot === 'bottom') look.dress = null;
    }
  }
  return look;
}

function nextOpenOrder(start) {
  for (let offset = 0; offset < ORDERS.length; offset += 1) {
    const index = (start + offset + ORDERS.length) % ORDERS.length;
    if (!completedOrders.has(ORDERS[index].id)) return index;
  }
  return null;
}

function copyIntoState(next) {
  Object.assign(state, cloneLook(next));
}

function syncSnapshot() {
  if (mode === 'wish') wishState = cloneLook(state);
  else freeState = cloneLook(state);
  persist();
}

function lookItems(look) {
  return look.dress
    ? [look.dress, look.shoes, look.hat, look.neck, look.accessory]
    : [look.top, look.bottom, look.shoes, look.hat, look.neck, look.accessory];
}

function lookSummary(look) {
  return lookItems(look)
    .filter(id => id && !id.endsWith('-none'))
    .map(labelFor)
    .join(' · ') || '还没有选择单品';
}

function renderMode() {
  const wish = mode === 'wish';
  $('mode-wish').classList.toggle('selected', wish);
  $('mode-free').classList.toggle('selected', !wish);
  $('mode-wish').setAttribute('aria-pressed', String(wish));
  $('mode-free').setAttribute('aria-pressed', String(!wish));
  $('order-card').hidden = !wish;
  $('character-picker').hidden = wish;
  $('random-inspiration').hidden = wish;
  $('random-inspiration').disabled = wish;
  $('save-design').hidden = wish;
  $('save-design').disabled = wish;
  $('choice-hint').textContent = wish ? '选好角色，再打开一个分类' : '喜欢什么就留下什么';
  $('free-note').textContent = wish
    ? '订单没有倒计时，找齐角色和单品后再检查。'
    : '没有标准答案，喜欢的组合就是好作品。';
  $('look-mode-label').textContent = wish ? '愿望模式 · 慢慢搭' : '自由模式 · 尽情试';
}

function renderStage() {
  const stage = $('wardrobe-stage');
  const name = labelFor(state.character);
  const svg = createLookSVG(state, { scene: true, label: `${name}的真实换装` });
  svg.classList.add('stage-look');
  stage.dataset.character = state.character;
  for (const key of LOOK_KEYS.slice(1)) stage.dataset[key] = state[key] || '';

  const caption = document.createElement('div');
  caption.className = 'character-caption';
  const title = document.createElement('strong');
  title.textContent = name;
  const detail = document.createElement('span');
  detail.textContent = lookSummary(state);
  caption.append(title, detail);
  stage.replaceChildren(svg, caption);
  $('stage-label').textContent = `${mode === 'wish' ? '愿望订单' : '自由设计'} · ${name}`;
  $('selected-character-name').textContent = name;
}

function renderCharacterPicker() {
  const container = $('character-picker');
  container.replaceChildren(...CATALOG.characters.map(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'character-choice';
    button.id = `character-${item.id}`;
    button.dataset.character = item.id;
    button.dataset.item = item.id;
    button.setAttribute('aria-pressed', String(state.character === item.id));
    button.setAttribute('aria-label', `选择${item.label}`);
    const preview = createItemPreview(item.id);
    preview.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = item.label;
    button.append(preview, text);
    button.addEventListener('click', () => selectCharacter(item.id));
    return button;
  }));
}

function renderCategoryTabs() {
  const tabs = $('category-tabs');
  tabs.replaceChildren(...CATEGORY_ORDER.map(category => {
    const meta = CATEGORY_META[category];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-tab';
    button.id = `tab-${category}`;
    button.dataset.category = category;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(activeCategory === category));
    button.setAttribute('aria-controls', 'wardrobe-options');
    button.tabIndex = activeCategory === category ? 0 : -1;
    const label = document.createElement('span');
    label.textContent = meta.label;
    const count = document.createElement('small');
    count.textContent = String(CATALOG[category].length);
    button.append(label, count);
    button.addEventListener('click', () => setActiveCategory(category));
    button.addEventListener('keydown', event => {
      const index = CATEGORY_ORDER.indexOf(category);
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % CATEGORY_ORDER.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + CATEGORY_ORDER.length) % CATEGORY_ORDER.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = CATEGORY_ORDER.length - 1;
      if (next === index) return;
      event.preventDefault();
      setActiveCategory(CATEGORY_ORDER[next]);
      $(`tab-${CATEGORY_ORDER[next]}`).focus();
    });
    return button;
  }));
}

function setActiveCategory(category) {
  if (!CATEGORY_META[category]) return;
  activeCategory = category;
  renderCategoryTabs();
  renderCategoryOptions();
}

function renderCategoryOptions() {
  const meta = CATEGORY_META[activeCategory];
  const container = $('wardrobe-options');
  $('category-title').textContent = meta.label;
  $('category-count').textContent = `${CATALOG[activeCategory].length} ${meta.unit}`;
  container.setAttribute('aria-label', `${meta.label}选项`);
  container.dataset.category = activeCategory;
  container.replaceChildren(...CATALOG[activeCategory].map(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'wardrobe-item option-button';
    button.id = `item-${item.id}`;
    button.dataset.item = item.id;
    button.dataset.value = item.id;
    button.dataset.category = activeCategory;
    button.setAttribute('aria-pressed', String(state[meta.slot] === item.id));
    button.setAttribute('aria-label', `选择${item.label}`);
    const preview = createItemPreview(item.id);
    preview.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = item.label;
    button.append(preview, label);
    button.addEventListener('click', () => selectItem(activeCategory, item.id));
    return button;
  }));
  document.querySelectorAll('.category-tab').forEach(tab => {
    const selected = tab.dataset.category === activeCategory;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
}

function updateControlStates() {
  document.querySelectorAll('.character-choice').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.character === state.character));
    button.disabled = mode === 'wish' && orderComplete;
  });
  document.querySelectorAll('.wardrobe-item').forEach(button => {
    const slot = CATEGORY_META[button.dataset.category]?.slot;
    button.setAttribute('aria-pressed', String(Boolean(slot && state[slot] === button.dataset.item)));
    button.disabled = mode === 'wish' && orderComplete;
  });
}

function appendRequirement(container, category, id) {
  const preview = createItemPreview(id);
  preview.setAttribute('aria-hidden', 'true');
  const text = document.createElement('div');
  const kind = document.createElement('small');
  kind.textContent = category;
  const label = document.createElement('strong');
  label.textContent = labelFor(id);
  text.append(kind, label);
  container.append(preview, text);
}

function updateOrderMatches() {
  const order = currentOrder();
  document.querySelectorAll('.order-requirement').forEach(requirement => {
    const id = requirement.dataset.item;
    const slot = requirement.dataset.slot;
    requirement.classList.toggle('matched', slot === 'character' ? state.character === id : state[slot] === id);
  });
}

function renderOrder() {
  const order = currentOrder();
  const card = $('order-card');
  card.dataset.orderId = order.id;
  card.dataset.orderIndex = String(orderIndex);
  card.dataset.character = order.character;
  card.dataset.requiredItems = order.items.join(',');
  $('order-number').textContent = String(orderIndex + 1).padStart(2, '0');
  $('order-copy').textContent = `${labelFor(order.character)}想要这套穿搭。请找齐 ${order.items.length} 件具体单品：`;
  $('order-preview').replaceChildren(createLookSVG(orderLook(order), {
    scene: true,
    label: `${labelFor(order.character)}的愿望订单预览`
  }));

  const requirements = $('order-requirements');
  requirements.replaceChildren();
  const characterRequirement = document.createElement('li');
  characterRequirement.className = 'requirement-item order-requirement';
  characterRequirement.dataset.category = 'character';
  characterRequirement.dataset.slot = 'character';
  characterRequirement.dataset.item = order.character;
  appendRequirement(characterRequirement, '角色', order.character);
  requirements.append(characterRequirement);
  for (const id of order.items) {
    const slot = slotForItem(id);
    const requirement = document.createElement('li');
    requirement.className = 'requirement-item order-requirement';
    requirement.dataset.category = slot;
    requirement.dataset.slot = slot;
    requirement.dataset.item = id;
    appendRequirement(requirement, SLOT_LABELS[slot], id);
    requirements.append(requirement);
  }

  orderComplete = completedOrders.has(order.id);
  $('feedback').className = orderComplete ? 'feedback success' : 'feedback';
  $('feedback').textContent = orderComplete
    ? '这张订单已经完成啦！继续下一张愿望订单吧。'
    : '把订单上标出的角色和单品找齐，再来检查吧。';
  $('check-order').hidden = orderComplete || completedOrders.size === ORDERS.length;
  $('next-order').hidden = !orderComplete || completedOrders.size === ORDERS.length;
  if (completedOrders.size === ORDERS.length) {
    $('feedback').className = 'feedback success';
    $('feedback').textContent = '十二张愿望订单都完成啦！还可以去自由设计收藏作品。';
  }
  updateOrderMatches();
  updateControlStates();
}

function updateStats() {
  $('saved-count').textContent = String(works.length);
  $('sticker-count').textContent = String(completedOrders.size);
  $('design-status').setAttribute('aria-label', `已获得 ${completedOrders.size} 张贴纸`);
}

function clearOrderFeedback() {
  if (mode !== 'wish' || orderComplete) return;
  $('feedback').className = 'feedback';
  $('feedback').textContent = '把订单上标出的角色和单品找齐，再来检查吧。';
  $('check-order').hidden = false;
  $('next-order').hidden = true;
}

function selectCharacter(id) {
  if (mode === 'wish' && orderComplete) return;
  if (!validId('characters', id)) return;
  state.character = id;
  syncSnapshot();
  renderStage();
  updateControlStates();
  updateOrderMatches();
  clearOrderFeedback();
  $('message').textContent = `${labelFor(id)}来到试衣镜前啦`;
}

function selectItem(category, id) {
  const meta = CATEGORY_META[category];
  if (!meta || (mode === 'wish' && orderComplete) || !validId(category, id)) return;
  if (category === 'dresses') {
    state.dress = id;
    state.top = null;
    state.bottom = null;
  } else {
    state[meta.slot] = id;
    if (category === 'tops' || category === 'bottoms') {
      state.dress = null;
      if (state.top === null) state.top = DEFAULT_LOOK.top;
      if (state.bottom === null) state.bottom = DEFAULT_LOOK.bottom;
    }
  }
  syncSnapshot();
  renderStage();
  renderCategoryOptions();
  updateControlStates();
  updateOrderMatches();
  clearOrderFeedback();
  $('message').textContent = `${labelFor(id)}换上啦`;
}

function randomId(category) {
  const items = CATALOG[category];
  return items[Math.floor(Math.random() * items.length)].id;
}

function randomLook() {
  const next = {
    character: randomId('characters'),
    top: null,
    bottom: null,
    dress: null,
    shoes: randomId('shoes'),
    hat: randomId('hats'),
    neck: randomId('neck'),
    accessory: randomId('accessories')
  };
  if (Math.random() < 0.45) next.dress = randomId('dresses');
  else {
    next.top = randomId('tops');
    next.bottom = randomId('bottoms');
  }
  if (lookKey(next) === lookKey(state)) next.shoes = randomId('shoes');
  return next;
}

function randomInspiration() {
  if (mode !== 'free') return;
  copyIntoState(randomLook());
  syncSnapshot();
  renderStage();
  renderCharacterPicker();
  renderCategoryOptions();
  $('message').textContent = '随机整套完成啦！这套搭配很特别';
}

function resetLook() {
  copyIntoState(mode === 'wish' ? baseWishLook(currentOrder()) : DEFAULT_LOOK);
  syncSnapshot();
  renderStage();
  renderCharacterPicker();
  renderCategoryOptions();
  updateOrderMatches();
  clearOrderFeedback();
  $('message').textContent = mode === 'wish' ? '已经回到这张订单的基础搭配' : '已经重置成一套清爽的基础穿搭';
}

function checkOrder() {
  if (mode !== 'wish' || orderComplete) return;
  const order = currentOrder();
  const wrong = [];
  if (state.character !== order.character) wrong.push('角色');
  for (const id of order.items) {
    const slot = slotForItem(id);
    if (state[slot] !== id) wrong.push(SLOT_LABELS[slot] || '单品');
  }
  const categories = [...new Set(wrong)];
  if (categories.length) {
    $('feedback').className = 'feedback gentle';
    $('feedback').textContent = `还需调整：${categories.join('、')}。看看对应的衣橱分类，再试一次吧。`;
    $('message').textContent = '没关系，慢慢找就会找到的';
    updateOrderMatches();
    return;
  }
  completedOrders.add(order.id);
  orderComplete = true;
  persist();
  renderOrder();
  renderCharacterPicker();
  renderCategoryOptions();
  updateStats();
  $('feedback').className = 'feedback success';
  $('feedback').textContent = '订单完成！收到一张闪亮贴纸，搭配得真有想法。';
  $('message').textContent = '愿望完成，衣橱里多了一颗星星';
}

function nextOrder() {
  if (!orderComplete) return;
  const next = nextOpenOrder(orderIndex + 1);
  if (next === null) {
    renderOrder();
    return;
  }
  orderIndex = next;
  wishState = baseWishLook(currentOrder());
  copyIntoState(wishState);
  orderComplete = false;
  persist();
  renderOrder();
  renderStage();
  renderCharacterPicker();
  renderCategoryOptions();
  $('message').textContent = '下一张愿望订单来啦';
}

function switchMode(nextMode) {
  if (!['wish', 'free'].includes(nextMode) || nextMode === mode) return;
  if (mode === 'wish') wishState = cloneLook(state);
  else freeState = cloneLook(state);
  mode = nextMode;
  copyIntoState(mode === 'wish' ? wishState : freeState);
  persist();
  renderMode();
  renderStage();
  renderCharacterPicker();
  renderCategoryOptions();
  if (mode === 'wish') renderOrder();
  $('message').textContent = mode === 'wish' ? '回到愿望订单，帮朋友完成心愿吧' : '现在是你的设计时间';
}

function saveDesign() {
  if (mode !== 'free') return;
  const work = cloneLook(state);
  const key = lookKey(work);
  if (works.some(saved => lookKey(saved) === key)) {
    $('message').textContent = '这套作品已经在作品册里啦';
    return;
  }
  works = [work, ...works].slice(0, 12);
  persist();
  renderWorks();
  updateStats();
  $('message').textContent = '作品已放进作品册，随时可以再看';
}

function renderWorks() {
  const container = $('saved-works');
  if (!works.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-collection';
    empty.textContent = '还没有收藏作品，切到自由设计搭好一套就把它留下来吧。';
    container.replaceChildren(empty);
    return;
  }
  container.replaceChildren(...works.map((work, index) => {
    const card = document.createElement('article');
    card.className = 'work-card';
    card.dataset.index = String(index + 1);
    card.dataset.key = lookKey(work);
    for (const key of LOOK_KEYS) card.dataset[key] = work[key] || '';
    card.setAttribute('aria-label', `第 ${index + 1} 套作品，${labelFor(work.character)}，${lookSummary(work)}`);
    const svg = createLookSVG(work, {
      scene: true,
      label: `第 ${index + 1} 套作品：${labelFor(work.character)}`
    });
    const title = document.createElement('strong');
    title.textContent = `${index + 1}. ${labelFor(work.character)}`;
    const detail = document.createElement('small');
    detail.textContent = lookSummary(work);
    card.append(svg, title, detail);
    return card;
  }));
}

function init() {
  const saved = readSave();
  completedOrders = new Set(saved.completedOrders);
  works = normalizeWorks(saved.works);

  let requestedIndex = saved.orderId && orderById.has(saved.orderId)
    ? ORDERS.findIndex(order => order.id === saved.orderId)
    : safeIndex(saved.orderIndex);
  if (completedOrders.has(ORDERS[requestedIndex].id)) {
    requestedIndex = nextOpenOrder(requestedIndex + 1) ?? requestedIndex;
  }
  orderIndex = requestedIndex;
  const savedWish = saved.orderId === currentOrder().id ? normalizeLook(saved.wishState) : null;
  wishState = savedWish || baseWishLook(currentOrder());
  freeState = normalizeLook(saved.freeState) || cloneLook(DEFAULT_LOOK);
  copyIntoState(wishState);
  orderComplete = completedOrders.has(currentOrder().id);

  renderMode();
  renderCharacterPicker();
  renderCategoryTabs();
  renderCategoryOptions();
  renderOrder();
  renderStage();
  renderWorks();
  updateStats();
  updateSaveNote();

  $('mode-wish').addEventListener('click', () => switchMode('wish'));
  $('mode-free').addEventListener('click', () => switchMode('free'));
  $('check-order').addEventListener('click', checkOrder);
  $('next-order').addEventListener('click', nextOrder);
  $('random-inspiration').addEventListener('click', randomInspiration);
  $('reset-look').addEventListener('click', resetLook);
  $('save-design').addEventListener('click', saveDesign);
}

init();
