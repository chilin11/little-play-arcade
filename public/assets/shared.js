const FAVORITES_KEY = 'little-play:favorites:v1';
const RECENT_KEY = 'little-play:recent:v1';
const memory = new Map();
let storageWarningShown = false;
let toastTimer;

export function notify(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

function readList(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string'))].slice(0, 200) : [];
  } catch { return []; }
}

function writeList(key, values) {
  memory.set(key, values);
  try {
    localStorage.setItem(key, JSON.stringify(values));
    memory.delete(key);
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      notify('浏览器存储不可用，收藏和记录仅在本页临时保留。');
    }
    return false;
  }
  return true;
}

export const getFavorites = () => readList(FAVORITES_KEY);
export const getRecent = () => readList(RECENT_KEY);
export const clearRecent = () => writeList(RECENT_KEY, []);
export function toggleFavorite(id) {
  const favorites = getFavorites();
  const added = !favorites.includes(id);
  const saved = writeList(FAVORITES_KEY, added ? [...favorites, id] : favorites.filter(item => item !== id));
  if (saved) notify(added ? '已收藏，下次来大厅就能找到它。' : '已取消收藏。');
  return added;
}
export function recordPlay(id) {
  writeList(RECENT_KEY, [id, ...getRecent().filter(item => item !== id)].slice(0, 12));
}

// The catalog only accepts local assets. Query-string input is never used as an iframe URL.
export function isLocalPath(value, extension) {
  return typeof value === 'string'
    && /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+$/.test(value)
    && !value.split('/').some(part => part === '.' || part === '..')
    && (!extension || value.endsWith(extension));
}
export async function loadGames() {
  const response = await fetch(new URL('../games.json', import.meta.url), { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Catalog HTTP ${response.status}`);
  const games = await response.json();
  if (!Array.isArray(games)) throw new Error('Catalog must be an array');
  const ids = new Set();
  for (const game of games) {
    if (!game || typeof game.id !== 'string' || !/^[a-z0-9-]+$/.test(game.id) || ids.has(game.id)
      || !['title', 'subtitle', 'description', 'category', 'controls', 'note', 'addedAt'].every(key => typeof game[key] === 'string')
      || !Array.isArray(game.tags) || !game.tags.every(tag => typeof tag === 'string')
      || !Array.isArray(game.devices) || !game.devices.every(device => typeof device === 'string')
      || !isLocalPath(game.entry, '.html') || !game.entry.startsWith('games/')
      || !isLocalPath(game.cover) || !game.cover.startsWith('assets/')) {
      throw new Error('Invalid game catalog entry');
    }
    ids.add(game.id);
  }
  return games;
}

export const playUrl = game => `play.html?game=${encodeURIComponent(game.id)}`;
export const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

export function recentCard(game, caption = '再玩一次') {
  const card = document.createElement('a');
  card.className = 'recent-card';
  card.href = playUrl(game);
  card.innerHTML = `<img src="${escapeHTML(game.cover)}" alt="" loading="lazy" width="68" height="57"><div><strong>${escapeHTML(game.title)}</strong><small>${escapeHTML(caption)} · ${escapeHTML(game.category)}</small></div><span aria-hidden="true">↗</span>`;
  return card;
}

export function syncFavoriteButton(button, game, compact = false) {
  const selected = getFavorites().includes(game.id);
  button.setAttribute('aria-pressed', String(selected));
  button.setAttribute('aria-label', `${selected ? '取消收藏' : '收藏'}${game.title}`);
  button.title = `${selected ? '取消收藏' : '收藏'}${game.title}`;
  button.textContent = compact ? (selected ? '♥' : '♡') : (selected ? '♥ 已收藏' : '♡ 收藏');
}
