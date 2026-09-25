'use strict';

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const W = 540, H = 760, LANES = [110, 270, 430], PLAYER_Y = 656;
  const levels = [
    { name: '薄荷出发港', note: '先热热身，小怪们也刚刚睡醒。', waves: 9, color: '#e9e9fa' },
    { name: '草莓棉花云', note: '跟着小星星走，顺手收集火力糖果。', waves: 11, color: '#f3e6f0' },
    { name: '布丁小行星', note: '棉花糖大王出没！躲开红色预警。', waves: 9, boss: '棉花糖大王', color: '#f1ecdf' },
    { name: '苏打泡泡海', note: '泡泡怪来了，护盾是你的好朋友。', waves: 13, color: '#e0eff0' },
    { name: '蓝莓流星雨', note: '星星补给更多！试试星星冲击吧。', waves: 14, color: '#e6e6f6' },
    { name: '甜甜圈环岛', note: '甜甜圈船长喜欢换跑道，跟上它！', waves: 11, boss: '甜甜圈船长', color: '#f4e6ee' },
    { name: '蜜桃游乐园', note: '双倍快乐，更多糖果，更多小怪。', waves: 15, color: '#f3e7e3' },
    { name: '极光冰淇淋', note: '胜利就在前方，留好你的星星冲击。', waves: 16, color: '#e2edee' },
    { name: '月亮晚安站', note: '月亮瞌睡龙挡住了路，轻轻叫醒它。', waves: 12, boss: '月亮瞌睡龙', color: '#e7e2f2' },
    { name: '银河糖果城', note: '最后一站！和星云大魔王交个朋友。', waves: 13, boss: '星云大魔王', color: '#ece2ef' }
  ];
  const weaponNames = ['泡泡光弹', '双子糖弹', '三重星芒', '蜜糖连射', '彩虹光束', '银河喵喵炮'];
  // Damage is a per-volley budget, shared by all projectiles (not multiplied by their count).
  const WEAPONS = [
    { shots: 1, damage: 1, interval: .29, candy: 2 },
    { shots: 2, damage: 1.35, interval: .29, candy: 3 },
    { shots: 3, damage: 1.75, interval: .29, candy: 4 },
    { shots: 3, damage: 2.05, interval: .27, candy: 5 },
    { shots: 3, damage: 2.4, interval: .26, candy: 6 },
    { shots: 3, damage: 2.8, interval: .25, candy: 0 }
  ];
  const MAX_DAMAGE = 1.3, MAX_RATE = 1.2;
  let best = 0;
  try { best = Number(localStorage.getItem('meow-space-best')) || 0; } catch (_) { /* Storage is optional. */ }
  let state = 'start', level = 0, score = 0, kills = 0, elapsed = 0;
  let player, enemies = [], bullets = [], enemyBullets = [], pickups = [], particles = [], floaters = [], warnings = [];
  let boss = null, bossSpawned = false, wave = 0, waveTimer = 1, clearTimer = 0;
  let energy = 100, fireTimer = 0, clock = 0, lastTime = 0, hudTimer = 0, toastTimer = 0;
  let screenPulse = 0, checkpoint = null, soundOn = false, audio = null, nextId = 0;
  const stars = Array.from({ length: 65 }, (_, i) => ({ x: (i * 173.7 + 21) % W, y: (i * 97.3) % H, r: i % 4 === 0 ? 2.4 : 1.3, speed: 9 + i % 18, phase: i * 1.7 }));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function resetPlayer() {
    player = { lane: 1, x: LANES[1], hp: 5, maxHp: 5, weapon: 1, candy: 0, damage: 1, rate: 1, shield: 0, invincible: 0, magnet: false };
  }
  resetPlayer();

  function sound(kind) {
    if (!soundOn) return;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const o = audio.createOscillator(), g = audio.createGain();
      o.connect(g); g.connect(audio.destination);
      const t = audio.currentTime;
      const notes = { shot: [640, 350, .045, .022], hit: [170, 100, .09, .04], loot: [650, 1250, .16, .065], hurt: [220, 110, .18, .05], win: [520, 1040, .38, .07], burst: [160, 1100, .45, .06], move: [340, 480, .04, .02] };
      const [from, to, duration, volume] = notes[kind] || notes.loot;
      o.type = kind === 'hurt' ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + duration);
      g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(.001, t + duration);
      o.start(t); o.stop(t + duration);
    } catch (_) { /* Silent gameplay remains fully available. */ }
  }

  function toast(text) { $('toast').textContent = text; $('toast').classList.add('visible'); toastTimer = 2.3; }
  function overlay(html) { $('overlayContent').innerHTML = html; $('overlay').hidden = false; }
  function hideOverlay() { $('overlay').hidden = true; }
  const mascot = '<div class="start-mascot"><span class="mascot-spark">✧</span><div class="mascot-face"><span class="mascot-eyes">••</span><span class="mascot-mouth">ω</span><i class="mascot-cheek"></i><i class="mascot-cheek right"></i></div><div class="mascot-ship"></div></div>';

  function showStart() {
    overlay(`${mascot}<div class="overlay-eyebrow">READY, SET, MEOW!</div><h2>猫猫船长，出发！</h2><p>三条小跑道，十站甜蜜冒险。<br>自动开火，左右闪躲，把可爱带回家。</p><button class="primary-button" id="startButton">开始冒险 <span>↗</span></button><div class="start-info"><span>♡ 轻松不虐心</span><span>✧ 通关选强化</span><span>☁ 手机也能玩</span></div>`);
    $('startButton').onclick = newGame;
    updateHud();
  }

  function newGame() {
    resetPlayer(); score = 0; kills = 0; elapsed = 0; level = 0; energy = 100;
    startLevel();
  }

  function startLevel(retry = false) {
    if (retry && checkpoint) {
      player = { ...checkpoint.player, hp: checkpoint.player.maxHp, lane: 1, x: LANES[1], invincible: 2 };
      score = checkpoint.score; kills = checkpoint.kills; energy = 100;
    } else {
      checkpoint = { player: { ...player }, score, kills };
    }
    enemies = []; bullets = []; enemyBullets = []; pickups = []; particles = []; floaters = []; warnings = [];
    boss = null; bossSpawned = false; wave = 0; waveTimer = 1.2; clearTimer = 0; fireTimer = 0;
    player.lane = 1; player.x = LANES[1]; player.invincible = 1.4;
    state = 'playing'; hideOverlay(); updateHud();
    toast(`第 ${level + 1} 站 · ${levels[level].name}`);
  }

  function saveBest() {
    if (score > best) {
      best = score;
      try { localStorage.setItem('meow-space-best', String(best)); } catch (_) { /* Ignore unavailable storage. */ }
    }
  }

  function finishLevel() {
    if (state !== 'playing') return;
    score += 200 + (level + 1) * 30;
    player.hp = Math.min(player.maxHp, player.hp + 1);
    energy = Math.min(100, energy + 30);
    saveBest(); sound('win');
    if (level === 9) {
      state = 'win';
      overlay(`<div class="result-icon">🏆</div><div class="overlay-eyebrow">A LITTLE HERO, A BIG GALAXY</div><h2>银河因你而可爱！</h2><p>十个星球全部到站，坏蛋也变成了朋友。<br>奶糖队长，今天的你超级棒。</p><div class="result-stats"><div><strong>${score}</strong>本次得分</div><div><strong>${kills}</strong>击退小怪</div><div><strong>${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, '0')}</strong>航行时间</div></div><button class="primary-button" id="againButton">再来一次甜蜜冒险 ↗</button>`);
      $('againButton').onclick = newGame;
    } else {
      state = 'reward';
      const options = getRewards();
      overlay(`<div class="result-icon">🎁</div><div class="overlay-eyebrow">STAGE ${String(level + 1).padStart(2, '0')} COMPLETE</div><h2>好耶，又前进一站！</h2><p>已回复 1 颗爱心 · 额外补充 30% 能量<br>选一份旅途礼物，下一站更厉害。</p><div class="reward-options">${options.map((r, i) => `<button class="reward-option" data-reward="${i}"><span>${r.icon}</span><div><strong>${r.name}</strong><small>${r.desc}</small></div><b>↗</b></button>`).join('')}</div><p class="small-note">下一站：${levels[level + 1].name}${levels[level + 1].boss ? ' · BOSS 来啦！' : ''}</p>`);
      document.querySelectorAll('[data-reward]').forEach(button => button.onclick = () => {
        if (state !== 'reward') return;
        options[Number(button.dataset.reward)].apply(); level++; startLevel();
      });
    }
    updateHud();
  }

  function getRewards() {
    const attack = player.weapon < 6
      ? { icon: '🍬', name: '火力糖果小礼包', desc: '获得 2 颗升级糖果，累计进度提升武器', apply: () => addCandy(2) }
      : player.damage < MAX_DAMAGE
        ? { icon: '🌈', name: '浓缩彩虹糖', desc: '基础伤害加成 +10 个百分点，累计上限 30%', apply: () => { player.damage = Math.min(MAX_DAMAGE, player.damage + .1); } }
        : { icon: '⭐', name: '银河纪念星', desc: '火力加成已满，获得 300 分和 15% 能量', apply: () => { score += 300; energy = Math.min(100, energy + 15); } };
    const health = { icon: '💗', name: '超大爱心口袋', desc: player.maxHp < 8 ? '生命上限 +1，并回复全部生命' : '回复全部生命，并获得 2 层护盾', apply: () => { if (player.maxHp < 8) player.maxHp++; else player.shield = Math.min(6, player.shield + 2); player.hp = player.maxHp; } };
    const specials = [
      { icon: '🫧', name: '安心泡泡套装', desc: '获得 3 层护盾，能量立即充满', apply: () => { player.shield = Math.min(6, player.shield + 3); energy = 100; } },
      { icon: '⚡', name: '元气苏打水', desc: '基础射速加成 +10 个百分点，累计上限 20%', apply: () => player.rate = Math.min(MAX_RATE, player.rate + .1) },
      { icon: '🧲', name: '星星小磁铁', desc: '自动吸引相邻跑道的奖励，捡宝更轻松', apply: () => { player.magnet = true; player.shield = Math.min(6, player.shield + 1); } }
    ];
    let special = specials[level % 3];
    if ((player.magnet && level % 3 === 2) || (player.rate >= MAX_RATE && level % 3 === 1)) special = specials[0];
    return [attack, health, special];
  }

  function gameOver() {
    state = 'over'; saveBest(); updateHud();
    overlay(`<div class="result-icon">🌙</div><div class="overlay-eyebrow">TAKE A LITTLE BREAK</div><h2>休息一下，再出发。</h2><p>没关系，猫猫也需要打个盹。<br>可以满血重试本关，保留入关时的强化！</p><div class="result-stats"><div><strong>${String(level + 1).padStart(2, '0')} / 10</strong>已到达关卡</div><div><strong>${score}</strong>本次得分</div></div><button class="primary-button" id="retryButton">满血重试这一关 ♡</button><button class="secondary-button" id="restartButton">重新开始冒险</button>`);
    $('retryButton').onclick = () => startLevel(true);
    $('restartButton').onclick = newGame;
  }

  function pause() {
    if (state === 'playing') {
      state = 'paused';
      overlay(`${mascot}<div class="overlay-eyebrow">COFFEE BREAK IN SPACE</div><h2>宇宙暂停一下。</h2><p>小怪们也在等你。<br>按 P / Esc 或点击下方继续冒险。</p><button class="primary-button" id="resumeButton">继续冒险 ▷</button><button class="secondary-button" id="restartButton">重新开始</button>`);
      $('resumeButton').onclick = pause;
      $('restartButton').onclick = newGame;
    } else if (state === 'paused') { state = 'playing'; hideOverlay(); }
    updateHud();
  }

  function moveTo(lane) {
    if (state !== 'playing') return;
    const next = clamp(lane, 0, 2);
    if (next !== player.lane) { player.lane = next; sound('move'); updateLaneButtons(); }
  }

  function updateLaneButtons() {
    document.querySelectorAll('[data-lane]').forEach(b => {
      b.classList.toggle('selected', Number(b.dataset.lane) === player.lane);
      b.setAttribute('aria-pressed', String(Number(b.dataset.lane) === player.lane));
    });
  }

  function burst() {
    if (state !== 'playing' || energy < 100) return;
    energy = 0; screenPulse = .65;
    enemyBullets = []; warnings = [];
    for (const e of enemies) { e.hp -= 45 * player.damage; if (e.hp <= 0) destroyEnemy(e); }
    enemies = enemies.filter(e => e.hp > 0);
    if (boss) hurtBoss(Math.min(boss.maxHp * .12, 24 + player.weapon * 4));
    for (let i = 0; i < 45; i++) particles.push({ x: W / 2, y: PLAYER_Y - 60, vx: rand(-400, 400), vy: rand(-650, 80), life: rand(.6, 1.2), max: 1.2, r: rand(3, 7), color: pick(['#ffdc89', '#bda4ef', '#fff', '#9bdbca']), star: true });
    sound('burst'); toast('✷ 星星冲击！烦恼统统退散'); updateHud();
  }

  function spawnEnemy(lane, type = 0) {
    const hp = (type === 2 ? 4 : type === 1 ? 2.2 : 1.4) + level * .65;
    enemies.push({ id: nextId++, lane, x: LANES[lane], y: -45, hp, maxHp: hp, type, speed: (42 + level * 3.8 + (type === 0 ? 10 : 0)) * 1.25, r: type === 2 ? 31 : 25, t: rand(0, 6), shot: rand(3.3, 5.5), hit: 0 });
  }

  function spawnWave() {
    const first = Math.floor(Math.random() * 3);
    spawnEnemy(first, level < 2 ? wave % 2 : wave % 3);
    if (level >= 3 && wave % 3 === 1) spawnEnemy((first + 1 + wave % 2) % 3, 0);
    if (wave % 4 === 2) spawnPickup(LANES[(first + 1) % 3], -15, level === 4 ? 'star' : 'gun');
    if (wave === 5) spawnPickup(LANES[(first + 2) % 3], -65, 'heart');
    if (wave === 7 && level > 0) spawnPickup(LANES[(first + 1) % 3], -25, 'shield');
    wave++;
    waveTimer = Math.max(1.15, (2.25 - level * .09) * .85);
  }

  function spawnBoss() {
    bossSpawned = true;
    const hp = 105 + level * 35;
    boss = { x: 270, y: -100, targetLane: 1, hp, maxHp: hp, t: 0, moveTimer: 3.5, attackTimer: 2.6, attackCount: 0, hit: 0, r: 65 };
    toast(`⚑ ${levels[level].boss} · 来啦！`); sound('hit');
  }

  function shoot() {
    const weapon = WEAPONS[player.weapon - 1];
    const count = weapon.shots;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * 15;
      bullets.push({ x: player.x + offset, y: PLAYER_Y - 38, vy: -620, damage: player.damage * weapon.damage / count, r: player.weapon >= 5 ? 5.5 : 4, color: player.weapon >= 5 ? ['#e6a5d2', '#ac94e6', '#7fcfbd'][i % 3] : '#ac8be5' });
    }
    sound('shot');
    fireTimer = weapon.interval / player.rate;
  }

  function spawnPickup(x, y, type) { pickups.push({ x, y, type, r: 17, t: rand(0, 6), speed: type === 'star' ? 125 : 105 }); }
  function explode(x, y, colors, n = 12) {
    for (let i = 0; i < n; i++) {
      const life = rand(.3, .75);
      particles.push({ x, y, vx: rand(-110, 110), vy: rand(-120, 65), life, max: life, r: rand(2, 6), color: pick(colors), star: i % 3 === 0 });
    }
  }
  function floatText(x, y, text, color = '#9980be') { floaters.push({ x, y, text, color, life: 1.1 }); }

  function destroyEnemy(e) {
    score += e.type === 2 ? 60 : 30; kills++;
    explode(e.x, e.y, ['#d7c3ee', '#f0becd', '#fff']);
    floatText(e.x, e.y - 20, `+${e.type === 2 ? 60 : 30}`);
    if (kills % 10 === 0) spawnPickup(e.x, e.y, 'gun');
    else if (kills % 11 === 0 && player.hp < player.maxHp) spawnPickup(e.x, e.y, 'heart');
    else if (kills % 9 === 0) spawnPickup(e.x, e.y, 'shield');
    else if (Math.random() < .65) spawnPickup(e.x, e.y, 'star');
    sound('hit');
  }

  function hurtBoss(damage) {
    if (!boss) return;
    boss.hp -= damage; boss.hit = .08;
    if (boss.hp <= 0) {
      explode(boss.x, boss.y, ['#f3bfd6', '#baa0e8', '#ffdf91', '#fff'], 45);
      score += 500 + level * 80; kills++;
      floatText(boss.x, boss.y, '好耶！Boss 被打服啦', '#b58bcc');
      spawnPickup(110, boss.y + 20, 'heart'); spawnPickup(270, boss.y + 20, 'gun'); spawnPickup(430, boss.y + 20, 'star');
      boss = null; enemyBullets = []; warnings = []; sound('win');
      toast('Boss 投降啦！奖励正在送过来 ♡');
    }
  }

  function hurtPlayer() {
    if (player.invincible > 0 || state !== 'playing') return;
    player.invincible = 1.7;
    if (player.shield > 0) { player.shield--; floatText(player.x, PLAYER_Y - 70, '泡泡保护了你', '#6baa98'); sound('loot'); }
    else { player.hp--; floatText(player.x, PLAYER_Y - 70, '♡ -1', '#d991a9'); sound('hurt'); }
    explode(player.x, PLAYER_Y, ['#fff', '#f1b8ca', '#c3b0e7'], 8);
    updateHud();
    if (player.hp <= 0) gameOver();
  }

  function addCandy(amount) {
    player.candy += amount;
    while (player.weapon < 6 && player.candy >= WEAPONS[player.weapon - 1].candy) {
      player.candy -= WEAPONS[player.weapon - 1].candy;
      player.weapon++;
      toast(`火力升级！Lv.${player.weapon} ${weaponNames[player.weapon - 1]}`);
    }
    if (player.weapon === 6) player.candy = 0;
  }

  function collect(p) {
    sound('loot'); explode(p.x, p.y, ['#fff', '#f7d68a', '#cdb5ea'], 8);
    if (p.type === 'gun') {
      if (player.weapon < 6) {
        addCandy(1);
        floatText(p.x, p.y, player.weapon < 6 ? `糖果 ${player.candy}/${WEAPONS[player.weapon - 1].candy}` : '火力满级！');
      } else { score += 100; floatText(p.x, p.y, '满级火力 +100'); }
    } else if (p.type === 'heart') {
      if (player.hp < player.maxHp) { player.hp++; floatText(p.x, p.y, '生命 +1', '#d991a9'); }
      else { score += 80; floatText(p.x, p.y, '满满的爱 +80', '#d991a9'); }
    } else if (p.type === 'shield') { player.shield = Math.min(6, player.shield + 2); floatText(p.x, p.y, '护盾 +2', '#72aa96'); }
    else { score += 50; energy = Math.min(100, energy + 8); floatText(p.x, p.y, '✦ +50', '#bca057'); }
    updateHud();
  }

  function update(dt) {
    clock += dt;
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').classList.remove('visible'); }
    if (state !== 'playing') return;
    elapsed += dt;
    player.x += (LANES[player.lane] - player.x) * Math.min(1, dt * 16);
    player.invincible = Math.max(0, player.invincible - dt);
    energy = Math.min(100, energy + dt * 3.8);
    screenPulse = Math.max(0, screenPulse - dt);
    fireTimer -= dt;
    if (fireTimer <= 0) shoot();
    waveTimer -= dt;
    if (wave < levels[level].waves && waveTimer <= 0) spawnWave();
    if (wave >= levels[level].waves && enemies.length === 0 && levels[level].boss && !bossSpawned) spawnBoss();

    for (const e of enemies) {
      e.y += e.speed * dt; e.t += dt; e.hit = Math.max(0, e.hit - dt); e.shot -= dt;
      if (e.type > 0 && level >= 1 && e.y > 100 && e.y < 460 && e.shot <= 0) {
        enemyBullets.push({ x: e.x, y: e.y + 20, vx: 0, vy: (140 + level * 6) * 1.1, r: 8, color: '#dd9aaf' });
        e.shot = 4.5;
      }
      if (Math.abs(e.x - player.x) < e.r + 22 && Math.abs(e.y - PLAYER_Y) < e.r + 22) {
        e.hp = 0; explode(e.x, e.y, ['#d9c4eb', '#fff']); hurtPlayer();
        if (state !== 'playing') return;
      }
    }
    enemies = enemies.filter(e => e.hp > 0 && e.y < H + 50);

    if (boss) {
      boss.t += dt; boss.hit = Math.max(0, boss.hit - dt);
      boss.y += (190 - boss.y) * dt * 1.3;
      boss.x += (LANES[boss.targetLane] - boss.x) * Math.min(1, dt * 1.4);
      boss.moveTimer -= dt; boss.attackTimer -= dt;
      if (boss.moveTimer <= 0) { boss.targetLane = (boss.targetLane + 1 + (Math.random() < .5 ? 1 : 0)) % 3; boss.moveTimer = level >= 8 ? 3 : 4; }
      if (boss.attackTimer <= 0 && boss.y > 150) {
        const danger = boss.attackCount % 3 === 0 ? player.lane : Math.floor(Math.random() * 3);
        warnings.push({ lane: danger, t: 1.15, max: 1.15 });
        if (level >= 5 && boss.attackCount % 3 === 2) warnings.push({ lane: (danger + 1) % 3, t: 1.15, max: 1.15 });
        boss.attackCount++;
        boss.attackTimer = level === 9 ? 1.85 : 2.35;
      }
    }
    for (const warning of warnings) {
      warning.t -= dt;
      if (warning.t <= 0) {
        for (let j = 0; j < 3; j++) enemyBullets.push({ x: LANES[warning.lane], y: 220 - j * 45, vx: 0, vy: (205 + level * 5) * 1.08, r: 11, color: '#de97b2' });
      }
    }
    warnings = warnings.filter(w => w.t > 0);

    for (const b of bullets) {
      b.y += b.vy * dt;
      for (const e of enemies) {
        if (e.hp > 0 && Math.abs(b.x - e.x) < e.r + b.r && Math.abs(b.y - e.y) < e.r + 9) {
          e.hp -= b.damage; e.hit = .08; b.y = -100;
          if (e.hp <= 0) destroyEnemy(e);
          break;
        }
      }
      if (boss && b.y > 0 && Math.abs(b.x - boss.x) < 67 && Math.abs(b.y - boss.y) < 58) { hurtBoss(b.damage); b.y = -100; }
    }
    enemies = enemies.filter(e => e.hp > 0);
    bullets = bullets.filter(b => b.y > -30);
    for (const b of enemyBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (Math.hypot(b.x - player.x, b.y - PLAYER_Y) < 23 + b.r) {
        b.y = H + 100; hurtPlayer();
        if (state !== 'playing') return;
      }
    }
    enemyBullets = enemyBullets.filter(b => b.y < H + 30 && b.x > -30 && b.x < W + 30);
    for (const p of pickups) {
      p.t += dt; p.y += p.speed * dt;
      if (player.magnet && p.y > PLAYER_Y - 160 && Math.abs(p.x - player.x) < 200) p.x += (player.x - p.x) * dt * 6;
      if (Math.abs(p.x - player.x) < 47 && Math.abs(p.y - PLAYER_Y) < 37) { collect(p); p.y = H + 100; }
    }
    pickups = pickups.filter(p => p.y < H + 35);
    for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.life -= dt; }
    particles = particles.filter(p => p.life > 0);
    for (const f of floaters) { f.y -= dt * 30; f.life -= dt; }
    floaters = floaters.filter(f => f.life > 0);

    const allDone = wave >= levels[level].waves && enemies.length === 0 && (!levels[level].boss || bossSpawned && !boss);
    if (allDone) {
      clearTimer += dt;
      // Pull all remaining rewards in, so finishing a stage never loses a drop.
      for (const p of pickups) {
        p.x += (player.x - p.x) * Math.min(1, dt * 4);
        p.y += (PLAYER_Y - p.y) * Math.min(1, dt * 3);
      }
      if (clearTimer > 2.3) { for (const p of pickups) collect(p); pickups = []; finishLevel(); }
    } else clearTimer = 0;
    hudTimer -= dt;
    if (hudTimer <= 0) { updateHud(); hudTimer = .1; }
  }

  function updateHud() {
    $('levelName').textContent = levels[level].name;
    $('levelChip').textContent = `${String(level + 1).padStart(2, '0')} / 10`;
    $('missionNote').textContent = levels[level].note;
    $('hudLevel').textContent = String(level + 1).padStart(2, '0');
    $('hudStage').textContent = levels[level].name;
    $('score').textContent = String(score).padStart(5, '0');
    $('bestScore').textContent = `最佳 ${String(Math.max(best, score)).padStart(5, '0')}`;
    $('hearts').innerHTML = Array.from({ length: player.maxHp }, (_, i) => `<span${i >= player.hp ? ' class="empty"' : ''}>♥</span>`).join('');
    $('mobileHearts').textContent = '♥'.repeat(Math.max(0, player.hp)) + '♡'.repeat(player.maxHp - Math.max(0, player.hp));
    const weapon = WEAPONS[player.weapon - 1];
    const candyProgress = player.weapon < 6 ? `${player.candy}/${weapon.candy}` : 'MAX';
    $('mobileWeapon').textContent = `Lv.${player.weapon} · 糖 ${candyProgress} · ◇ ${player.shield}${player.magnet ? ' · 🧲' : ''}`;
    $('weaponText').textContent = `Lv.${player.weapon} · ${weaponNames[player.weapon - 1]}`;
    $('weaponTrack').style.width = `${player.weapon < 6 ? player.candy / weapon.candy * 100 : 100}%`;
    $('weaponTrack').parentElement.title = `升级糖果：${candyProgress}`;
    $('shieldText').textContent = player.shield ? `◇ 护盾 ×${player.shield}${player.magnet ? ' · 磁铁' : ''}` : player.magnet ? '🧲 磁铁已启动' : '护盾待补充';
    $('damageText').textContent = `糖 ${candyProgress} · 秒伤 ${(player.damage * weapon.damage * player.rate / weapon.interval).toFixed(1)}`;
    $('burstTrack').style.width = `${energy}%`;
    $('burstButton').disabled = state !== 'playing' || energy < 100;
    $('burstLabel').textContent = energy >= 100 ? '✦ 释放星星冲击' : `充能中 ${Math.floor(energy)}%`;
    $('bossHud').hidden = !boss;
    if (boss) { $('bossName').textContent = levels[level].boss; $('bossHealth').style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`; }
    const progress = levels[level].boss ? (bossSpawned ? (boss ? 65 + (1 - boss.hp / boss.maxHp) * 35 : 100) : wave / levels[level].waves * 65) : wave / levels[level].waves * 100;
    $('stageProgress').style.width = `${progress}%`;
    $('pauseButton').textContent = state === 'paused' ? '▷' : 'Ⅱ';
    $('pauseButton').disabled = !['playing', 'paused'].includes(state);
    $('pauseButton').setAttribute('aria-label', state === 'paused' ? '继续游戏' : '暂停游戏');
    $('route').innerHTML = levels.map((l, i) => `<i class="${i < level || state === 'win' ? 'done' : i === level ? 'active' : ''} ${l.boss ? 'boss' : ''}" title="第 ${i + 1} 关：${l.name}">${i < level || state === 'win' ? '✓' : l.boss ? '♛' : i + 1}</i>`).join('');
    updateLaneButtons();
  }

  // All characters are original vector drawings: crisp on phones and no asset downloads.
  function ellipse(x, y, rx, ry, fill, stroke, width = 2) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function roundRect(x, y, w, h, r, fill, stroke, width = 2) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
  }
  function line(x1, y1, x2, y2, color, width = 2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke(); }
  function star(x, y, r, color, rotation = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rotation); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, radius = i % 2 ? r * .35 : r; if (i === 0) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius); else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius); }
    ctx.closePath(); ctx.fillStyle = color; ctx.fill(); ctx.restore();
  }
  function face(x, y, size, happy = false) {
    const ink = '#6c5b7c';
    if (happy) {
      ctx.beginPath(); ctx.arc(x - size * .3, y, size * .12, Math.PI, 0); ctx.moveTo(x + size * .42, y); ctx.arc(x + size * .3, y, size * .12, Math.PI, 0); ctx.strokeStyle = ink; ctx.lineWidth = 2.5; ctx.stroke();
    } else { ellipse(x - size * .3, y, size * .065, size * .11, ink); ellipse(x + size * .3, y, size * .065, size * .11, ink); }
    ellipse(x - size * .53, y + size * .21, size * .18, size * .085, '#f1adbf'); ellipse(x + size * .53, y + size * .21, size * .18, size * .085, '#f1adbf');
    ctx.beginPath(); ctx.moveTo(x - size * .16, y + size * .2); ctx.quadraticCurveTo(x - size * .08, y + size * .37, x, y + size * .22); ctx.quadraticCurveTo(x + size * .08, y + size * .37, x + size * .16, y + size * .2); ctx.strokeStyle = ink; ctx.lineWidth = 1.8; ctx.stroke();
  }

  function drawBackground() {
    ctx.fillStyle = levels[level].color; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#f5f1ff44'); g.addColorStop(.6, '#ffffff00'); g.addColorStop(1, '#ded8f080'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // Soft orbital scenery.
    ctx.save(); ctx.globalAlpha = .4;
    ellipse(487, 203, 79, 79, '#cec3e5'); ellipse(462, 184, 13, 9, '#bcb0d5'); ellipse(509, 222, 20, 15, '#c0b4d9');
    ctx.save(); ctx.translate(484, 204); ctx.rotate(-.4); ellipse(0, 0, 108, 22, null, '#f8f5ff', 9); ctx.restore();
    ellipse(24, 472, 55, 55, '#d3c2e5'); ellipse(40, 451, 11, 9, '#c2b0d9');
    ellipse(400, 540, 33, 33, '#d3e5df');
    ctx.restore();
    for (let i = 0; i < 3; i++) {
      roundRect(LANES[i] - 66, 89, 132, H - 143, 35, i === player.lane ? '#ffffff16' : '#ffffff08');
    }
    ctx.setLineDash([4, 12]); line(190, 106, 190, H - 80, '#ffffff6b', 1.5); line(350, 106, 350, H - 80, '#ffffff6b', 1.5); ctx.setLineDash([]);
    for (const s of stars) {
      const y = (s.y + clock * s.speed) % H;
      ctx.globalAlpha = .4 + Math.sin(clock * 1.5 + s.phase) * .22;
      if (s.r > 2) star(s.x, y, s.r * 2, '#ffffff'); else ellipse(s.x, y, s.r, s.r, '#ffffff');
    }
    ctx.globalAlpha = 1;
    for (const w of warnings) {
      const a = .07 + (Math.sin(clock * 12) + 1) * .025;
      roundRect(LANES[w.lane] - 61, 242, 122, 453, 22, `rgba(216,118,154,${a})`, '#dc9bbd44', 1);
      ctx.fillStyle = '#bf7e9d'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', LANES[w.lane], 576);
      ctx.font = '10px sans-serif'; ctx.fillText('小心这条跑道', LANES[w.lane], 600);
    }
    ellipse(player.x, PLAYER_Y + 36, 46, 11, '#9c83bc20');
    for (let i = 0; i < 3; i++) {
      if (i === player.lane) { ctx.setLineDash([4, 5]); ellipse(LANES[i], PLAYER_Y + 38, 54, 15, null, '#b6a0d873', 1.5); ctx.setLineDash([]); }
    }
  }

  function drawPlayer() {
    ctx.save(); ctx.translate(player.x, PLAYER_Y);
    if (player.invincible > 0 && Math.floor(clock * 10) % 2 === 0 && state === 'playing') ctx.globalAlpha = .5;
    const bob = Math.sin(clock * 4) * 2;
    ctx.translate(0, bob);
    const flame = 13 + Math.sin(clock * 26) * 6;
    ellipse(-19, 31, 8, flame, '#ffdab0aa'); ellipse(19, 31, 8, flame, '#ffdab0aa');
    ellipse(-19, 29, 4, flame * .65, '#fff6d4'); ellipse(19, 29, 4, flame * .65, '#fff6d4');
    if (player.shield > 0) { ellipse(0, -5, 57, 59, '#b7eee416', '#a4d6cba0', 2); ctx.beginPath(); ctx.ellipse(0, -5, 51, 53, 0, 3.7, 4.8); ctx.strokeStyle = '#fffc'; ctx.lineWidth = 3; ctx.stroke(); }
    // Ears behind the helmet.
    ctx.beginPath(); ctx.moveTo(-30, -19); ctx.lineTo(-32, -53); ctx.quadraticCurveTo(-30, -58, -25, -53); ctx.lineTo(-8, -36); ctx.closePath(); ctx.fillStyle = '#fff9ee'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#8b799f'; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(30, -19); ctx.lineTo(32, -53); ctx.quadraticCurveTo(30, -58, 25, -53); ctx.lineTo(8, -36); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-26, -34); ctx.lineTo(-26, -47); ctx.lineTo(-15, -35); ctx.fillStyle = '#efb8c8'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(26, -34); ctx.lineTo(26, -47); ctx.lineTo(15, -35); ctx.fill();
    ellipse(0, -16, 35, 29, '#fffcf3', '#8b799f', 2.5);
    face(0, -21, 35);
    // The little captain's tuft.
    line(-5, -41, -1, -34, '#dcc9b7', 2); line(2, -42, 5, -36, '#dcc9b7', 2);
    ellipse(-39, 13, 14, 8, '#aa94d8', '#8a74b2', 2); ellipse(39, 13, 14, 8, '#aa94d8', '#8a74b2', 2);
    ellipse(0, 16, 44, 19, '#ad96df', '#8870b2', 2.5);
    ellipse(0, 10, 40, 12, '#c9b6ef');
    roundRect(-12, 8, 24, 16, 7, '#a58cd5', '#9277bd', 1);
    star(0, 16, 8, '#fff0b7');
    ellipse(-29, 13, 4, 3, '#fce5ae'); ellipse(29, 13, 4, 3, '#fce5ae');
    ctx.restore();
  }

  function drawEnemy(e) {
    ctx.save(); ctx.translate(e.x + Math.sin(e.t * 2) * 3, e.y); ctx.rotate(Math.sin(e.t * 2) * .065);
    const fill = e.hit > 0 ? '#fff' : ['#b8dace', '#f0b9cf', '#c5b4e8'][e.type];
    const edge = ['#83b09e', '#c58ca7', '#9982bd'][e.type];
    if (e.type === 0) {
      ellipse(-22, 5, 11, 7, '#cfe8dd', edge, 2); ellipse(22, 5, 11, 7, '#cfe8dd', edge, 2);
      ellipse(0, 0, 26, 22, fill, edge, 2);
      line(0, -22, 4, -32, edge, 2); ellipse(5, -33, 4, 4, '#f8dea2', edge, 1.5);
      face(0, -3, 24);
    } else if (e.type === 1) {
      ellipse(-15, -19, 10, 18, fill, edge, 2); ellipse(15, -19, 10, 18, fill, edge, 2);
      ellipse(-15, -21, 4, 10, '#f9d4e0'); ellipse(15, -21, 4, 10, '#f9d4e0');
      ellipse(0, 2, 27, 24, fill, edge, 2); face(0, -2, 25);
      ellipse(0, 23, 32, 7, '#d9a0bc', edge, 1.5); star(0, 24, 4, '#fff1ce');
    } else {
      ellipse(-22, -18, 12, 12, fill, edge, 2); ellipse(22, -18, 12, 12, fill, edge, 2);
      roundRect(-30, -23, 60, 51, 23, fill, edge, 2);
      roundRect(-33, 12, 66, 17, 8, '#b09ad8', edge, 1.5);
      face(0, -4, 28); star(0, -25, 8, '#fbe3a0');
      ellipse(-20, 23, 3, 3, '#e8ddff'); ellipse(20, 23, 3, 3, '#e8ddff');
    }
    if (e.hp < e.maxHp) { roundRect(-19, 38, 38, 3, 2, '#fff8'); roundRect(-19, 38, 38 * e.hp / e.maxHp, 3, 2, edge); }
    ctx.restore();
  }

  function drawBoss() {
    if (!boss) return;
    ctx.save(); ctx.translate(boss.x, boss.y + Math.sin(boss.t * 2) * 5);
    const index = level === 2 ? 0 : level === 5 ? 1 : level === 8 ? 2 : 3;
    const fill = boss.hit > 0 ? '#fff7fd' : ['#f4c4d3', '#e8c19f', '#beb3e4', '#c9afe4'][index];
    const edge = ['#c08b9f', '#bd957d', '#9583b8', '#9f7fbe'][index];
    ellipse(-64, 12, 22, 13, fill, edge, 3); ellipse(64, 12, 22, 13, fill, edge, 3);
    if (index >= 2) {
      ctx.beginPath(); ctx.moveTo(-42, -20); ctx.lineTo(-64, -71); ctx.lineTo(-14, -46); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(42, -20); ctx.lineTo(64, -71); ctx.lineTo(14, -46); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else { ellipse(-37, -36, 25, 25, fill, edge, 3); ellipse(37, -36, 25, 25, fill, edge, 3); }
    ellipse(0, 0, 64, 53, fill, edge, 3);
    ellipse(0, 18, 42, 29, index === 1 ? '#f8dec4' : '#f8edf666');
    face(0, -5, 61, boss.hp < boss.maxHp * .25);
    if (index === 1) {
      roundRect(-46, -41, 92, 15, 7, '#e99fb9', '#cd91a6', 2);
      for (let i = 0; i < 5; i++) line(-31 + i * 15, -37, -26 + i * 15, -32, i % 2 ? '#fff1bd' : '#d2bbf5', 3);
    } else {
      ctx.beginPath(); ctx.moveTo(-21, -44); ctx.lineTo(-27, -72); ctx.lineTo(-10, -62); ctx.lineTo(0, -79); ctx.lineTo(12, -62); ctx.lineTo(27, -72); ctx.lineTo(22, -44); ctx.closePath(); ctx.fillStyle = '#f8db94'; ctx.fill(); ctx.strokeStyle = '#c7a566'; ctx.lineWidth = 2.5; ctx.stroke(); star(0, -57, 6, '#fff5d0');
    }
    ellipse(-35, 47, 19, 11, fill, edge, 2); ellipse(35, 47, 19, 11, fill, edge, 2);
    if (index === 3) { star(-79, -36, 10, '#f4d698', clock); star(80, -40, 8, '#f4d698', -clock); }
    ctx.restore();
  }

  function drawPickup(p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(p.t * 3) * .1);
    const colors = { gun: ['#eee1ff', '#b296db'], heart: ['#ffebf0', '#e5a0b8'], shield: ['#e1f6eb', '#87bca5'], star: ['#fff4d5', '#d5b365'] };
    const [fill, edge] = colors[p.type];
    ellipse(0, 0, 22 + Math.sin(p.t * 4) * 2, 22 + Math.sin(p.t * 4) * 2, '#ffffff35');
    roundRect(-16, -17, 32, 34, 11, fill, '#fff', 2.5);
    if (p.type === 'star') star(0, 0, 12, edge);
    else if (p.type === 'gun') { line(0, 9, 0, -9, edge, 4); line(-7, -2, 0, -9, edge, 4); line(7, -2, 0, -9, edge, 4); }
    else if (p.type === 'heart') {
      ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-24, -4, -6, -18, 0, -6); ctx.bezierCurveTo(6, -18, 24, -4, 0, 10); ctx.fillStyle = edge; ctx.fill();
    } else {
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(10, -6); ctx.lineTo(8, 5); ctx.lineTo(0, 12); ctx.lineTo(-8, 5); ctx.lineTo(-10, -6); ctx.closePath(); ctx.fillStyle = edge; ctx.fill(); line(-4, 0, 0, 4, '#eafff2', 2); line(0, 4, 5, -3, '#eafff2', 2);
    }
    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    for (const b of bullets) {
      roundRect(b.x - b.r - 2, b.y - 8, b.r * 2 + 4, 24, 7, '#ffffff44');
      roundRect(b.x - b.r, b.y - 10, b.r * 2, 21, b.r, b.color);
      roundRect(b.x - 1.4, b.y - 7, 2.8, 10, 2, '#fff9');
    }
    for (const e of enemies) drawEnemy(e);
    drawBoss();
    for (const b of enemyBullets) { ellipse(b.x, b.y, b.r + 3, b.r + 3, '#fff6'); ellipse(b.x, b.y, b.r, b.r, b.color, '#bd7e9d', 1.5); ellipse(b.x - 2, b.y - 3, b.r * .3, b.r * .22, '#ffe4ef'); }
    for (const p of pickups) drawPickup(p);
    drawPlayer();
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.star) star(p.x, p.y, p.r, p.color, p.life * 3); else ellipse(p.x, p.y, p.r, p.r, p.color);
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = f.color; ctx.font = 'bold 15px "Noto Sans SC", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;
    if (screenPulse > 0) {
      const r = (1 - screenPulse / .65) * 900;
      ctx.globalAlpha = screenPulse * .65; ellipse(player.x, PLAYER_Y, r, r, null, '#fff8d7', 35); ctx.globalAlpha = 1;
    }
  }

  function frame(now) {
    const dt = Math.min((now - (lastTime || now)) / 1000, .04);
    lastTime = now; update(dt); render(); requestAnimationFrame(frame);
  }

  document.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.toLowerCase();
    const onButton = event.target instanceof HTMLButtonElement && event.target.getClientRects().length > 0;
    if (['arrowleft', 'arrowright', 'a', 'd'].includes(key)) {
      if (state === 'playing') { event.preventDefault(); moveTo(player.lane + (key === 'arrowleft' || key === 'a' ? -1 : 1)); }
    } else if (key === ' ' && !onButton && state === 'playing') { event.preventDefault(); if (!event.repeat) burst(); }
    else if ((key === 'p' || key === 'escape') && !event.repeat) { event.preventDefault(); pause(); }
    else if (key === 'enter' && state === 'start' && !onButton) { event.preventDefault(); newGame(); }
  });
  document.querySelectorAll('[data-lane]').forEach(button => button.onclick = () => moveTo(Number(button.dataset.lane)));
  let pointer = null;
  canvas.addEventListener('pointerdown', event => {
    if (state !== 'playing') return;
    pointer = { id: event.pointerId, x: event.clientX, lane: player.lane };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const delta = event.clientX - pointer.x;
    if (Math.abs(delta) > 24) moveTo(pointer.lane + (delta > 0 ? 1 : -1));
    else { const rect = canvas.getBoundingClientRect(); moveTo(Math.floor((event.clientX - rect.left) / rect.width * 3)); }
    pointer = null;
  });
  canvas.addEventListener('pointercancel', () => { pointer = null; });
  $('pauseButton').onclick = pause;
  $('burstButton').onclick = burst;
  $('soundButton').onclick = () => {
    soundOn = !soundOn;
    $('soundButton').innerHTML = soundOn ? '♫' : '♫<span class="sound-slash"></span>';
    $('soundButton').setAttribute('aria-label', soundOn ? '关闭声音' : '打开声音');
    $('soundButton').title = soundOn ? '关闭声音' : '打开声音';
    if (soundOn) sound('loot');
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'playing') pause(); });
  window.addEventListener('blur', () => { if (state === 'playing') pause(); });
  showStart(); requestAnimationFrame(frame);
})();
