import { initializeApp }   from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion,
         collection, query, where, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import firebaseConfig        from './firebase-config.js';
import { isValidWord, randomPrompt } from './words.js';

// ── Firebase ───────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Client state ───────────────────────────────────────────────────────────
const myId   = crypto.randomUUID();
let myName   = '';
let roomId   = '';
let isHost   = false;
let lastRoom = null;
let roomUnsub = null;
let homeUnsub = null;   // listening to public lobbies
let timerRAF  = null;
let tickTO    = null;
let gameClockTO = null;
let submitting  = false;

// ── Default settings ───────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  difficulty:    'beginner',
  minDuration:   10,        // seconds
  maxPromptAge:  2,
  passAroundMode: false,    // if true, prompt changes after all living players have failed
  startingLives: 2,
  maxLives:      3,
  maxPlayers:    16,
  bonusAlphabet: Object.fromEntries(
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l =>
      [l, (l === 'X' || l === 'Z') ? 0 : 1]
    )
  ),
};

// ── DOM helpers ────────────────────────────────────────────────────────────
// Null-safe wrapper: if the element doesn't exist, return a no-op proxy
// so missing DOM (cached HTML, typos) never crashes the script.
const NULL_EL = new Proxy(function(){}, {
  get(_, prop) {
    if (prop === 'style' || prop === 'classList' || prop === 'dataset') return NULL_EL;
    if (prop === 'value' || prop === 'textContent' || prop === 'innerHTML' || prop === 'checked') return '';
    return () => {};
  },
  set() { return true; },
  apply() { return undefined; },
});
const $ = id => document.getElementById(id) || NULL_EL;
const views = { home: $('view-home'), lobby: $('view-lobby'), game: $('view-game'), gameover: $('view-gameover') };

// ── Random name generator ─────────────────────────────────────────────────
const NAME_ADJS  = ['Speedy','Wild','Sharp','Brave','Witty','Sneaky','Lucky','Cosmic','Magic','Sparkly','Fierce','Zippy','Sassy','Vibrant','Daring','Spicy','Funky','Cool','Wacky','Silly','Stormy','Mighty','Plucky','Brilliant','Crispy','Bouncy','Cheeky','Glowing','Snazzy','Quirky','Royal'];
const NAME_NOUNS = ['Fox','Bear','Tiger','Eagle','Wolf','Panda','Shark','Phoenix','Dragon','Hawk','Penguin','Otter','Sloth','Koala','Ninja','Wizard','Pirate','Yeti','Falcon','Raven','Cat','Owl','Bunny','Toad','Mango','Pickle','Comet','Star','Llama','Whale','Goose','Beaver','Lemur','Moth','Squid'];
function randomName() {
  return NAME_ADJS[Math.floor(Math.random()*NAME_ADJS.length)] +
         NAME_NOUNS[Math.floor(Math.random()*NAME_NOUNS.length)];
}
function showView(name) { Object.values(views).forEach(v => v.classList.remove('active')); views[name].classList.add('active'); }

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function avatarColor(name) {
  const palette = ['#5b7fcc','#7c5bbf','#c05050','#5ba87c','#b87c2a','#50a0b0','#a05080','#6a8a40'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length];
}

function hearts(lives, maxLives) {
  return Array.from({length: maxLives}, (_,i) =>
    `<span class="pheart${i >= lives ? ' lost' : ''}">❤</span>`
  ).join('');
}

// ── Audio (Web Audio API) ──────────────────────────────────────────────────
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTick() {
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(680, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  } catch(e) {}
}

function playExplosion() {
  try {
    const ctx = getAudio();
    const dur = 1.2;
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(2, sr * dur, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        const t = i / sr;
        d[i] = (Math.random() * 2 - 1) * Math.exp(-t * 4.5) * 0.9;
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    const gain = ctx.createGain(); gain.gain.value = 1;
    src.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    src.start();

    // rumble
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.connect(og); og.connect(ctx.destination);
    osc.type = 'sawtooth'; osc.frequency.value = 55;
    og.gain.setValueAtTime(0.3, ctx.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(); osc.stop(ctx.currentTime + 0.6);
  } catch(e) {}
}

function playBonusLife() {
  try {
    const ctx = getAudio();
    [523, 659, 784, 1047].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0.15, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t); osc.stop(t + 0.18);
    });
  } catch(e) {}
}

// Schedule ticking — silent until the last ~3s, then accelerates
function startTicking(startTime, duration) {
  stopTicking();
  function tick() {
    const remaining = duration - (Date.now() - startTime);
    if (remaining <= 0) return;

    // Stay silent until 3 seconds left
    if (remaining > 3000) {
      tickTO = setTimeout(tick, remaining - 3000 + 20);
      return;
    }

    playTick();
    let interval;
    if      (remaining > 1500) interval = 500;
    else if (remaining > 700)  interval = 250;
    else                       interval = 110;
    tickTO = setTimeout(tick, interval);
  }
  tick();
}

function stopTicking() {
  if (tickTO) { clearTimeout(tickTO); tickTO = null; }
}

// ── Firestore helpers ──────────────────────────────────────────────────────
const roomRef = id => doc(db, 'rooms', id);

function genCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[01IO]/g, 'A');
}

async function createRoom() {
  const code = genCode();
  await setDoc(roomRef(code), {
    hostId: myId,
    state: 'lobby',
    players: { [myId]: { name: myName, lives: DEFAULT_SETTINGS.startingLives, isAlive: true, order: 0, wordCount: 0, longestWord: 0, lettersUsed: {}, bonusEarned: 0 } },
    currentPlayerId: null, prompt: null, turnStartTime: null,
    turnDuration: DEFAULT_SETTINGS.minDuration * 1000,
    usedWords: [], round: 1, winnerId: null,
    promptFailures: 0, wordCount: 0, gameStartTime: null, lastWord: null,
    pendingWord: null, settings: DEFAULT_SETTINGS,
    createdAt: serverTimestamp(),
  });
  return code;
}

// ── Public lobby browser ───────────────────────────────────────────────────
function startBrowsingLobbies() {
  stopBrowsingLobbies();
  const q = query(collection(db, 'rooms'), where('state', '==', 'lobby'));
  homeUnsub = onSnapshot(q, snap => {
    const rooms = [];
    snap.forEach(d => rooms.push({ id: d.id, ...d.data() }));
    renderPublicLobbies(rooms);
  });
}

function stopBrowsingLobbies() {
  if (homeUnsub) { homeUnsub(); homeUnsub = null; }
}

function renderPublicLobbies(rooms) {
  const list = $('public-lobbies-list');
  if (!list) return;
  // Filter: must have at least one player (otherwise it's abandoned)
  const valid = rooms.filter(r => Object.keys(r.players || {}).length > 0);
  if (!valid.length) {
    list.innerHTML = '<div class="pl-empty">No public lobbies right now — create one!</div>';
    return;
  }
  // Sort: by player count desc, then by createdAt desc
  valid.sort((a, b) => {
    const ca = Object.keys(a.players || {}).length;
    const cb = Object.keys(b.players || {}).length;
    if (cb !== ca) return cb - ca;
    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
  });
  list.innerHTML = '';
  valid.forEach(room => {
    const count = Object.keys(room.players || {}).length;
    const max   = room.settings?.maxPlayers || 16;
    const host  = room.players?.[room.hostId]?.name || 'Someone';
    const card  = document.createElement('div');
    card.className = 'pl-card';
    card.innerHTML = `
      <div class="pl-info">
        <span class="pl-host">${esc(host)}'s room</span>
        <span class="pl-meta">${count}/${max} players</span>
      </div>
      <div class="pl-code">${esc(room.id)}</div>
      <button class="btn-pl-join">Join</button>
    `;
    card.querySelector('.btn-pl-join').addEventListener('click', () => {
      const name = $('username-input').value.trim();
      if (!name) { showHomeErr('Enter your name first!'); return; }
      $('room-code-input').value = room.id;
      $('join-room-btn').click();
    });
    list.appendChild(card);
  });
}

async function joinRoom(code, name) {
  const snap = await getDoc(roomRef(code));
  if (!snap.exists()) throw new Error('Room not found. Check the code!');
  const room = snap.data();
  if (room.state !== 'lobby') throw new Error('Game already started!');
  const count = Object.keys(room.players).length;
  if (count >= (room.settings?.maxPlayers || 16)) throw new Error('Room is full!');
  const s = room.settings || DEFAULT_SETTINGS;
  await updateDoc(roomRef(code), {
    [`players.${myId}`]: { name, lives: s.startingLives, isAlive: true, order: count, wordCount: 0, longestWord: 0, lettersUsed: {}, bonusEarned: 0 }
  });
}

// ── Home ───────────────────────────────────────────────────────────────────
$('create-room-btn').addEventListener('click', async () => {
  let name = $('username-input').value.trim();
  if (!name) { name = randomName(); $('username-input').value = name; }
  myName = name.slice(0, 30); getAudio();
  try {
    stopBrowsingLobbies();
    roomId = await createRoom(); isHost = true;
    listen(); enterLobby();
  } catch(e) { showHomeErr(e.message); }
});

$('join-room-btn').addEventListener('click', async () => {
  let name = $('username-input').value.trim();
  const code = $('room-code-input').value.trim().toUpperCase();
  if (code.length < 3) return showHomeErr('Enter a room code!');
  if (!name) { name = randomName(); $('username-input').value = name; }
  myName = name.slice(0, 30); getAudio();
  try {
    stopBrowsingLobbies();
    await joinRoom(code, myName); roomId = code; isHost = false;
    listen(); enterLobby();
  } catch(e) { showHomeErr(e.message); }
});

$('random-name-btn').addEventListener('click', () => {
  $('username-input').value = randomName();
});

$('username-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('create-room-btn').click(); });
$('room-code-input').addEventListener('input',  () => { $('room-code-input').value = $('room-code-input').value.toUpperCase(); });
$('room-code-input').addEventListener('keydown', e => { if (e.key === 'Enter') $('join-room-btn').click(); });

function showHomeErr(msg) { $('home-error').textContent = msg; }

// ── Lobby ──────────────────────────────────────────────────────────────────
function enterLobby() {
  $('lobby-code').textContent = roomId;
  initBonusGrid();
  showView('lobby');
}

$('copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(roomId).catch(()=>{});
  $('copy-btn').textContent = '✓';
  setTimeout(() => ($('copy-btn').textContent = '⎘'), 1500);
});

$('leave-btn').addEventListener('click', leaveLobby);

async function leaveLobby() {
  // Unsubscribe FIRST so we don't get a "kicked" alert on our own departure
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  if (roomId && lastRoom) {
    try {
      if (isHost) {
        await deleteDoc(roomRef(roomId));
      } else {
        const updatedPlayers = { ...lastRoom.players };
        delete updatedPlayers[myId];
        await updateDoc(roomRef(roomId), { players: updatedPlayers });
      }
    } catch (e) { /* ignore */ }
  }
  cleanup();
  goHome();
}

function goHome() {
  showView('home');
  startBrowsingLobbies();
}

$('start-btn').addEventListener('click', async () => {
  if (!isHost) return;
  const snap = await getDoc(roomRef(roomId));
  const room = snap.data();
  const alive = Object.entries(room.players).filter(([,p]) => p.isAlive).sort((a,b) => a[1].order - b[1].order);
  if (alive.length < 2) return alert('Need at least 2 players to start!');
  const s = room.settings || DEFAULT_SETTINGS;
  const prompt = randomPrompt(s.difficulty, 1);
  const resets = Object.fromEntries(alive.map(([id, p]) => [
    `players.${id}`, { ...p, lives: s.startingLives, isAlive: true, wordCount: 0, longestWord: 0, lettersUsed: {}, bonusEarned: 0 }
  ]));
  await updateDoc(roomRef(roomId), {
    state: 'playing', currentPlayerId: alive[0][0], prompt,
    turnStartTime: Date.now(), turnDuration: s.minDuration * 1000,
    usedWords: [], round: 1, winnerId: null, promptFailures: 0,
    wordCount: 0, gameStartTime: Date.now(), lastWord: null, pendingWord: null,
    ...resets,
  });
});

// ── Settings UI (lobby) ────────────────────────────────────────────────────
function linkSlider(numId, rangeId, key, transform) {
  const n = $(numId), r = $(rangeId);
  if (!n || !r) return;
  function sync(src, dst, val) {
    dst.value = val;
    if (isHost) saveSettings(key, transform ? transform(val) : Number(val));
  }
  n.addEventListener('input', () => sync(n, r, n.value));
  r.addEventListener('input', () => sync(r, n, r.value));
}

function saveSettings(key, val) {
  if (!isHost || !roomId) return;
  updateDoc(roomRef(roomId), { [`settings.${key}`]: val }).catch(() => {});
}

$('s-difficulty').addEventListener('change', () => { if (isHost) saveSettings('difficulty', $('s-difficulty').value); });
$('s-dict').addEventListener('change', () => {});  // future use

linkSlider('s-duration-n',    's-duration-r',    'minDuration',   Number);
linkSlider('s-age-n',         's-age-r',         'maxPromptAge',  Number);
linkSlider('s-lives-start-n', 's-lives-start-r', 'startingLives', Number);
linkSlider('s-lives-max-n',   's-lives-max-r',   'maxLives',      Number);
linkSlider('s-maxp-n',        's-maxp-r',        'maxPlayers',    Number);

const passEl = $('s-pass-around');
if (passEl) passEl.addEventListener('change', () => {
  if (isHost) saveSettings('passAroundMode', passEl.checked);
  const row = $('age-slider-row');
  if (row) row.classList.toggle('disabled', passEl.checked);
});

// Bonus alphabet grid
function initBonusGrid() {
  const grid = $('bonus-grid');
  grid.innerHTML = '';
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
    const def = (letter === 'X' || letter === 'Z') ? 0 : 1;
    const cell = document.createElement('div');
    cell.className = 'bonus-cell';
    cell.innerHTML = `<span class="bonus-letter">${letter}</span>
      <input class="bonus-count" type="number" min="0" max="5" value="${def}" data-letter="${letter}">`;
    grid.appendChild(cell);
  });
  grid.addEventListener('change', e => {
    if (!isHost || !e.target.dataset.letter) return;
    saveSettings(`bonusAlphabet.${e.target.dataset.letter}`, Number(e.target.value));
  });
}

$('bonus-set-btn').addEventListener('click', () => {
  const val = Number($('bonus-set-val').value);
  document.querySelectorAll('.bonus-count').forEach(inp => {
    inp.value = val;
    if (isHost) saveSettings(`bonusAlphabet.${inp.dataset.letter}`, val);
  });
});

function applySettingsToUI(s) {
  if (!s) return;
  const set = (id, val) => { const el = $(id); if (el) el.value = val; };
  set('s-difficulty',    s.difficulty || 'beginner');
  set('s-duration-n',   s.minDuration || 10); set('s-duration-r',    s.minDuration || 10);
  set('s-age-n',        s.maxPromptAge || 2); set('s-age-r',         s.maxPromptAge || 2);
  set('s-lives-start-n',s.startingLives||2); set('s-lives-start-r', s.startingLives||2);
  set('s-lives-max-n',  s.maxLives || 3);    set('s-lives-max-r',   s.maxLives || 3);
  set('s-maxp-n',       s.maxPlayers||16);   set('s-maxp-r',        s.maxPlayers||16);
  const pass = $('s-pass-around');
  if (pass) {
    pass.checked = !!s.passAroundMode;
    const row = $('age-slider-row');
    if (row) row.classList.toggle('disabled', !!s.passAroundMode);
  }
  if (s.bonusAlphabet) {
    document.querySelectorAll('.bonus-count').forEach(inp => {
      const v = s.bonusAlphabet[inp.dataset.letter];
      if (v !== undefined) inp.value = v;
    });
  }
  // readonly for non-host
  const panel = $('settings-panel');
  if (panel) panel.classList.toggle('readonly', !isHost);
}

// ── Firestore listener ─────────────────────────────────────────────────────
function listen() {
  if (roomUnsub) roomUnsub();
  roomUnsub = onSnapshot(roomRef(roomId), snap => {
    if (!snap.exists()) {
      // Room was deleted by host
      cleanup();
      alert('The host closed the room.');
      goHome();
      return;
    }
    const room = snap.data();
    // Was I kicked?
    if (!room.players[myId]) {
      cleanup();
      alert("You were removed from the room.");
      goHome();
      return;
    }
    lastRoom = room;
    handleUpdate(lastRoom);
  });
}

// ── Edit my own name ───────────────────────────────────────────────────────
async function editMyName() {
  const n = prompt('Edit your name:', myName);
  if (n === null) return;
  const trimmed = n.trim().slice(0, 30);
  if (!trimmed) return;
  myName = trimmed;
  $('tb-myname').textContent = myName;
  if (roomId && lastRoom?.players?.[myId]) {
    try {
      await updateDoc(roomRef(roomId), { [`players.${myId}.name`]: myName });
    } catch (e) { console.warn(e); }
  }
}

// ── Kick player (host only) ────────────────────────────────────────────────
async function kickPlayer(playerId) {
  if (!isHost || !lastRoom || playerId === myId) return;
  const name = lastRoom.players[playerId]?.name || 'this player';
  if (!confirm(`Kick ${name} from the room?`)) return;

  const updated = { ...lastRoom.players };
  delete updated[playerId];
  const updates = { players: updated };

  // If they were the current player mid-game, advance the turn
  if (lastRoom.state === 'playing' && lastRoom.currentPlayerId === playerId) {
    const nextId = nextAlivePlayer(updated, playerId);
    if (nextId) {
      updates.currentPlayerId = nextId;
      updates.turnStartTime  = Date.now();
      updates.pendingWord    = null;
    } else {
      // No one left alive — end game
      const lastAlive = Object.entries(updated).filter(([,p]) => p.isAlive)[0];
      updates.state    = 'gameOver';
      updates.winnerId = lastAlive?.[0] || null;
      updates.currentPlayerId = null;
    }
  }
  await updateDoc(roomRef(roomId), updates);
}

function cleanup() {
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  stopTicking();
  if (timerRAF) { cancelAnimationFrame(timerRAF); timerRAF = null; }
  if (gameClockTO) { clearTimeout(gameClockTO); gameClockTO = null; }
  lastRoom = null; submitting = false;
}

// ── Main update handler ────────────────────────────────────────────────────
function handleUpdate(room) {
  if (room.state === 'lobby') { renderLobby(room); return; }
  if (room.state === 'playing') {
    if (!views.game.classList.contains('active')) showView('game');
    renderGame(room);
    // Non-host watches for pending words
    if (isHost && room.pendingWord) processPendingWord(room);
    return;
  }
  if (room.state === 'gameOver') { renderGameOver(room); return; }
}

// ── Lobby render ───────────────────────────────────────────────────────────
function renderLobby(room) {
  const container = $('lobby-players');
  container.innerHTML = '';
  Object.entries(room.players).sort((a,b) => a[1].order - b[1].order).forEach(([id, p]) => {
    const div = document.createElement('div');
    div.className = 'lobby-player-card';
    const color = avatarColor(p.name);
    const canKick = isHost && id !== myId;
    let badge = '';
    if (id === room.hostId)      badge = '<span class="lp-badge host">HOST</span>';
    else if (id === myId)        badge = '<span class="lp-badge you">YOU</span>';
    const kickHint = canKick ? '<span class="kick-x" title="Click to kick">✕</span>' : '';
    if (canKick) div.classList.add('kickable');
    div.style.borderLeft = `4px solid ${color}`;
    div.innerHTML = `<span class="lp-name">${esc(p.name)}</span>${badge}${kickHint}`;
    if (canKick) div.addEventListener('click', () => kickPlayer(id));
    container.appendChild(div);
  });
  const sb = document.getElementById('start-btn');
  if (sb) sb.style.display = (isHost && room.hostId === myId) ? 'block' : 'none';
  applySettingsToUI(room.settings || DEFAULT_SETTINGS);
}

// ── Game render ────────────────────────────────────────────────────────────
function renderGame(room) {
  const s = room.settings || DEFAULT_SETTINGS;
  // Top bar
  $('tb-room').textContent  = roomId;
  $('tb-count').textContent = `${Object.keys(room.players).length} players`;
  $('tb-words').textContent = `(${room.wordCount || 0} words)`;
  $('tb-myname').textContent = myName;

  // Settings toggle button (wire once per render — idempotent)
  $('tb-settings-toggle').onclick = () => {
    const gs = $('game-settings');
    gs.classList.toggle('hidden');
    if (!gs.classList.contains('hidden')) renderGameSettings(s);
  };
  $('edit-name-btn').onclick = editMyName;

  renderGameSettings(s);
  renderArena(room, s);
  renderLeaderboard(room, s);
  updateBombAndInput(room, s);
  runGameClock(room.gameStartTime);
}

function renderGameSettings(s) {
  const el = $('gsettings-content');
  if (!el) return;
  el.innerHTML = [
    ['Difficulty',    s.difficulty],
    ['Min Duration',  `${s.minDuration}s`],
    ['Prompt Age',    s.maxPromptAge + ' fails'],
    ['Starting Lives',s.startingLives],
    ['Max Lives',     s.maxLives],
    ['Max Players',   s.maxPlayers],
  ].map(([k,v]) => `<div class="gs-row"><span>${k}</span><span class="gs-val">${esc(String(v))}</span></div>`).join('');
}

function runGameClock(startTime) {
  if (!startTime) return;
  if (gameClockTO) clearTimeout(gameClockTO);
  function tick() {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2,'0');
    const sec = String(elapsed % 60).padStart(2,'0');
    const el = $('tb-clock');
    if (el) el.textContent = `${m}:${sec}`;
    gameClockTO = setTimeout(tick, 1000);
  }
  tick();
}

// ── Leaderboard ────────────────────────────────────────────────────────────
function renderLeaderboard(room, s) {
  const tbody = $('lb-body');
  if (!tbody) return;
  const players = Object.entries(room.players).sort((a,b) => a[1].order - b[1].order);
  const ba = (s.settings || s).bonusAlphabet || DEFAULT_SETTINGS.bonusAlphabet;
  tbody.innerHTML = '';
  players.forEach(([id, p]) => {
    const used   = p.lettersUsed || {};
    const needed = Object.entries(ba).filter(([,v]) => v > 0).length;
    const done   = Object.entries(ba).filter(([l,v]) => v > 0 && (used[l]||0) >= v).length;
    const isCur  = id === room.currentPlayerId;
    const isElim = !p.isAlive;
    const canKick = isHost && id !== myId;
    const tr = document.createElement('tr');
    tr.className = `${isCur ? 'lb-current' : ''} ${isElim ? 'lb-eliminated' : ''} ${canKick ? 'kickable' : ''}`.trim();
    tr.innerHTML = `
      <td class="lb-name">${esc(p.name)}${id === myId ? ' <span style="color:var(--accent);font-size:.65rem">(you)</span>' : ''}${canKick ? ' <span class="kick-x">✕</span>' : ''}</td>
      <td>${p.wordCount || 0}</td>
      <td class="lb-alpha">${done}/${needed}</td>
      <td>${p.bonusEarned || 0}</td>
      <td>${p.longestWord || 0}</td>
      <td class="lb-lives">${'❤'.repeat(Math.max(0, p.lives))}</td>`;
    if (canKick) tr.addEventListener('click', () => kickPlayer(id));
    tbody.appendChild(tr);
  });
}

// ── Arena (circular layout) ────────────────────────────────────────────────
let playerPositions = {};  // { id: {x, y} }

function renderArena(room, s) {
  const arena = $('arena');
  const container = $('arena-players');
  const sorted = Object.entries(room.players).sort((a,b) => a[1].order - b[1].order);
  const n = sorted.length;
  const rect  = arena.getBoundingClientRect();
  const cx    = rect.width  / 2;
  const cy    = rect.height / 2;
  const rad   = Math.min(cx, cy) * 0.68;

  // Build/update player nodes
  sorted.forEach(([id, p], i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    const x = cx + rad * Math.cos(angle);
    const y = cy + rad * Math.sin(angle);
    playerPositions[id] = { x, y };

    let node = document.getElementById(`pnode-${id}`);
    if (!node) {
      node = document.createElement('div');
      node.id = `pnode-${id}`;
      node.className = 'pnode';
      container.appendChild(node);
    }

    const isCurrent = id === room.currentPlayerId;
    const color = avatarColor(p.name);
    const maxL  = (s.settings || s).maxLives || DEFAULT_SETTINGS.maxLives;
    const word  = id === room.currentPlayerId && id === myId
      ? '' // self typing shown in word bar, not node
      : (p.lastWord || '');

    const canKick = isHost && id !== myId;
    node.className = `pnode${isCurrent ? ' current-turn' : ''}${!p.isAlive ? ' eliminated' : ''}${canKick ? ' kickable' : ''}`;
    node.style.left = `${x}px`;
    node.style.top  = `${y}px`;
    node.innerHTML  = `
      <div class="pnode-pill" style="background:${color}">${esc(p.name)}${id === myId ? ' <span class="pnode-you">(you)</span>' : ''}${canKick ? ' <span class="kick-x">✕</span>' : ''}</div>
      <div class="pnode-hearts">${hearts(p.lives, maxL)}</div>
      <div class="pnode-word" id="pword-${id}">${wordWithHighlight(word, room.prompt || '')}</div>
    `;
    if (canKick) node.addEventListener('click', () => kickPlayer(id));
    if (id === myId) node.addEventListener('click', e => { if (!e.target.classList.contains('kick-x')) editMyName(); });
  });

  // Remove nodes for players who left
  container.querySelectorAll('.pnode').forEach(node => {
    const id = node.id.replace('pnode-', '');
    if (!room.players[id]) node.remove();
  });

  updateArrow(room.currentPlayerId);
}

function wordWithHighlight(word, prompt) {
  if (!word || !prompt) return esc(word || '');
  const w = word.toLowerCase(), p = prompt.toLowerCase();
  const idx = w.indexOf(p);
  if (idx === -1) return esc(word);
  return `${esc(word.slice(0,idx))}<span class="wm">${esc(word.slice(idx, idx+p.length))}</span>${esc(word.slice(idx+p.length))}`;
}

// Update SVG arrow from bomb center to current player
function updateArrow(currentPlayerId) {
  const line = $('arrow-line');
  if (!line || !currentPlayerId) { if (line) line.setAttribute('x2', line.getAttribute('x1')); return; }

  const arena  = $('arena');
  const rect   = arena.getBoundingClientRect();
  const cx = rect.width / 2, cy = rect.height / 2;
  const pos = playerPositions[currentPlayerId];
  if (!pos) return;

  const dx = pos.x - cx, dy = pos.y - cy;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const bombR  = 68, playerR = 36;
  const x1 = cx + dx/len * bombR,  y1 = cy + dy/len * bombR;
  const x2 = pos.x - dx/len * playerR, y2 = pos.y - dy/len * playerR;

  line.setAttribute('x1', x1); line.setAttribute('y1', y1);
  line.setAttribute('x2', x2); line.setAttribute('y2', y2);
}

// Re-layout on window resize
window.addEventListener('resize', () => { if (lastRoom && lastRoom.state === 'playing') renderArena(lastRoom, lastRoom.settings || DEFAULT_SETTINGS); });

// ── Bomb display + input ───────────────────────────────────────────────────
let lastTurnStart = null;

function updateBombAndInput(room, s) {
  $('bomb-prompt').textContent = room.prompt || '–';

  const isMyTurn = room.currentPlayerId === myId;
  const inp = $('word-input');
  if (isMyTurn && inp.disabled) { inp.disabled = false; inp.value = ''; inp.focus(); }
  else if (!isMyTurn && !inp.disabled) { inp.disabled = true; inp.value = ''; }

  // Update word display
  updateWordDisplay(inp.value, room.prompt || '');

  // Turn status label (shown in word-feedback when not your turn)
  const fb = $('word-feedback');
  if (!isMyTurn) {
    const cur = room.players[room.currentPlayerId];
    fb.className = 'word-feedback';
    fb.textContent = cur ? `${cur.name}'s turn` : '';
  }

  // Countdown
  if (room.turnStartTime && room.turnDuration) {
    if (lastTurnStart !== room.turnStartTime) {
      lastTurnStart = room.turnStartTime;
      startTicking(room.turnStartTime, room.turnDuration);
    }
    runCountdown(room.turnStartTime, room.turnDuration, room, s);
  }
}

function runCountdown(startTime, duration, room, s) {
  if (timerRAF) cancelAnimationFrame(timerRAF);
  const bomb = $('bomb');
  const secsEl = $('bomb-secs');

  function frame() {
    const remaining = Math.max(0, duration - (Date.now() - startTime));
    const secs = Math.ceil(remaining / 1000);
    if (secsEl) secsEl.textContent = secs;

    const ratio = remaining / duration;
    if (bomb) {
      bomb.className = 'bomb' +
        (ratio < 0.25 ? ' danger critical' : ratio < 0.5 ? ' danger' : '');
    }

    if (remaining > 0) {
      timerRAF = requestAnimationFrame(frame);
    } else {
      stopTicking();
      if (isHost) handleTimeout(room, s);
    }
  }
  frame();
}

// ── Turn timeout (host only) ───────────────────────────────────────────────
async function handleTimeout(room, s) {
  if (!isHost) return;
  const playerId = room.currentPlayerId;
  const player   = room.players[playerId];
  if (!player || !player.isAlive) return;

  playExplosion();

  const settings = s || room.settings || DEFAULT_SETTINGS;
  const newLives  = player.lives - 1;
  const stillAlive = newLives > 0;
  const newPromptAge = (room.promptFailures || 0) + 1;

  const updatedPlayers = {
    ...room.players,
    [playerId]: { ...player, lives: newLives, isAlive: stillAlive }
  };

  const alivePlayers = Object.entries(updatedPlayers)
    .filter(([,p]) => p.isAlive)
    .sort((a,b) => a[1].order - b[1].order);

  // Pass-around mode: prompt changes after every living player has failed once
  const effectiveMaxAge = settings.passAroundMode
    ? Math.max(1, alivePlayers.length)
    : (settings.maxPromptAge || 2);
  const promptExpired = newPromptAge >= effectiveMaxAge;

  if (alivePlayers.length <= 1) {
    await updateDoc(roomRef(roomId), {
      state: 'gameOver', winnerId: alivePlayers[0]?.[0] || null,
      players: updatedPlayers, currentPlayerId: null,
    });
    return;
  }

  const nextId   = nextAlivePlayer(updatedPlayers, playerId);
  const newRound = isWrapping(updatedPlayers, playerId, nextId) ? room.round + 1 : room.round;
  const newDur   = Math.max(settings.minDuration * 1000, room.turnDuration - 500);
  const newPrompt = promptExpired
    ? randomPrompt(settings.difficulty, newRound)
    : room.prompt;

  await updateDoc(roomRef(roomId), {
    players: updatedPlayers, currentPlayerId: nextId,
    prompt: newPrompt, turnStartTime: Date.now(), turnDuration: newDur,
    round: newRound, lastWord: null, pendingWord: null,
    promptFailures: promptExpired ? 0 : newPromptAge,
  });
}

// ── Word submission ────────────────────────────────────────────────────────
$('word-input').addEventListener('input', () => {
  const inp = $('word-input');
  updateWordDisplay(inp.value, lastRoom?.prompt || '');
  // also update own pnode word in real-time
  const pword = $(`pword-${myId}`);
  if (pword) pword.innerHTML = wordWithHighlight(inp.value, lastRoom?.prompt || '');
});

$('word-input').addEventListener('keydown', async e => {
  if (e.key !== 'Enter' || submitting) return;
  const word = $('word-input').value.trim().toLowerCase();
  if (!word || !lastRoom || lastRoom.currentPlayerId !== myId) return;

  const prompt = (lastRoom.prompt || '').toLowerCase();
  if (!word.includes(prompt)) return flashFeedback(`Must contain "${prompt.toUpperCase()}"`, 'err');
  if ((lastRoom.usedWords || []).includes(word)) return flashFeedback('Word already used!', 'err');

  submitting = true;
  $('word-feedback').className = 'word-feedback';
  $('word-feedback').textContent = 'Checking…';
  $('word-input').disabled = true;

  const valid = await isValidWord(word);
  if (!valid) {
    submitting = false;
    flashFeedback('Not a valid English word!', 'err');
    $('word-input').disabled = false;
    $('word-input').classList.add('shake');
    setTimeout(() => $('word-input').classList.remove('shake'), 350);
    $('word-input').focus();
    return;
  }

  // Submit
  if (isHost) {
    await advanceTurn(word, lastRoom);
  } else {
    await updateDoc(roomRef(roomId), { pendingWord: { word, playerId: myId, ts: Date.now() } });
  }
  submitting = false;
});

function updateWordDisplay(typed, prompt) {
  const el = $('word-display');
  if (!el) return;
  if (!typed) { el.innerHTML = ''; return; }
  el.innerHTML = wordWithHighlight(typed, prompt);
}

function flashFeedback(msg, cls) {
  const fb = $('word-feedback');
  fb.textContent = msg; fb.className = `word-feedback ${cls}`;
  setTimeout(() => { if (fb.textContent === msg) { fb.textContent = ''; fb.className = 'word-feedback'; } }, 2500);
}

// ── Advance turn (host) ────────────────────────────────────────────────────
async function advanceTurn(word, room) {
  stopTicking();
  const s = room.settings || DEFAULT_SETTINGS;
  const curId   = room.currentPlayerId;
  const player  = room.players[curId];
  if (!player) return;

  // Bonus alphabet tracking
  const lettersUsed = { ...(player.lettersUsed || {}) };
  const ba = s.bonusAlphabet || DEFAULT_SETTINGS.bonusAlphabet;
  const uniqueLetters = [...new Set(word.toUpperCase())];
  uniqueLetters.forEach(l => { lettersUsed[l] = (lettersUsed[l] || 0) + 1; });

  // Check if bonus earned
  const allDone = Object.entries(ba).every(([l, req]) => req === 0 || (lettersUsed[l] || 0) >= req);
  let newLives = player.lives;
  let bonusEarned = player.bonusEarned || 0;
  if (allDone) {
    const maxL = s.maxLives || DEFAULT_SETTINGS.maxLives;
    if (newLives < maxL) { newLives++; bonusEarned++; playBonusLife(); }
    // Reset tracking
    Object.keys(lettersUsed).forEach(k => { lettersUsed[k] = 0; });
  }

  const updPlayers = {
    ...room.players,
    [curId]: {
      ...player, lives: newLives, lettersUsed, bonusEarned,
      wordCount: (player.wordCount || 0) + 1,
      lastWord: word,
      longestWord: Math.max(player.longestWord || 0, word.length),
    }
  };

  const nextId = nextAlivePlayer(updPlayers, curId);
  const wrapping = isWrapping(updPlayers, curId, nextId);
  const newRound = wrapping ? room.round + 1 : room.round;
  const newDur   = Math.max(s.minDuration * 1000, room.turnDuration - (wrapping ? 400 : 0));
  const newPrompt = randomPrompt(s.difficulty, newRound);

  await updateDoc(roomRef(roomId), {
    players: updPlayers, currentPlayerId: nextId,
    prompt: newPrompt, turnStartTime: Date.now(), turnDuration: newDur,
    round: newRound, lastWord: word, wordCount: (room.wordCount || 0) + 1,
    usedWords: arrayUnion(word), pendingWord: null, promptFailures: 0,
  });
}

async function processPendingWord(room) {
  const pw = room.pendingWord;
  if (!pw || pw.playerId !== room.currentPlayerId) return;
  await advanceTurn(pw.word, room);
}

// ── Turn helpers ───────────────────────────────────────────────────────────
function nextAlivePlayer(players, currentId) {
  const sorted = Object.entries(players).sort((a,b) => a[1].order - b[1].order);
  const curPos = sorted.findIndex(([id]) => id === currentId);
  for (let i = 1; i <= sorted.length; i++) {
    const [nid, np] = sorted[(curPos + i) % sorted.length];
    if (np.isAlive) return nid;
  }
  return null;
}

function isWrapping(players, fromId, toId) {
  const sorted = Object.entries(players).sort((a,b) => a[1].order - b[1].order);
  const fromPos = sorted.findIndex(([id]) => id === fromId);
  const toPos   = sorted.findIndex(([id]) => id === toId);
  return toPos <= fromPos;
}

// ── Game Over ──────────────────────────────────────────────────────────────
function renderGameOver(room) {
  stopTicking();
  if (timerRAF) { cancelAnimationFrame(timerRAF); timerRAF = null; }
  const winner = room.players[room.winnerId];
  $('go-winner').textContent = winner
    ? (room.winnerId === myId ? '🎉 You win!' : `🏆 ${winner.name} wins!`)
    : 'Nobody survived!';
  $('play-again-btn').style.display = (isHost && room.hostId === myId) ? 'block' : 'none';
  showView('gameover');
}

$('play-again-btn').addEventListener('click', async () => {
  if (!isHost) return;
  const snap = await getDoc(roomRef(roomId));
  const room = snap.data();
  const s = room.settings || DEFAULT_SETTINGS;
  const sorted = Object.entries(room.players).sort((a,b) => a[1].order - b[1].order);
  await updateDoc(roomRef(roomId), {
    state: 'lobby', currentPlayerId: null, prompt: null, turnStartTime: null,
    usedWords: [], round: 1, winnerId: null, lastWord: null, pendingWord: null,
    wordCount: 0, gameStartTime: null, promptFailures: 0,
    ...Object.fromEntries(sorted.map(([id, p]) => [
      `players.${id}`, { ...p, lives: s.startingLives, isAlive: true, wordCount: 0, longestWord: 0, lettersUsed: {}, bonusEarned: 0 }
    ]))
  });
  enterLobby();
});

$('home-btn').addEventListener('click', () => { cleanup(); goHome(); });

// Start browsing lobbies on page load
startBrowsingLobbies();
initBonusGrid();
