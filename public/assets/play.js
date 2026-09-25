import { loadGames, recordPlay, toggleFavorite, syncFavoriteButton, recentCard, notify } from './shared.js';

const $ = id => document.getElementById(id);
const frame = $('game-frame');
let game;
let slowTimer;

function startLoading() {
  $('player-status').textContent = '正在加载游戏…';
  clearTimeout(slowTimer);
  slowTimer = setTimeout(() => {
    $('player-status').textContent = '加载较慢，可重载或独立打开';
  }, 12000);
}

async function init() {
  try {
    const games = await loadGames();
    const id = new URLSearchParams(location.search).get('game');
    game = games.find(item => item.id === id);
    if (!game) throw new Error('Unknown game');
    document.title = `${game.title} · 在线玩 · 玩一会儿`;
    document.querySelector('meta[name="description"]').content = game.description;
    for (const [element, field] of [['game-title', 'title'], ['game-subtitle', 'subtitle'], ['game-description', 'description'], ['game-controls', 'controls'], ['game-note', 'note']]) {
      $(element).textContent = game[field];
    }
    syncFavoriteButton($('play-favorite'), game);
    $('play-favorite').addEventListener('click', () => {
      toggleFavorite(game.id);
      syncFavoriteButton($('play-favorite'), game);
    });
    window.addEventListener('storage', () => syncFavoriteButton($('play-favorite'), game));
    const entryUrl = new URL(game.entry, location.href);
    $('open-game').href = entryUrl.href;
    const entryResponse = await fetch(entryUrl, { method: 'HEAD', cache: 'no-cache' });
    if (!entryResponse.ok) throw new Error(`Game HTTP ${entryResponse.status}`);
    frame.title = `${game.title}游戏`;
    frame.addEventListener('load', () => {
      clearTimeout(slowTimer);
      $('player-status').textContent = '已就绪 · 点击游戏区域开始玩';
      recordPlay(game.id);
    });
    frame.addEventListener('error', () => {
      clearTimeout(slowTimer);
      $('player-status').textContent = '加载失败，请重载或独立打开';
    });
    $('play-content').hidden = false;
    startLoading();
    frame.src = entryUrl.href;
    $('more-games').replaceChildren(...games.filter(item => item.id !== game.id).slice(0, 3).map(item => recentCard(item, '试试这个')));
    document.querySelector('.more-section').hidden = games.length < 2;
  } catch (error) {
    console.error('Unable to open game:', error);
    $('play-error').hidden = false;
  } finally {
    $('play-loading').hidden = true;
  }
}

$('share-game').addEventListener('click', async () => {
  const url = new URL('play.html', location.href);
  url.searchParams.set('game', game.id);
  try {
    await navigator.clipboard.writeText(url.href);
    notify('游戏链接已复制，分享给朋友一起玩吧。');
  } catch {
    // Clipboard access needs HTTPS on non-localhost domains. Manual copy remains available.
    window.prompt('复制这个链接，分享给朋友：', url.href);
  }
});
$('reload-game').addEventListener('click', () => $('reload-dialog').showModal());
$('reload-dialog').addEventListener('close', () => {
  if ($('reload-dialog').returnValue !== 'reload') return;
  startLoading();
  frame.src = new URL(game.entry, location.href).href;
});
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('game-area').requestFullscreen) await $('game-area').requestFullscreen();
    else notify('当前浏览器不支持页面全屏，可用「独立打开」获得更大画面。');
  } catch { notify('无法进入全屏，请尝试「独立打开」。'); }
});
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').textContent = document.fullscreenElement ? '⛶ 退出全屏' : '⛶ 全屏';
});
init();
