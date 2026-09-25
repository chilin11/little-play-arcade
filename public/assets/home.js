import { loadGames, getFavorites, getRecent, clearRecent, toggleFavorite, playUrl, escapeHTML, recentCard, syncFavoriteButton, notify } from './shared.js';

const $ = id => document.getElementById(id);
let games = [];
let activeFilter = 'all';
let ready = false;
let spotlightMode = 'newest';
const addedTime = game => Number.isFinite(Date.parse(game.addedAt)) ? Date.parse(game.addedAt) : 0;
const newestFirst = (a, b) => addedTime(b) - addedTime(a);

// Optional editorial metadata never blocks the main catalog. Dates, then featured,
// are the only selection inputs; no game IDs or invented age ratings are needed.
function renderSpotlight() {
  const section = $('spotlight-section');
  if (!section) return;
  const newest = games.filter(game => addedTime(game) > 0).sort(newestFirst);
  const featured = games.filter(game => game.featured === true).sort(newestFirst);
  const pool = spotlightMode === 'featured' ? featured : newest;
  const selected = (pool.length ? pool : spotlightMode === 'featured' ? newest : featured).slice(0, 2);
  if (!selected.length) { section.hidden = true; return; }
  if (!pool.length) spotlightMode = spotlightMode === 'featured' ? 'newest' : 'featured';
  document.querySelectorAll('[data-spotlight]').forEach(button => {
    button.disabled = !(button.dataset.spotlight === 'featured' ? featured : newest).length;
    button.setAttribute('aria-pressed', String(button.dataset.spotlight === spotlightMode));
  });
  $('spotlight-games').replaceChildren(...selected.map((game, index) => {
    const link = document.createElement('a');
    link.className = `spotlight-card spotlight-card-${index + 1}`;
    link.href = playUrl(game);
    link.innerHTML = `<img src="${escapeHTML(game.cover)}" alt="" width="600" height="350"><div class="spotlight-copy"><span class="spotlight-kicker">${spotlightMode === 'featured' ? '本周推荐' : '新作上架'} · ${escapeHTML(game.category)}</span><h3>${escapeHTML(game.title)}</h3><p>${game.tags.slice(0, 3).map(escapeHTML).join(' · ')}</p><span class="spotlight-action">开始玩 <span aria-hidden="true">↗</span></span></div>`;
    return link;
  }));
  section.hidden = false;
  $('spotlight-status').textContent = `${spotlightMode === 'featured' ? '本周推荐' : '新作上架'}：${selected.map(game => game.title).join('、')}`;
}

function renderDiscovery() {
  if (!$('quick-picks')) return;
  const tags = [...new Set(games.flatMap(game => game.tags))];
  const ages = tags.filter(tag => /\d.*岁/.test(tag)).slice(0, 2);
  const moods = ['创意', '策略', '反应', '记忆'].filter(tag => tags.includes(tag));
  $('quick-picks').replaceChildren(...[...ages, ...moods].map(tag => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.quickPick = tag;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `${escapeHTML(tag)} <span>${games.filter(game => game.tags.includes(tag)).length} 款</span>`;
    button.addEventListener('click', () => {
      $('search').value = $('search').value === tag && activeFilter === 'all' ? '' : tag;
      activeFilter = 'all';
      renderGames();
    });
    return button;
  }));
  $('collection-overview').textContent = `${games.length} 款游戏 · ${new Set(games.map(game => game.category)).size} 种分类 · 不用下载，打开就玩`;
  $('collection-discovery').hidden = !games.length;
}

document.querySelectorAll('[data-spotlight]').forEach(button => {
  button.addEventListener('click', () => { spotlightMode = button.dataset.spotlight; renderSpotlight(); });
});

function gameCard(game) {
  const card = document.createElement('article');
  card.className = `game-card ${['lavender', 'apricot', 'sage'].includes(game.color) ? game.color : 'sage'}`;
  const href = playUrl(game);
  card.innerHTML = `<a class="game-cover-link" href="${href}" aria-label="开始玩${escapeHTML(game.title)}"><img class="game-cover" src="${escapeHTML(game.cover)}" alt="${escapeHTML(game.title)}游戏插画" width="600" height="350" loading="lazy">${game.badge ? `<span class="card-badge">${escapeHTML(game.badge)}</span>` : ''}</a>
    <button class="favorite-button" type="button"></button>
    <div class="card-content"><div class="card-category"><span>${escapeHTML(game.subtitle)}</span><span>${escapeHTML(game.category)}</span></div><h3><a href="${href}">${escapeHTML(game.title)}</a></h3><p>${escapeHTML(game.description)}</p><div class="card-tags">${game.tags.slice(0, 3).map(tag => `<span>${escapeHTML(tag)}</span>`).join('')}</div><div class="card-bottom"><span class="card-device"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="15" height="12" rx="2"/><path d="M7 19h6m-3-4v4"/><rect x="17" y="10" width="5" height="10" rx="1"/></svg>${escapeHTML(game.devices.join(' / '))}</span><a class="play-link" href="${href}" aria-label="开始玩${escapeHTML(game.title)}">开始玩 <span aria-hidden="true">↗</span></a></div></div>`;
  const button = card.querySelector('.favorite-button');
  syncFavoriteButton(button, game, true);
  button.addEventListener('click', () => {
    toggleFavorite(game.id);
    if (activeFilter === 'favorites') {
      // Keep keyboard focus useful if removing the focused card from this view.
      renderGames();
      ($('game-grid').querySelector('.favorite-button') || $('reset-filters')).focus();
    } else syncFavoriteButton(button, game, true);
    updateFavoriteCount();
  });
  return card;
}

function updateFavoriteCount() {
  $('favorite-count').textContent = games.filter(game => getFavorites().includes(game.id)).length;
}

function renderGames() {
  if (!ready) return;
  const query = $('search').value.trim().toLocaleLowerCase();
  const favorites = getFavorites();
  const filtered = games.filter(game => {
    const matchesFilter = activeFilter === 'all' || (activeFilter === 'favorites' ? favorites.includes(game.id) : game.category === activeFilter);
    const searchText = [game.title, game.subtitle, game.description, game.category, ...game.tags, ...game.devices].join(' ').toLocaleLowerCase();
    return matchesFilter && query.split(/\s+/).every(word => searchText.includes(word));
  });
  const sort = $('sort').value;
  filtered.sort((a, b) => sort === 'name' ? a.title.localeCompare(b.title, 'zh-CN') : sort === 'newest' ? newestFirst(a, b) : Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
  $('game-grid').replaceChildren(...filtered.map(gameCard));
  $('game-grid').hidden = filtered.length === 0;
  $('empty-state').hidden = filtered.length > 0;
  $('empty-message').textContent = activeFilter === 'favorites' && !query ? '遇到喜欢的游戏，点一下卡片右上角的爱心，就能收藏在这里。' : '试试其他关键词，或看看全部游戏。';
  $('results-status').textContent = `找到 ${filtered.length} 个游戏`;
  document.querySelectorAll('[data-quick-pick]').forEach(button => {
    button.setAttribute('aria-pressed', String(activeFilter === 'all' && query === button.dataset.quickPick.toLocaleLowerCase()));
  });
  document.querySelectorAll('[data-filter]').forEach(button => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $('nav-favorites').classList.toggle('active', activeFilter === 'favorites');
  document.querySelector('.main-nav > a:first-child').classList.toggle('active', activeFilter !== 'favorites');
}

function renderRecent() {
  const recent = getRecent().map(id => games.find(game => game.id === id)).filter(Boolean).slice(0, 6);
  $('recent-section').hidden = recent.length === 0;
  $('recent-games').replaceChildren(...recent.map(game => recentCard(game)));
}

$('filters').addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeFilter = button.dataset.filter;
  renderGames();
});
$('search').addEventListener('input', renderGames);
$('sort').addEventListener('change', renderGames);
$('nav-favorites').addEventListener('click', () => {
  activeFilter = 'favorites';
  $('search').value = '';
  renderGames();
});
document.querySelector('.main-nav > a:first-child').addEventListener('click', () => {
  activeFilter = 'all';
  $('search').value = '';
  renderGames();
});
$('reset-filters').addEventListener('click', () => {
  activeFilter = 'all';
  $('search').value = '';
  renderGames();
  document.querySelector('[data-filter="all"]').focus();
});
$('clear-recent').addEventListener('click', () => {
  clearRecent();
  renderRecent();
  $('search').focus({ preventScroll: true });
});
document.querySelectorAll('.random-button').forEach(button => {
  button.disabled = true;
  button.addEventListener('click', () => {
    if (games.length) location.href = playUrl(games[Math.floor(Math.random() * games.length)]);
  });
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
    && !event.target.closest('input, textarea, select, [contenteditable="true"]')) {
    event.preventDefault();
    $('search').focus();
  }
});
function syncState() {
  if (!ready) return;
  updateFavoriteCount();
  renderGames();
  renderRecent();
}
window.addEventListener('storage', syncState);
window.addEventListener('pageshow', syncState);

async function init() {
  try {
    games = await loadGames();
    ready = true;
    $('game-total').textContent = String(games.length).padStart(2, '0');
    const favoriteFilter = document.querySelector('[data-filter="favorites"]');
    for (const category of [...new Set(games.map(game => game.category))]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.filter = category;
      button.textContent = category;
      button.setAttribute('aria-pressed', 'false');
      $('filters').insertBefore(button, favoriteFilter);
    }
    document.querySelectorAll('.random-button').forEach(button => { button.disabled = games.length === 0; });
    renderSpotlight();
    renderDiscovery();
    syncState();
  } catch (error) {
    console.error('Unable to load games:', error);
    if ($('spotlight-section')) $('spotlight-section').hidden = true;
    if ($('collection-discovery')) $('collection-discovery').hidden = true;
    $('game-grid').replaceChildren();
    const message = document.createElement('div');
    message.className = 'loading-state';
    message.innerHTML = '<p>游戏列表暂时没有打开，请检查网络后重试。</p><button type="button" class="button button-outline">重新加载 ↻</button>';
    message.querySelector('button').addEventListener('click', () => location.reload());
    $('game-grid').append(message);
    notify('请通过网站服务器访问，不要直接双击 HTML 文件。');
  } finally {
    $('game-grid').setAttribute('aria-busy', 'false');
  }
}
init();
