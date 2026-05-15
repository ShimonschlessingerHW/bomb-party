// game.js — Bomb Party main logic
import { initializeApp }            from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, arrayUnion, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import firebaseConfig                from './firebase-config.js';
import { isValidWord, randomPrompt } from './words.js';

// ── Firebase Init ──────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Game State (client) ────────────────────────────────────────────────────
let myId       = crypto.randomUUID();
let myName     = '';
let roomId     = '';
let isHost     = false;
let roomUnsub  = null;   // Firestore listener unsubscriber
let timerLoop  = null;   // setInterval handle for the countdown
let lastRoom   = null;   // most recent room snapshot
let submitting = false;  // prevent double submit
let MAX_LIVES  = 3;

// ── DOM refs ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const views = {
  home:     $('view-home'),
  lobby:    $('view-lobby'),
  game:     $('view-game'),
  gameover: $('view-gameover'),
};

function showView(name) {
  Object.values(views).forEach(v => v.classList.remove('active'));
  views[name].classList.add('active');
}

// ── Helpers ────────────────────────────────────────────────────────────────
function genCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase().replace(/[01]/g, 'A');
}

function avatarColor(name) {
  const colors = ['#4361ee','#7209b7','#2ec4b6','#f4a261','#e63946','#4cc9f0','#fb8500','#43aa8b'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

function showFeedback(msg, type = 'info') {
  const el = $('input-feedback');
  el.textContent = msg;
  el.className = 'input-feedback ' + type;
}

function setWordInputState(enabled) {
  const inp = $('word-input');
  inp.disabled = !enabled;
  if (enabled) { inp.value = ''; inp.focus(); }
}

// ── Room Helpers ───────────────────────────────────────────────────────────
function roomRef(id) { return doc(db, 'rooms', id); }

async function createRoom() {
  const code = genCode();
  const data = {
    hostId: myId,
    state: 'lobby',
    players: {
      [myId]: { name: myName, lives: MAX_LIVES, isAlive: true, order: 0 }
    },
    currentPlayerId: null,
    prompt: null,
    turnStartTime: null,
    turnDuration: 10000,
    usedWords: [],
    round: 1,
    winnerId: null,
    createdAt: serverTimestamp(),
  };
  await setDoc(roomRef(code), data);
  return code;
}

async function joinRoom(code, name) {
  const snap = await getDoc(roomRef(code));
  if (!snap.exists()) throw new Error('Room not found');
  const room = snap.data();
  if (room.state !== 'lobby') throw new Error('Game already in progress');

  const order = Object.keys(room.players).length;
  await updateDoc(roomRef(code), {
    [`players.${myId}`]: { name, lives: MAX_LIVES, isAlive: true, order }
  });
}

// ── Home View ──────────────────────────────────────────────────────────────
$('create-room-btn').addEventListener('click', async () => {
  const name = $('username-input').value.trim();
  if (!name) return showError('Enter your name first!');
  myName = name;
  try {
    roomId = await createRoom();
    isHost = true;
    startListening();
    enterLobby();
  } catch(e) { showError(e.message); }
});

$('join-room-btn').addEventListener('click', async () => {
  const name = $('username-input').value.trim();
  const code = $('room-code-input').value.trim().toUpperCase();
  if (!name) return showError('Enter your name first!');
  if (code.length < 3) return showError('Enter a room code!');
  myName = name;
  try {
    await joinRoom(code, name);
    roomId = code;
    isHost = false;
    startListening();
    enterLobby();
  } catch(e) { showError(e.message); }
});

$('username-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('create-room-btn').click();
});
$('room-code-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('join-room-btn').click();
  $('room-code-input').value = $('room-code-input').value.toUpperCase();
});
$('room-code-input').addEventListener('input', () => {
  $('room-code-input').value = $('room-code-input').value.toUpperCase();
});

function showError(msg) { $('home-error').textContent = msg; }

// ── Lobby View ─────────────────────────────────────────────────────────────
function enterLobby() {
  $('lobby-room-code').textContent = roomId;
  $('game-room-code').textContent  = roomId;
  showView('lobby');
}

$('copy-code-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(roomId).catch(() => {});
  $('copy-code-btn').textContent = '✓';
  setTimeout(() => ($('copy-code-btn').textContent = '⎘'), 1500);
});

$('leave-lobby-btn').addEventListener('click', () => {
  cleanup();
  showView('home');
});

$('start-game-btn').addEventListener('click', async () => {
  if (!isHost) return;
  const snap = await getDoc(roomRef(roomId));
  const room = snap.data();
  const alivePlayers = Object.entries(room.players)
    .filter(([,p]) => p.isAlive)
    .sort((a,b) => a[1].order - b[1].order);
  if (alivePlayers.length < 2) return alert('Need at least 2 players!');

  const firstId = alivePlayers[0][0];
  const prompt  = randomPrompt(1);
  await updateDoc(roomRef(roomId), {
    state: 'playing',
    currentPlayerId: firstId,
    prompt,
    turnStartTime: Date.now(),
    turnDuration: 10000,
    usedWords: [],
    round: 1,
    winnerId: null,
    // reset lives
    ...Object.fromEntries(alivePlayers.map(([id, p]) => [
      `players.${id}`, { ...p, lives: MAX_LIVES, isAlive: true }
    ]))
  });
});

// ── Firestore Listener ─────────────────────────────────────────────────────
function startListening() {
  if (roomUnsub) roomUnsub();
  roomUnsub = onSnapshot(roomRef(roomId), snap => {
    if (!snap.exists()) return;
    lastRoom = snap.data();
    handleRoomUpdate(lastRoom);
  });
}

function cleanup() {
  if (roomUnsub) { roomUnsub(); roomUnsub = null; }
  if (timerLoop) { clearInterval(timerLoop); timerLoop = null; }
  lastRoom = null;
}

// ── Main Room Update Handler ───────────────────────────────────────────────
function handleRoomUpdate(room) {
  if (room.state === 'lobby') {
    renderLobby(room);
    return;
  }
  if (room.state === 'playing') {
    if (!views.game.classList.contains('active')) showView('game');
    renderGame(room);
    return;
  }
  if (room.state === 'gameOver') {
    renderGameOver(room);
    return;
  }
}

// ── Lobby Render ───────────────────────────────────────────────────────────
function renderLobby(room) {
  const container = $('lobby-players');
  container.innerHTML = '';
  const sorted = Object.entries(room.players).sort((a,b) => a[1].order - b[1].order);
  for (const [id, p] of sorted) {
    const card = document.createElement('div');
    card.className = 'lobby-player-card';
    const initials = p.name.slice(0,2).toUpperCase();
    const color = avatarColor(p.name);
    let badge = '';
    if (id === room.hostId) badge = '<span class="host-badge">HOST</span>';
    else if (id === myId)   badge = '<span class="you-badge">YOU</span>';
    card.innerHTML = `
      <div class="avatar" style="background:${color}">${initials}</div>
      <span>${escHtml(p.name)}</span>
      ${badge}
    `;
    container.appendChild(card);
  }
  const startBtn = $('start-game-btn');
  startBtn.style.display = (isHost && room.hostId === myId) ? 'block' : 'none';
}

// ── Game Render ────────────────────────────────────────────────────────────
function renderGame(room) {
  renderPlayers(room);
  updatePrompt(room);
  updateTurnLabel(room);
  startCountdown(room);
  $('topbar-round').textContent = `Round ${room.round}`;
}

function renderPlayers(room) {
  const sidebar = $('players-sidebar');
  sidebar.innerHTML = '';
  const sorted = Object.entries(room.players).sort((a,b) => a[1].order - b[1].order);
  for (const [id, p] of sorted) {
    const card = document.createElement('div');
    card.className = 'player-card' +
      (id === room.currentPlayerId ? ' current-turn' : '') +
      (!p.isAlive ? ' eliminated' : '');
    const hearts = Array.from({length: MAX_LIVES}, (_, i) =>
      `<span class="heart${i >= p.lives ? ' lost' : ''}">❤</span>`
    ).join('');
    card.innerHTML = `
      <div class="player-name">${escHtml(p.name)}${id === myId ? '<span class="you-tag">(you)</span>' : ''}</div>
      <div class="player-hearts">${hearts}</div>
      <span class="player-turn-arrow">▶</span>
    `;
    sidebar.appendChild(card);
  }
}

function updatePrompt(room) {
  $('prompt-letters').textContent = room.prompt || '– –';
  if (room.lastWord) {
    $('last-word-display').textContent = `✓ ${room.lastWord}`;
  } else {
    $('last-word-display').textContent = '';
  }
}

function updateTurnLabel(room) {
  const label = $('turn-label');
  if (room.currentPlayerId === myId) {
    label.textContent = '💣 Your turn!';
    label.className = 'turn-label your-turn';
    setWordInputState(true);
    showFeedback('Type a word containing the letters above', 'info');
  } else {
    const name = room.players[room.currentPlayerId]?.name || '?';
    label.innerHTML = `<strong>${escHtml(name)}</strong>'s turn`;
    label.className = 'turn-label';
    setWordInputState(false);
    showFeedback('');
  }
}

// ── Countdown Timer ────────────────────────────────────────────────────────
function startCountdown(room) {
  if (timerLoop) clearInterval(timerLoop);

  const duration = room.turnDuration || 10000;
  const startTime = room.turnStartTime;

  function tick() {
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, duration - elapsed);
    const secs = Math.ceil(remaining / 1000);

    $('bomb-timer').textContent = secs;

    const wrapper = $('bomb-wrapper');
    const ratio = remaining / duration;
    if (ratio < 0.25) {
      wrapper.className = 'bomb-wrapper critical danger';
    } else if (ratio < 0.5) {
      wrapper.className = 'bomb-wrapper danger';
    } else {
      wrapper.className = 'bomb-wrapper';
    }

    // Host handles timeout
    if (remaining <= 0 && isHost) {
      clearInterval(timerLoop);
      timerLoop = null;
      handleTimeout(room);
    }
  }

  tick();
  timerLoop = setInterval(tick, 100);
}

async function handleTimeout(room) {
  if (!isHost) return;
  const playerId = room.currentPlayerId;
  const player   = room.players[playerId];
  if (!player || !player.isAlive) return;

  const newLives = player.lives - 1;
  const isAlive  = newLives > 0;

  const updatedPlayers = {
    ...room.players,
    [playerId]: { ...player, lives: newLives, isAlive }
  };

  // Count alive players
  const alivePlayers = Object.entries(updatedPlayers)
    .filter(([, p]) => p.isAlive)
    .sort((a,b) => a[1].order - b[1].order);

  if (alivePlayers.length <= 1) {
    // Game over
    const winnerId = alivePlayers[0]?.[0] || null;
    await updateDoc(roomRef(roomId), {
      state: 'gameOver',
      winnerId,
      players: updatedPlayers,
      currentPlayerId: null,
    });
    return;
  }

  // Advance to next living player
  const currentIndex = alivePlayers.findIndex(([id]) => id !== playerId ||
    (id === playerId && !isAlive) ? true : false);

  // Find next alive player after current
  const allSorted = Object.entries(updatedPlayers).sort((a,b) => a[1].order - b[1].order);
  const curPos = allSorted.findIndex(([id]) => id === playerId);
  let nextId = null;
  for (let i = 1; i <= allSorted.length; i++) {
    const [nid, np] = allSorted[(curPos + i) % allSorted.length];
    if (np.isAlive) { nextId = nid; break; }
  }

  const newRound = room.round + (nextId === alivePlayers[0][0] ? 1 : 0);
  const newDuration = Math.max(5000, room.turnDuration - 200);
  const newPrompt = randomPrompt(newRound);

  await updateDoc(roomRef(roomId), {
    players: updatedPlayers,
    currentPlayerId: nextId,
    prompt: newPrompt,
    turnStartTime: Date.now(),
    turnDuration: newDuration,
    round: newRound,
    lastWord: null,
  });
}

// ── Word Submission ────────────────────────────────────────────────────────
$('word-input').addEventListener('keydown', async e => {
  if (e.key !== 'Enter') return;
  if (submitting) return;

  const word = $('word-input').value.trim().toLowerCase();
  if (!word) return;

  if (!lastRoom) return;
  if (lastRoom.currentPlayerId !== myId) return;

  const prompt = lastRoom.prompt.toLowerCase();

  // 1. Check prompt is in word
  if (!word.includes(prompt)) {
    flashError(`Word must contain "${lastRoom.prompt.toUpperCase()}"`);
    return;
  }

  // 2. Check not already used
  if ((lastRoom.usedWords || []).includes(word)) {
    flashError('Word already used this game!');
    return;
  }

  // 3. Validate English
  submitting = true;
  showFeedback('Checking…', 'info');
  $('word-input').disabled = true;

  const valid = await isValidWord(word);
  if (!valid) {
    submitting = false;
    flashError('Not a valid English word!');
    setWordInputState(true);
    return;
  }

  // 4. Submit — advance turn
  if (!isHost) {
    // Non-host marks word as used; host advances turn
    await updateDoc(roomRef(roomId), {
      pendingWord: { word, playerId: myId, ts: Date.now() }
    });
  } else {
    await advanceTurn(word, lastRoom);
  }
  submitting = false;
});

// ── Advance Turn (host only) ───────────────────────────────────────────────
async function advanceTurn(word, room) {
  if (timerLoop) { clearInterval(timerLoop); timerLoop = null; }

  const currentId = room.currentPlayerId;
  const allSorted = Object.entries(room.players).sort((a,b) => a[1].order - b[1].order);
  const curPos    = allSorted.findIndex(([id]) => id === currentId);

  let nextId = null;
  for (let i = 1; i <= allSorted.length; i++) {
    const [nid, np] = allSorted[(curPos + i) % allSorted.length];
    if (np.isAlive) { nextId = nid; break; }
  }

  // Did we wrap around? → new round
  const nextPos = allSorted.findIndex(([id]) => id === nextId);
  const newRound = nextPos <= curPos ? room.round + 1 : room.round;
  const newDuration = Math.max(5000, room.turnDuration - (nextPos <= curPos ? 300 : 0));
  const newPrompt   = randomPrompt(newRound);

  await updateDoc(roomRef(roomId), {
    currentPlayerId: nextId,
    prompt: newPrompt,
    turnStartTime: Date.now(),
    turnDuration: newDuration,
    round: newRound,
    lastWord: word,
    usedWords: arrayUnion(word),
    pendingWord: null,
  });
}

// Watch for non-host word submissions and process them (host only)
let lastPendingWord = null;
function watchPendingWord(room) {
  if (!isHost) return;
  if (!room.pendingWord) return;
  const pw = room.pendingWord;
  if (!pw || pw === lastPendingWord) return;
  if (pw.playerId !== room.currentPlayerId) return;
  lastPendingWord = pw;
  advanceTurn(pw.word, room);
}

// Hook into room update
const _origHandle = handleRoomUpdate;
// Extend handleRoomUpdate to also watch pending words
function handleRoomUpdateExtended(room) {
  watchPendingWord(room);
  _origHandle(room);
}
// Replace the listener ref
setTimeout(() => {
  if (roomUnsub) roomUnsub();
  if (roomId) {
    roomUnsub = onSnapshot(roomRef(roomId), snap => {
      if (!snap.exists()) return;
      lastRoom = snap.data();
      handleRoomUpdateExtended(lastRoom);
    });
  }
}, 0);

function flashError(msg) {
  showFeedback(msg, 'error');
  const inp = $('word-input');
  inp.classList.add('error');
  inp.disabled = false;
  inp.select();
  setTimeout(() => inp.classList.remove('error'), 500);
}

// ── Game Over ──────────────────────────────────────────────────────────────
function renderGameOver(room) {
  if (timerLoop) { clearInterval(timerLoop); timerLoop = null; }
  const winner = room.players[room.winnerId];
  $('gameover-winner').textContent = winner
    ? (room.winnerId === myId ? '🎉 You win!' : `🏆 ${winner.name} wins!`)
    : 'Nobody survived!';
  $('play-again-btn').style.display = (isHost && room.hostId === myId) ? 'block' : 'none';
  showView('gameover');
}

$('play-again-btn').addEventListener('click', async () => {
  if (!isHost) return;
  const snap = await getDoc(roomRef(roomId));
  const room = snap.data();
  const sorted = Object.entries(room.players).sort((a,b) => a[1].order - b[1].order);
  const firstId = sorted[0][0];
  await updateDoc(roomRef(roomId), {
    state: 'lobby',
    currentPlayerId: null,
    prompt: null,
    turnStartTime: null,
    usedWords: [],
    round: 1,
    winnerId: null,
    lastWord: null,
    pendingWord: null,
    ...Object.fromEntries(sorted.map(([id, p]) => [
      `players.${id}`, { ...p, lives: MAX_LIVES, isAlive: true }
    ]))
  });
  enterLobby();
});

$('home-btn').addEventListener('click', () => {
  cleanup();
  showView('home');
});

// ── Utils ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
