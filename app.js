const { createClient } = window.supabase;
const sb = createClient(SCORE_CONFIG.SUPABASE_URL, SCORE_CONFIG.SUPABASE_PUBLISHABLE_KEY);

const DEFAULT_SETTINGS = { undercutAward: 60, undercutPenalty: 10 };
const state = {
  tab: "games",
  games: [],
  players: [],
  game: null,
  gamePlayers: [],
  history: [],
  sortMode: "custom",
  theme: localStorage.getItem("score_theme") || "dark",
  undercutSettings: loadUndercutSettings()
};

const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const toast = msg => { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1800); };
document.documentElement.dataset.theme = state.theme;

function loadUndercutSettings() {
  try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem("score_undercut_settings") || "{}")) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
function saveUndercutSettings() {
  localStorage.setItem("score_undercut_settings", JSON.stringify(state.undercutSettings));
}
function isUnderCutGame() {
  return state.game && String(state.game.name).trim().toLowerCase() === "undercut";
}
function avatar(p) {
  if (p?.avatar_url) return `<img class="avatar" src="${esc(p.avatar_url)}" alt="">`;
  return `<div class="avatar">${esc((p?.name || "?").slice(0, 1).toUpperCase())}</div>`;
}
function setTitle(t) { $("#pageTitle").textContent = t; }

async function loadAll() {
  const [g, p] = await Promise.all([
    sb.from("games").select("*").order("updated_at", { ascending: false }),
    sb.from("players").select("*").order("name")
  ]);
  if (g.error) return toast(g.error.message);
  if (p.error) return toast(p.error.message);
  state.games = g.data || [];
  state.players = p.data || [];
  render();
}

function render() {
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.tab === state.tab));
  if (state.tab === "games") { setTitle("Games"); renderGames(); }
  if (state.tab === "players") { setTitle("Players"); renderPlayers(); }
  if (state.tab === "history") { setTitle("History"); renderHistory(); }
  if (state.tab === "settings") { setTitle("Settings"); renderSettings(); }
}

function renderGames() {
  const presets = ["UnderCut", "Lavaa", "Dingu", "Hukun kaalaa"];
  $("#content").innerHTML = `
    <div class="row page-intro">
      <div><h2>Your Games</h2><p>${state.games.length} saved game${state.games.length === 1 ? "" : "s"}</p></div>
      <button class="btn primary" onclick="newGame()">+ New Game</button>
    </div>
    <div class="section-title">Game types</div>
    <div class="game-types">
      ${presets.map((name, i) => `
        <button class="preset-card ${i === 0 ? "featured" : ""}" onclick="newGame('${esc(name)}')">
          <span class="preset-icon">🎮</span>
          <span><b>${esc(name)}</b><small>${name === "UnderCut" ? "Ready to play" : "Scoring coming later"}</small></span>
          <span class="preset-arrow">›</span>
        </button>`).join("")}
    </div>
    <div class="section-title">Saved games</div>
    <div class="stack">
      ${state.games.length ? state.games.map(g => `
        <button class="card game-card" style="text-align:left" onclick="openGame('${g.id}')">
          <div class="row">
            <div class="row" style="justify-content:flex-start">
              <div class="game-icon">🎮</div>
              <div><h3>${esc(g.name)}</h3><div class="game-meta">${g.status === "completed" ? "Completed" : "Active"} · Round ${g.round}</div></div>
            </div>
            <span class="chevron">›</span>
          </div>
        </button>`).join("") : `<div class="card empty">No saved games yet.<br>Choose a game type above to start.</div>`}
    </div>`;
}

function renderPlayers() {
  $("#content").innerHTML = `
    <div class="row page-intro"><div><h2>Players</h2><p>Reusable across any game</p></div><button class="btn primary" onclick="newPlayer()">+ Add</button></div>
    <div class="stack">
      ${state.players.length ? state.players.map(p => `
        <div class="card row">
          <div class="row" style="justify-content:flex-start">${avatar(p)}<div><div class="player-name">${esc(p.name)}</div></div></div>
          <div class="actions"><button class="btn small" onclick="editPlayer('${p.id}')">Edit</button><button class="btn small danger" onclick="deletePlayer('${p.id}')">Delete</button></div>
        </div>`).join("") : `<div class="card empty">No players yet.</div>`}
    </div>`;
}

async function renderHistory() {
  const ids = state.games.map(g => g.id);
  if (!ids.length) { $("#content").innerHTML = `<div class="card empty">No game history yet.</div>`; return; }
  const { data, error } = await sb.from("score_changes").select("*, players(name)").in("game_id", ids).order("created_at", { ascending: false });
  if (error) { toast(error.message); return; }
  const by = {}; (data || []).forEach(x => (by[x.game_id] ??= []).push(x));
  $("#content").innerHTML = `
    <div class="page-intro"><h2>All Game History</h2><p>Choose a game to see each player's history.</p></div>
    <div class="stack">
      ${state.games.map(g => `
        <button class="card row history-game" style="text-align:left" onclick="historyGame('${g.id}')">
          <div class="row" style="justify-content:flex-start"><div class="game-icon">🎮</div><div><h3>${esc(g.name)}</h3><div class="game-meta">${(by[g.id] || []).length} score change${(by[g.id] || []).length === 1 ? "" : "s"} · Round ${g.round}</div></div></div><span class="chevron">›</span>
        </button>`).join("")}
    </div>`;
}

function renderSettings() {
  $("#content").innerHTML = `
    <div class="stack">
      <div class="card settings-card"><h2>Appearance</h2><p>Use the classic light style or the bluish dark style.</p>
        <button class="btn" onclick="toggleTheme()">Current: ${state.theme === "dark" ? "Dark" : "Light"} mode</button>
      </div>
      <div class="card settings-card">
        <h2>UnderCut</h2>
        <p>Change the points used by the UnderCut action. Defaults are 60 points awarded to the player who undercuts and 10 points deducted from the lowest player(s).</p>
        <div class="setting-row"><label for="undercutAward">Undercut points</label><input id="undercutAward" class="input setting-input" type="number" min="0" step="1" value="${state.undercutSettings.undercutAward}"></div>
        <div class="setting-row"><label for="undercutPenalty">Lowest player deduction</label><input id="undercutPenalty" class="input setting-input" type="number" min="0" step="1" value="${state.undercutSettings.undercutPenalty}"></div>
        <button class="btn primary" onclick="saveUndercutSettingUI()">Save UnderCut settings</button>
      </div>
      <div class="card settings-card"><h2>Scoring</h2><p>For the general scorekeeper, tap a player and enter any amount. The other game types are listed now and their scoring systems can be added later.</p></div>
    </div>`;
}

async function saveUndercutSettingUI() {
  const award = Math.max(0, Math.trunc(Number($("#undercutAward").value)));
  const penalty = Math.max(0, Math.trunc(Number($("#undercutPenalty").value)));
  if (!Number.isFinite(award) || !Number.isFinite(penalty)) { toast("Enter valid points"); return; }
  state.undercutSettings = { undercutAward: award, undercutPenalty: penalty };
  saveUndercutSettings();
  toast("UnderCut settings saved");
}

async function newPlayer() {
  const name = prompt("Player name");
  if (!name?.trim()) return;
  const { error } = await sb.from("players").insert({ name: name.trim() });
  if (error) toast(error.message); else { toast("Player added"); await loadAll(); }
}
async function editPlayer(id) {
  const p = state.players.find(x => x.id === id); if (!p) return;
  const name = prompt("Player name", p.name); if (!name?.trim()) return;
  const { error } = await sb.from("players").update({ name: name.trim() }).eq("id", id);
  if (error) toast(error.message); else loadAll();
}
async function deletePlayer(id) {
  if (!confirm("Delete this player? Their player record and game links will be removed.")) return;
  const { error } = await sb.from("players").delete().eq("id", id);
  if (error) toast(error.message); else loadAll();
}

function newGame(preset = "") {
  const selectedPreset = preset || "UnderCut";
  showModal(`
    <h2>New Game</h2>
    <div class="game-choice-grid">
      ${["UnderCut", "Lavaa", "Dingu", "Hukun kaalaa"].map(name => `<button class="game-choice ${name === selectedPreset ? "selected" : ""}" onclick="selectGamePreset('${esc(name)}')"><span>🎮</span><b>${esc(name)}</b><small>${name === "UnderCut" ? "Scoring ready" : "Coming later"}</small></button>`).join("")}
    </div>
    <input id="gameName" class="input" placeholder="Game name" value="${esc(selectedPreset)}">
    <div class="section-title">Choose players</div>
    <div class="stack" id="playerChoices">${state.players.map(p => `<label class="card row choice-row"><span class="row" style="justify-content:flex-start"><input type="checkbox" value="${p.id}"> ${esc(p.name)}</span></label>`).join("") || `<div class="notice">Add players first from the Players tab.</div>`}</div>
    <div class="actions" style="margin-top:15px"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="createGame()">Create Game</button></div>`);
}
function selectGamePreset(name) {
  $("#gameName").value = name;
  document.querySelectorAll(".game-choice").forEach(b => b.classList.toggle("selected", b.textContent.includes(name)));
}
async function createGame() {
  const name = $("#gameName").value.trim() || "Card Game";
  const selected = [...document.querySelectorAll("#playerChoices input:checked")].map(x => x.value);
  if (!selected.length) { toast("Choose at least one player"); return; }
  const { data: g, error } = await sb.from("games").insert({ name, sort_mode: "custom" }).select().single();
  if (error) { toast(error.message); return; }
  const rows = selected.map((pid, i) => ({ game_id: g.id, player_id: pid, score: 0, player_order: i }));
  const { error: e } = await sb.from("game_players").insert(rows);
  if (e) { toast(e.message); return; }
  closeModal(); await loadAll(); openGame(g.id);
}

async function openGame(id) {
  const { data: g, error: ge } = await sb.from("games").select("*").eq("id", id).single();
  const { data: gp, error: pe } = await sb.from("game_players").select("*, players(*)").eq("game_id", id).order("player_order");
  if (ge || pe || !g || !gp) { toast("Could not load game"); return; }
  state.game = g; state.gamePlayers = gp; state.sortMode = g.sort_mode || "custom";
  await loadGameHistory();
  renderGame();
}
async function loadGameHistory() {
  const { data, error } = await sb.from("score_changes").select("*, players(name)").eq("game_id", state.game.id).order("created_at", { ascending: false });
  if (error) { toast(error.message); state.history = []; return; }
  state.history = data || [];
}
function orderedPlayers() {
  const arr = [...state.gamePlayers];
  if (state.sortMode === "highest") return arr.sort((a, b) => b.score - a.score);
  if (state.sortMode === "lowest") return arr.sort((a, b) => a.score - b.score);
  return arr.sort((a, b) => a.player_order - b.player_order);
}

function previousRoundLabel(pid) {
  const previousRound = Number(state.game.round) - 1;
  if (previousRound < 1) return `Round ${state.game.round}`;
  const roundScore = state.history
    .filter(x => x.player_id === pid && Number(x.round) === previousRound)
    .reduce((sum, x) => sum + Number(x.delta || 0), 0);
  return `Round ${previousRound}: ${roundScore}`;
}

function renderGame() {
  setTitle(state.game.name);
  const ps = orderedPlayers();
  const undercut = isUnderCutGame();
  $("#content").innerHTML = `
    <div class="game-header">
      <button class="btn small" onclick="goGames()">‹ Games</button>
      <div class="game-title-center"><h2>${esc(state.game.name)}</h2><div class="game-meta">Round ${state.game.round}</div></div>
      <button class="btn small" onclick="gameMenu()">•••</button>
    </div>
    ${!undercut && state.game.name !== "Lavaa" && state.game.name !== "Dingu" && state.game.name !== "Hukun kaalaa" ? `<div class="notice" style="margin-bottom:12px">General scorekeeper mode. Tap a player to enter any score.</div>` : ""}
    ${undercut ? `<div class="notice undercut-notice"><b>UnderCut</b> scoring is active. Tap a player for scoring options.</div>` : state.game.name !== "UnderCut" ? `<div class="notice" style="margin-bottom:12px"><b>${esc(state.game.name)}</b> is ready as a game slot. Its scoring system will be added later.</div>` : ""}
    <div class="player-list">
      ${ps.map(gp => `
        <button class="simple-player" onclick="scorePlayer('${gp.player_id}')">
          ${avatar(gp.players)}
          <div class="simple-player-main"><div class="player-name">${esc(gp.players.name)}</div><div class="player-sub">${previousRoundLabel(gp.player_id)}</div></div>
          <div class="score-big">${gp.score}</div><span class="chevron">›</span>
        </button>`).join("")}
    </div>
    ${!undercut ? `<div class="section-title">Quick score</div><div class="quick"><button onclick="quickScore(5)">+5</button><button onclick="quickScore(10)">+10</button><button onclick="quickScore(-5)">−5</button></div>` : ""}
    <div class="actions game-actions">
      <button class="btn" onclick="undo()">↶ Undo</button>
      <button class="btn" onclick="historyGame('${state.game.id}')">History</button>
      <button class="btn primary" style="flex:1" onclick="nextRound()">Next Round</button>
    </div>
    ${state.game.status === "active" ? `<button class="btn finish-btn" onclick="finishGame()">Finish Game</button>` : `<div class="notice">This game is finished. You can still view its history.</div>`}`;
}

let selectedPlayerId = null;

function scorePlayer(pid) {
  selectedPlayerId = pid;
  const gp = state.gamePlayers.find(x => x.player_id === pid);
  const p = gp?.players;
  if (!p) return;

  showModal(`
    <div class="player-modal-head">${avatar(p)}<div><h2>${esc(p.name)}</h2><div class="game-meta">Round ${state.game.round} · Total ${gp.score}</div></div></div>
    <div class="score-display" id="scoreDisplay">0</div>
    <div class="score-entry-head"><button class="score-link" onclick="undo()">↶ Undo</button><button class="score-link" onclick="redoLast()">Redo</button></div>
    <input id="scoreAmount" class="score-key-input" type="number" inputmode="numeric" placeholder="0" autocomplete="off">
    <div class="score-mode">
      <button id="addMode" onclick="saveScore(1)">＋</button>
      <button id="subMode" onclick="saveScore(-1)">−</button>
    </div>
    ${isUnderCutGame() ? `<button class="undercut-action" onclick="startUndercut('${pid}')"><span>✦</span><b>Undercut</b><small>+${state.undercutSettings.undercutAward} points</small></button>` : ""}
    <div class="actions" style="margin-top:14px"><button class="btn" onclick="closeModal()">Cancel</button></div>`);

  const input = $("#scoreAmount");
  input.addEventListener("input", () => {
    $("#scoreDisplay").textContent = input.value || "0";
  });
  input.focus();
}

async function applyDelta(pid, delta) {
  const gp = state.gamePlayers.find(x => x.player_id === pid);
  if (!gp || !delta) return false;
  const { error: e } = await sb.from("score_changes").insert({
    game_id: state.game.id,
    player_id: pid,
    round: state.game.round,
    delta
  });
  if (e) { toast(e.message); return false; }
  const { error: u } = await sb.from("game_players").update({ score: gp.score + delta }).eq("id", gp.id);
  if (u) { toast(u.message); return false; }
  return true;
}

async function saveScore(direction) {
  const input = $("#scoreAmount");
  const amount = Number(input?.value);
  if (!Number.isFinite(amount)) { toast("Enter a score"); return; }
  const wholeAmount = Math.trunc(Math.abs(amount));
  if (!wholeAmount) { toast("Enter a score other than 0"); return; }

  const delta = wholeAmount * direction;
  if (!(await applyDelta(selectedPlayerId, delta))) return;

  await sb.from("games").update({ updated_at: new Date().toISOString() }).eq("id", state.game.id);
  closeModal();
  await openGame(state.game.id);
  toast(delta >= 0 ? `+${delta}` : `${delta}`);
}

async function quickScore(delta) {
  if (!selectedPlayerId) { toast("Tap a player first"); return; }
  if (!(await applyDelta(selectedPlayerId, delta))) return;
  await openGame(state.game.id);
}

function startUndercut(pid) {
  if (!isUnderCutGame()) return;
  closeModal();
  const candidates = state.gamePlayers.filter(gp => gp.player_id !== pid);
  showModal(`
    <div class="undercut-modal">
      <div class="undercut-symbol">✦</div>
      <h2>Undercut</h2>
      <p class="question">Who has the lowest?</p>
      <p>Select one or more players. Each selected player receives −${state.undercutSettings.undercutPenalty} points.</p>
      <div class="lowest-grid" id="lowestGrid">
        ${candidates.map(gp => `<button class="lowest-player" data-pid="${gp.player_id}" onclick="toggleLowest(this)">${avatar(gp.players)}<span>${esc(gp.players.name)}</span></button>`).join("")}
      </div>
      <div class="undercut-summary">${esc(state.gamePlayers.find(x => x.player_id === pid).players.name)} receives <b>+${state.undercutSettings.undercutAward}</b></div>
      <div class="actions"><button class="btn" onclick="scorePlayer('${pid}')">Back</button><button class="btn primary" onclick="confirmUndercut('${pid}')">Apply Undercut</button></div>
    </div>`);
}
function toggleLowest(btn) { btn.classList.toggle("selected"); }
async function confirmUndercut(pid) {
  const selected = [...document.querySelectorAll(".lowest-player.selected")].map(x => x.dataset.pid);
  if (!selected.length) { toast("Choose who has the lowest"); return; }
  const award = state.undercutSettings.undercutAward;
  const penalty = state.undercutSettings.undercutPenalty;
  closeModal();
  if (!(await applyDelta(pid, award))) return;
  for (const lowPid of selected) {
    if (!(await applyDelta(lowPid, -penalty))) return;
  }
  await sb.from("games").update({ updated_at: new Date().toISOString() }).eq("id", state.game.id);
  await openGame(state.game.id);
  celebrate(`UNDERCUT +${award}`);
}

async function undo() {
  const last = state.history[0]; if (!last) { toast("Nothing to undo"); return; }
  const gp = state.gamePlayers.find(x => x.player_id === last.player_id); if (!gp) return;
  await sb.from("game_players").update({ score: gp.score - last.delta }).eq("id", gp.id);
  await sb.from("score_changes").delete().eq("id", last.id);
  await openGame(state.game.id); toast("Undone");
}
async function redoLast() { toast("Redo is available after an undo in a future update"); }
async function nextRound() {
  if (state.game.status === "completed") return;
  await sb.from("games").update({ round: state.game.round + 1, updated_at: new Date().toISOString() }).eq("id", state.game.id);
  await openGame(state.game.id);
  celebrate("ROUND " + state.game.round);
}
async function finishGame() {
  const ps = orderedPlayers(); if (!ps.length) return;
  const sorted = [...ps].sort((a, b) => isUnderCutGame() ? a.score - b.score : b.score - a.score);
  const winner = sorted[0];
  await sb.from("games").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", state.game.id);
  state.game.status = "completed";
  showWinners(sorted, winner);
}
function showWinners(sorted, winner) {
  showModal(`<div class="winner"><div class="trophy">🏆</div><div class="winner-kicker">GAME OVER</div><div class="winner-label">Winner</div><div class="winner-name">${esc(winner.players.name)}</div><div class="score-big winner-score">${winner.score}</div><div class="podium">${sorted.slice(0, 3).map((p, i) => `<div class="card"><div class="place">${["1ST", "2ND", "3RD"][i]}</div>${avatar(p.players)}<div class="player-name" style="margin-top:8px">${esc(p.players.name)}</div><div class="score">${p.score}</div></div>`).join("")}</div><div class="actions" style="margin-top:18px"><button class="btn primary" onclick="closeModal();renderGame()">Return to Game</button><button class="btn" onclick="goGames()">Games</button></div></div>`);
}
function gameMenu() {
  showModal(`<h2>${esc(state.game.name)}</h2><div class="stack"><button class="btn" onclick="sortPlayers()">Choose player order</button><button class="btn" onclick="renameGame()">Rename game</button><button class="btn" onclick="historyGame('${state.game.id}')">Game history</button><button class="btn danger" onclick="deleteGame('${state.game.id}')">Delete game</button><button class="btn" onclick="closeModal()">Cancel</button></div>`);
}
function sortPlayers() {
  showModal(`<h2>Player order</h2><div class="stack"><button class="btn" onclick="setSort('custom')">Custom order</button><button class="btn" onclick="setSort('highest')">Highest score first</button><button class="btn" onclick="setSort('lowest')">Lowest score first</button><button class="btn" onclick="customOrder()">Edit custom order</button></div>`);
}
async function setSort(mode) {
  await sb.from("games").update({ sort_mode: mode }).eq("id", state.game.id);
  state.sortMode = mode; state.game.sort_mode = mode; closeModal(); renderGame();
}
function customOrder() {
  const rows = [...state.gamePlayers].sort((a, b) => a.player_order - b.player_order);
  showModal(`<h2>Custom order</h2><div class="order-list">${rows.map((gp, i) => `<div class="order-row"><b>${i + 1}</b><span>${esc(gp.players.name)}</span><span class="actions"><button class="btn small" onclick="movePlayer('${gp.id}',-1)">↑</button><button class="btn small" onclick="movePlayer('${gp.id}',1)">↓</button></span></div>`).join("")}</div><button class="btn primary" style="width:100%;margin-top:15px" onclick="setSort('custom')">Done</button>`);
}
async function movePlayer(id, dir) {
  const rows = [...state.gamePlayers].sort((a, b) => a.player_order - b.player_order);
  const i = rows.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= rows.length) return;
  [rows[i].player_order, rows[j].player_order] = [rows[j].player_order, rows[i].player_order];
  for (const r of rows) await sb.from("game_players").update({ player_order: r.player_order }).eq("id", r.id);
  await openGame(state.game.id); customOrder();
}
async function renameGame() {
  const n = prompt("Game name", state.game.name); if (!n?.trim()) return;
  await sb.from("games").update({ name: n.trim(), updated_at: new Date().toISOString() }).eq("id", state.game.id);
  closeModal(); await loadAll(); openGame(state.game.id);
}
async function deleteGame(id) {
  if (!confirm("Delete this game and all its score history?")) return;
  const { error } = await sb.from("games").delete().eq("id", id);
  if (error) toast(error.message); else { closeModal(); state.game = null; await loadAll(); }
}
async function historyGame(id) {
  const g = state.games.find(x => x.id === id) || (state.game?.id === id ? state.game : null); if (!g) return;
  const { data, error } = await sb.from("score_changes").select("*, players(name)").eq("game_id", id).order("created_at", { ascending: false });
  if (error) { toast(error.message); return; }
  const groups = {}; (data || []).forEach(x => (groups[x.player_id] ??= []).push(x));
  closeModal();
  showModal(`<h2>${esc(g.name)} History</h2><div class="stack">${Object.entries(groups).length ? Object.entries(groups).map(([pid, arr]) => `<button class="card row" style="text-align:left" onclick="playerHistory('${id}','${pid}')"><div><h3>${esc(arr[0].players?.name || "Player")}</h3><div class="game-meta">${arr.length} changes</div></div><span class="chevron">›</span></button>`).join("") : `<div class="empty">No score history.</div>`}</div><div class="actions" style="margin-top:14px"><button class="btn danger" onclick="deleteGameHistory('${id}')">Delete history</button><button class="btn" onclick="closeModal()">Close</button></div>`);
}
async function playerHistory(gid, pid) {
  const { data } = await sb.from("score_changes").select("*, players(name)").eq("game_id", gid).eq("player_id", pid).order("created_at", { ascending: false });
  const p = data?.[0]?.players?.name || "Player";
  let running = 0;
  const chronological = [...(data || [])].reverse().map(x => { running += x.delta; return { ...x, running }; }).reverse();
  showModal(`<h2>${esc(p)} History</h2><div class="stack">${chronological.length ? chronological.map(x => `<div class="history-item row"><div><b>Round ${x.round}</b><div class="game-meta">${new Date(x.created_at).toLocaleString()}</div></div><div style="text-align:right"><div class="delta ${x.delta >= 0 ? "pos" : "neg"}">${x.delta >= 0 ? "+" : ""}${x.delta}</div><div class="game-meta">Total ${x.running}</div></div></div>`).join("") : `<div class="empty">No history.</div>`}</div><button class="btn" style="width:100%;margin-top:14px" onclick="historyGame('${gid}')">Back to game history</button>`);
}
async function deleteGameHistory(gid) {
  if (!confirm("Delete all score history for this game? The current scores will remain.")) return;
  const { error } = await sb.from("score_changes").delete().eq("game_id", gid);
  if (error) toast(error.message); else { toast("History deleted"); historyGame(gid); }
}
function goGames() { closeModal(); state.tab = "games"; render(); }
function showModal(html) { $("#modalRoot").innerHTML = `<div class="modal-backdrop" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`; }
function closeModal() { $("#modalRoot").innerHTML = ""; }
function celebrate(text) { const el = document.createElement("div"); el.className = "celebrate"; el.textContent = "✓ " + text; document.body.appendChild(el); setTimeout(() => el.remove(), 1300); }
function toggleTheme() { state.theme = state.theme === "dark" ? "light" : "dark"; localStorage.setItem("score_theme", state.theme); document.documentElement.dataset.theme = state.theme; render(); }

document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => { closeModal(); state.tab = b.dataset.tab; render(); }));
$("#themeBtn").addEventListener("click", toggleTheme);

const style = document.createElement("style");
style.textContent = `.celebrate{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%) scale(.7);z-index:100;background:var(--accent);color:white;padding:18px 28px;border-radius:18px;font-size:22px;font-weight:900;box-shadow:0 12px 40px rgba(0,0,0,.25);animation:celebrate 1.25s ease both}@keyframes celebrate{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}25%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}70%{transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-70%) scale(1)}}`;
document.head.appendChild(style);
loadAll();
