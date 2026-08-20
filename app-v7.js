const { createClient } = window.supabase;
const sb = createClient(SCORE_CONFIG.SUPABASE_URL, SCORE_CONFIG.SUPABASE_PUBLISHABLE_KEY);

const DEFAULT_SETTINGS = { undercutAward: 60, undercutPenalty: 10, roundWinnerPenalty: 10 };
const state = {
  session: null,
  profile: null,
  tab: "games",
  games: [],
  completedGames: [],
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
  const value = p?.avatar_url || "";
  if (value.startsWith("emoji:")) return `<div class="avatar avatar-emoji">${esc(value.slice(6))}</div>`;
  if (value) return `<img class="avatar" src="${esc(value)}" alt="">`;
  return `<div class="avatar">${esc((p?.name || "?").slice(0, 1).toUpperCase())}</div>`;
}
function setTitle(t) { $("#pageTitle").textContent = t; }

function usernameEmail(username){ return username.trim().toLowerCase() + "@scorekeeper.app"; }
function renderAuth(){
  document.body.classList.add("auth-mode");
  $("#app").innerHTML = `<div class="auth-wrap"><div class="auth-card"><div class="auth-logo">🎮</div><div class="eyebrow">CARD SCOREKEEPER</div><h1>Scorekeeper</h1><p id="authText">Sign in with your username and password.</p><input id="authUsername" class="input" autocomplete="username" placeholder="Username"><input id="authPassword" class="input" type="password" autocomplete="current-password" placeholder="Password"><button id="authAction" class="btn primary auth-submit" onclick="authSubmit()">Log in</button><button class="btn auth-switch" onclick="toggleAuthMode()" id="authSwitch">Create an account</button><div id="authMessage" class="auth-message"></div></div></div>`;
  window.authSignup=false;
}
function toggleAuthMode(){ window.authSignup=!window.authSignup; $("#authText").textContent=window.authSignup?"Create your private Scorekeeper account.":"Sign in with your username and password."; $("#authAction").textContent=window.authSignup?"Create account":"Log in"; $("#authSwitch").textContent=window.authSignup?"I already have an account":"Create an account"; $("#authPassword").autocomplete=window.authSignup?"new-password":"current-password"; }
async function getFreshSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  state.session = data.session;
  if (!state.session?.user?.id) throw new Error("Your login session is not ready. Please log in again.");
  return state.session;
}
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function runWithTimeout(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    })]);
  } finally { clearTimeout(timer); }
}

async function authSubmit(){
  const u=$("#authUsername").value.trim().toLowerCase(), p=$("#authPassword").value;
  if(!/^[a-z0-9_]{3,24}$/.test(u)){ $("#authMessage").textContent="Use 3 to 24 letters, numbers, or underscores."; return; }
  if(p.length<6){ $("#authMessage").textContent="Password must be at least 6 characters."; return; }
  const email=usernameEmail(u);
  const action=$("#authAction"), message=$("#authMessage");
  action.disabled=true;
  message.textContent="Please wait…";
  try {
    let result;
    if(window.authSignup){
      const { data: existingProfile, error: profileError } = await runWithTimeout(
        sb.from("profiles").select("id").eq("username", u).maybeSingle(), 10000,
        "The database took too long to respond. Please try again."
      );
      if(profileError && !/row|permission|policy/i.test(profileError.message || "")) throw profileError;
      if(existingProfile) throw new Error("That username is already in use.");
      result=await runWithTimeout(
        sb.auth.signUp({email,password:p,options:{data:{username:u}}}), 15000,
        "Account creation timed out. Please try again."
      );
    } else {
      result=await runWithTimeout(
        sb.auth.signInWithPassword({email,password:p}), 15000,
        "Login timed out. Please try again."
      );
    }
    if(result.error) throw result.error;
    if(window.authSignup && !result.data.session){
      message.textContent="Account created. Email confirmation must be disabled in Supabase for username-only login.";
      return;
    }
    await wait(150);
    await getFreshSession();
    await runWithTimeout(ensureProfile(u), 10000, "Your account loaded, but the profile request timed out.");
    await runWithTimeout(loadAll(), 15000, "Login succeeded, but loading your games timed out. Please refresh once.");
  } catch(err) {
    console.error("Authentication error", err);
    message.textContent=err?.message || "Unable to sign in. Please try again.";
  } finally {
    action.disabled=false;
    if(state.session && !message.textContent.includes("timed out")) message.textContent="";
  }
}

async function ensureProfile(username){
  if(!state.session) return;
  const {data,error}=await sb.from("profiles").select("*").eq("id",state.session.user.id).maybeSingle();
  if(error) throw error;
  if(data){state.profile=data;return;}
  const {data:created,error:insertError}=await sb.from("profiles").insert({id:state.session.user.id,username:username||state.session.user.user_metadata?.username||"user"}).select().single();
  if(insertError) throw insertError;
  state.profile=created||null;
}
async function bootAuth(){
  try {
    sb.auth.onAuthStateChange((_event,session)=>{
      state.session=session;
      if(!session){
        state.profile=null; state.games=[]; state.completedGames=[]; state.players=[];
        renderAuth();
      }
    });

    const {data,error}=await runWithTimeout(sb.auth.getSession(), 10000,
      "The login service took too long to respond. Please refresh and try again.");
    if(error) throw error;

    state.session=data.session;
    if(state.session){
      await wait(100);
      await getFreshSession();
      await runWithTimeout(
        ensureProfile(state.session.user.user_metadata?.username), 10000,
        "Your account loaded, but the profile request timed out."
      );
      await runWithTimeout(
        loadAll(), 15000,
        "Your account loaded, but your games could not be loaded in time."
      );
    } else {
      renderAuth();
    }
  } catch(err) {
    console.error("Boot auth error", err);
    state.session=null;
    renderAuth();
    $("#authMessage").textContent=err?.message || "Unable to connect to the account service.";
  }
}

async function logout(){ await sb.auth.signOut(); }
async function loadAll() {
  if (!state.session) return renderAuth();
  const [g, p] = await Promise.all([
    sb.from("games").select("*").order("updated_at", { ascending: false }),
    sb.from("players").select("*").order("name")
  ]);
  if (g.error) throw g.error;
  if (p.error) throw p.error;
  const allGames = g.data || [];
  state.games = allGames.filter(x => x.status !== "completed");
  state.completedGames = allGames.filter(x => x.status === "completed");
  state.players = p.data || [];
  document.body.classList.remove("auth-mode");
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
      <div><h2>Your Games</h2><p>${state.games.length} ongoing game${state.games.length === 1 ? "" : "s"}</p></div>
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
              <div><h3>${esc(g.name)}</h3><div class="game-meta">Active · Round ${g.round}</div></div>
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
  const ids = state.completedGames.map(g => g.id);
  if (!ids.length) { $("#content").innerHTML = `<div class="card empty">No game history yet.</div>`; return; }
  const { data, error } = await sb.from("score_changes").select("*, players(name)").in("game_id", ids).order("created_at", { ascending: false });
  if (error) { toast(error.message); return; }
  const by = {}; (data || []).forEach(x => (by[x.game_id] ??= []).push(x));
  $("#content").innerHTML = `
    <div class="page-intro"><h2>Game History</h2><p>Finished games are kept here. Ongoing games stay in Games.</p></div>
    <div class="stack">
      ${state.completedGames.map(g => `
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
        <div class="setting-row"><label for="roundWinnerPenalty">Round Winner deduction</label><input id="roundWinnerPenalty" class="input setting-input" type="number" min="0" step="1" value="${state.undercutSettings.roundWinnerPenalty}"></div>
        <button class="btn primary" onclick="saveUndercutSettingUI()">Save UnderCut settings</button>
      </div>
      <div class="card settings-card"><h2>Account</h2><p>Signed in as <b>@${esc(state.profile?.username || "user")}</b>. Your games and players are private to this account.</p><button class="btn danger" onclick="logout()">Log out</button></div>
      <div class="card settings-card"><h2>Scoring</h2><p>For the general scorekeeper, tap a player and enter any amount. The other game types are listed now and their scoring systems can be added later.</p></div>
    </div>`;
}

async function saveUndercutSettingUI() {
  const award = Math.max(0, Math.trunc(Number($("#undercutAward").value)));
  const penalty = Math.max(0, Math.trunc(Number($("#undercutPenalty").value)));
  const roundWinnerPenalty = Math.max(0, Math.trunc(Number($("#roundWinnerPenalty").value)));
  if (!Number.isFinite(award) || !Number.isFinite(penalty) || !Number.isFinite(roundWinnerPenalty)) { toast("Enter valid points"); return; }
  state.undercutSettings = { undercutAward: award, undercutPenalty: penalty, roundWinnerPenalty };
  saveUndercutSettings();
  toast("UnderCut settings saved");
}

let playerAvatarDraft = "";
let pendingGameAddId = null;

function newPlayer(forGameId = null) {
  pendingGameAddId = forGameId;
  playerAvatarDraft = "";
  showPlayerEditor(null);
}

function showPlayerEditor(existing) {
  const p = existing;
  showModal(`
    <h2>${p ? "Edit Player" : "Add Player"}</h2>
    <div class="player-preview" id="playerPreview">${avatar(p || { name: "Player", avatar_url: playerAvatarDraft })}</div>
    <input id="playerName" class="input" placeholder="Player name" value="${esc(p?.name || "")}">
    <div class="avatar-section-title">Picture</div>
    <label class="btn avatar-upload"><span>📷 Choose picture</span><input id="playerPhoto" type="file" accept="image/*" onchange="handleAvatarFile(this)"></label>
    <div class="avatar-section-title">Emoji</div>
    <div class="emoji-grid">${["😀","😎","🤠","🥳","🤓","🧑","👨","👩","🧔","🧑‍🎤","🦊","🐼","🐯","🐸","🐵","🐨"].map(e => `<button class="emoji-choice" type="button" onclick="choosePlayerEmoji('${e}')">${e}</button>`).join("")}</div>
    <div class="actions" style="margin-top:16px"><button class="btn" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="savePlayer(${p ? `'${p.id}'` : "null"})">${p ? "Save changes" : "Add Player"}</button></div>`);
}

function choosePlayerEmoji(emoji) {
  playerAvatarDraft = "emoji:" + emoji;
  const name = $("#playerName")?.value || "Player";
  $("#playerPreview").innerHTML = avatar({ name, avatar_url: playerAvatarDraft });
}

function handleAvatarFile(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { toast("Choose an image"); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 256;
      const scale = Math.min(size / img.width, size / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      playerAvatarDraft = canvas.toDataURL("image/jpeg", 0.78);
      const name = $("#playerName")?.value || "Player";
      $("#playerPreview").innerHTML = avatar({ name, avatar_url: playerAvatarDraft });
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

async function savePlayer(id) {
  const name = $("#playerName")?.value.trim();
  if (!name) { toast("Enter a player name"); return; }
  const payload = { name, avatar_url: playerAvatarDraft || null, owner_id: state.session.user.id };
  const result = id
    ? await sb.from("players").update(payload).eq("id", id).select().single()
    : await sb.from("players").insert(payload).select().single();
  if (result.error) { toast(result.error.message); return; }
  const createdPlayer = result.data;
  const targetGameId = pendingGameAddId;
  pendingGameAddId = null;
  closeModal();
  toast(id ? "Player updated" : "Player added");
  await loadAll();
  if (!id && targetGameId) {
    await attachPlayerToGame(targetGameId, createdPlayer.id);
    if (state.game?.id === targetGameId) await openGame(targetGameId);
  }
}

async function editPlayer(id) {
  const p = state.players.find(x => x.id === id); if (!p) return;
  playerAvatarDraft = p.avatar_url || "";
  showPlayerEditor(p);
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

  const createButton = document.querySelector("#modalRoot .btn.primary:last-child");
  if (createButton) { createButton.disabled=true; createButton.textContent="Creating…"; }

  try {
    const session = await runWithTimeout(getFreshSession(), 8000,
      "Your login session is not ready. Please log in again.");
    const ownerId = session.user.id;

    const { data: g, error } = await runWithTimeout(
      sb.from("games")
        .insert({ name, sort_mode: "custom", owner_id: ownerId })
        .select("id,name,round,status,sort_mode,owner_id")
        .single(),
      12000,
      "Creating the game timed out. Please try again."
    );
    if (error) throw error;
    if (!g?.id) throw new Error("The game was created without an ID. Please try again.");

    const rows = selected.map((pid, i) => ({
      game_id: g.id, player_id: pid, score: 0, player_order: i, owner_id: ownerId
    }));

    const { error: e } = await runWithTimeout(
      sb.from("game_players").insert(rows), 12000,
      "The game was created, but adding its players timed out."
    );
    if (e) {
      await sb.from("games").delete().eq("id", g.id);
      throw e;
    }

    closeModal();
    await runWithTimeout(loadAll(), 15000, "Game created, but refreshing your games timed out.");
    await runWithTimeout(openGame(g.id), 15000, "Game created, but opening it timed out.");
  } catch(err) {
    console.error("Create game error", err);
    toast(err?.message || "Could not create game");
    if (createButton) { createButton.disabled=false; createButton.textContent="Create Game"; }
  }
}

async function openGame(id) {
  const [gameResult, playersResult, historyResult] = await Promise.all([
    sb.from("games").select("*").eq("id", id).single(),
    sb.from("game_players").select("*, players(*)").eq("game_id", id).order("player_order"),
    sb.from("score_changes").select("*, players(name)").eq("game_id", id).order("created_at", { ascending: false })
  ]);
  const { data: g, error: ge } = gameResult;
  const { data: gp, error: pe } = playersResult;
  const { data: history, error: he } = historyResult;
  if (ge || pe || he || !g || !gp) {
    toast(ge?.message || pe?.message || he?.message || "Could not load game");
    return;
  }
  state.game = g;
  state.gamePlayers = gp;
  state.history = history || [];
  state.sortMode = g.sort_mode || "custom";
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

function roundScore(pid, round = state.game.round) {
  return state.history
    .filter(x => x.player_id === pid && Number(x.round) === Number(round))
    .reduce((sum, x) => sum + Number(x.delta || 0), 0);
}
function currentWinner() {
  const ps = orderedPlayers();
  if (!ps.length) return null;
  return [...ps].sort((a, b) => isUnderCutGame() ? a.score - b.score : b.score - a.score)[0];
}

function playerRoundLabel(pid) {
  const current = roundScore(pid, state.game.round);
  if (state.game.round > 1) {
    const previousRound = Number(state.game.round) - 1;
    const previous = roundScore(pid, previousRound);
    return `Round ${previousRound}: ${previous} · This round: ${current}`;
  }
  return `This round: ${current}`;
}

function renderGame() {
  setTitle(state.game.name);
  const ps = orderedPlayers();
  const undercut = isUnderCutGame();
  const finished = state.game.status === "completed";
  const winner = finished ? currentWinner() : null;
  const winnerText = winner ? `Winner: ${esc(winner.players.name)} · ${winner.score} points` : "";
  $("#content").innerHTML = `
    <div class="game-header">
      <button class="btn small" onclick="goGames()">‹ Games</button>
      <div class="game-title-center"><h2>${esc(state.game.name)}</h2><div class="game-meta">Round ${state.game.round}</div></div>
      <button class="btn small" onclick="gameMenu()">•••</button>
    </div>
    <div class="player-list">
      ${ps.map(gp => `
        <button class="simple-player" onclick="scorePlayer('${gp.player_id}')">
          ${avatar(gp.players)}
          <div class="simple-player-main"><div class="player-name">${esc(gp.players.name)}</div><div class="player-sub">${playerRoundLabel(gp.player_id)}</div></div>
          <div class="score-big">${gp.score}</div><span class="chevron">›</span>
        </button>`).join("")}
    </div>
    ${finished ? `
      <div class="winner-inline">🏆 <b>${winnerText}</b><small>${undercut ? "Lowest score wins in UnderCut." : "Highest score wins."}</small></div>` : `
      <div class="actions game-actions">
        <button class="btn" onclick="undo()">↶ Undo</button>
        <button class="btn" onclick="historyGame('${state.game.id}')">History</button>
      </div>
      <button class="btn finish-btn" onclick="finishGame()">Finish Game</button>
    `}
    ${!finished ? `<button class="btn primary add-player-game" onclick="addPlayerToGameUI()">＋ Add Player to Game</button>` : ""}`;
}
let selectedPlayerId = null;

function scorePlayer(pid) {
  if (state.game?.status === "completed") return;
  selectedPlayerId = pid;
  const gp = state.gamePlayers.find(x => x.player_id === pid);
  const p = gp?.players;
  if (!p) return;

  showModal(`
    <div class="player-modal-head">${avatar(p)}<div><h2>${esc(p.name)}</h2><div class="game-meta">Round ${state.game.round} · Total ${gp.score}</div></div></div>
    <div class="score-display" id="scoreDisplay">${roundScore(pid, state.game.round)}</div>
    <div class="score-entry-head"><button class="score-link" onclick="undo()">↶ Undo</button><button class="score-link" onclick="redoLast()">Redo</button></div>
    <input id="scoreAmount" class="score-key-input" type="number" inputmode="numeric" placeholder="0" autocomplete="off">
    <div class="score-mode">
      <button id="addMode" onclick="saveScore(1)">＋</button>
      <button id="subMode" onclick="saveScore(-1)">−</button>
    </div>
    ${isUnderCutGame() ? `<button class="undercut-action" onclick="startUndercut('${pid}')"><span>✦</span><b>Undercut</b><small>+${state.undercutSettings.undercutAward} points</small></button><button class="undercut-action" onclick="applyRoundWinner('${pid}')"><span>🏆</span><b>Round Winner</b><small>−${state.undercutSettings.roundWinnerPenalty} points</small></button>` : ""}
    <div class="actions" style="margin-top:14px"><button class="btn" onclick="closeModal()">Cancel</button></div>`);

  const input = $("#scoreAmount");
  input.addEventListener("input", () => {
    $("#scoreDisplay").textContent = input.value || "0";
  });
  input.focus();
}

async function applyDelta(pid, delta) {
  if (state.game?.status === "completed") return false;
  const gp = state.gamePlayers.find(x => x.player_id === pid);
  if (!gp || !Number.isFinite(delta)) return false;
  const round = Number(state.game.round);
  const previousScore = Number(gp.score);
  const newScore = previousScore + delta;
  const localId = `local-${Date.now()}-${Math.random()}`;

  // Update the local state first so the interface responds immediately.
  gp.score = newScore;
  state.history.unshift({
    id: localId,
    game_id: state.game.id,
    player_id: pid,
    round,
    delta,
    created_at: new Date().toISOString(),
    players: gp.players
  });
  renderGame();

  const updatedAt = new Date().toISOString();
  const [changeResult, playerResult, gameResult] = await Promise.all([
    sb.from("score_changes").insert({ game_id: state.game.id, player_id: pid, round, delta, owner_id: state.session.user.id }),
    sb.from("game_players").update({ score: newScore }).eq("id", gp.id),
    sb.from("games").update({ updated_at: updatedAt }).eq("id", state.game.id)
  ]);

  if (changeResult.error || playerResult.error || gameResult.error) {
    gp.score = previousScore;
    state.history = state.history.filter(x => x.id !== localId);
    toast(changeResult.error?.message || playerResult.error?.message || gameResult.error?.message || "Could not save score");
    renderGame();
    return false;
  }
  state.game.updated_at = updatedAt;
  return true;
}

async function saveScore(direction) {
  const input = $("#scoreAmount");
  const amount = Number(input?.value);
  if (!Number.isFinite(amount)) { toast("Enter a score"); return; }
  const wholeAmount = Math.trunc(Math.abs(amount));
  const delta = wholeAmount * direction;
  if (!(await applyDelta(selectedPlayerId, delta))) return;
  closeModal();
  toast(delta >= 0 ? `+${delta}` : `${delta}`);
  await advanceIfRoundComplete();
}

async function advanceIfRoundComplete() {
  if (state.game.status === "completed") return;
  const round = Number(state.game.round);
  const completedPlayers = new Set(
    state.history
      .filter(x => Number(x.round) === round)
      .map(x => x.player_id)
  );
  if (completedPlayers.size < state.gamePlayers.length) return;
  await nextRound(true);
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
async function applyRoundWinner(pid) {
  if (!isUnderCutGame()) return;
  const penalty = state.undercutSettings.roundWinnerPenalty;
  if (!(await applyDelta(pid, -penalty))) return;
  closeModal();
  toast(`−${penalty} Round Winner`);
  await advanceIfRoundComplete();
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
  if (state.game?.status === "completed") return;
  const last = state.history[0]; if (!last) { toast("Nothing to undo"); return; }
  const gp = state.gamePlayers.find(x => x.player_id === last.player_id); if (!gp) return;
  await sb.from("game_players").update({ score: gp.score - last.delta }).eq("id", gp.id);
  await sb.from("score_changes").delete().eq("id", last.id);
  await openGame(state.game.id); toast("Undone");
}
async function redoLast() { toast("Redo is available after an undo in a future update"); }
async function nextRound(auto = false) {
  if (state.game.status === "completed") return;
  const next = Number(state.game.round) + 1;
  const updatedAt = new Date().toISOString();
  const { error } = await sb.from("games").update({ round: next, updated_at: updatedAt }).eq("id", state.game.id);
  if (error) { toast(error.message); return; }
  state.game.round = next;
  state.game.updated_at = updatedAt;
  renderGame();
  celebrate(`ROUND ${next}`);
}
async function finishGame() {
  if (state.game?.status === "completed") return;
  const ps = orderedPlayers(); if (!ps.length) return;
  if (!confirm("Finish this game? Scores will become read-only.")) return;
  const sorted = [...ps].sort((a, b) => isUnderCutGame() ? a.score - b.score : b.score - a.score);
  const winner = sorted[0];
  const { error } = await sb.from("games").update({ status: "completed", updated_at: new Date().toISOString() }).eq("id", state.game.id);
  if (error) { toast(error.message); return; }
  state.game.status = "completed";
  renderGame();
  celebrate(`WINNER: ${winner.players.name}`);
  await loadAll();
  state.game = { ...state.game, status: "completed" };
  renderGame();
}
function showWinners(sorted, winner) {
  showModal(`<div class="winner"><div class="trophy">🏆</div><div class="winner-kicker">GAME OVER</div><div class="winner-label">Winner</div><div class="winner-name">${esc(winner.players.name)}</div><div class="score-big winner-score">${winner.score}</div><div class="podium">${sorted.slice(0, 3).map((p, i) => `<div class="card"><div class="place">${["1ST", "2ND", "3RD"][i]}</div>${avatar(p.players)}<div class="player-name" style="margin-top:8px">${esc(p.players.name)}</div><div class="score">${p.score}</div></div>`).join("")}</div><div class="actions" style="margin-top:18px"><button class="btn primary" onclick="closeModal();renderGame()">Return to Game</button><button class="btn" onclick="goGames()">Games</button></div></div>`);
}
function gameMenu() {
  const finished = state.game.status === "completed";
  showModal(`<h2>${esc(state.game.name)}</h2><div class="stack"><button class="btn" onclick="sortPlayers()">Choose player order</button>${!finished ? `<button class="btn" onclick="addPlayerToGameUI()">＋ Add player</button><button class="btn" onclick="renameGame()">Rename game</button>` : ""}<button class="btn" onclick="historyGame('${state.game.id}')">Game history</button><button class="btn danger" onclick="deleteGame('${state.game.id}')">Delete game</button><button class="btn" onclick="closeModal()">Cancel</button></div>`);
}
function addPlayerToGameUI() {
  if (state.game?.status === "completed") return;
  closeModal();
  const existing = new Set(state.gamePlayers.map(gp => gp.player_id));
  const available = state.players.filter(p => !existing.has(p.id));
  showModal(`<h2>Add player to game</h2><p class="game-meta">Choose an existing player or create a new player. A newly added player starts at 0 points.</p><div class="stack">${available.length ? available.map(p => `<button class="card row" style="text-align:left" onclick="attachPlayerToGame('${state.game.id}','${p.id}')"><span class="row" style="justify-content:flex-start">${avatar(p)}<span class="player-name">${esc(p.name)}</span></span><span class="chevron">＋</span></button>`).join("") : `<div class="empty">No unused players available.</div>`}<button class="btn primary" onclick="newPlayer('${state.game.id}')">＋ Create new player and add</button><button class="btn" onclick="closeModal()">Cancel</button></div>`);
}

async function attachPlayerToGame(gameId, playerId) {
  if (!state.session) return;
  const { data: existing } = await sb.from("game_players").select("id").eq("game_id", gameId).eq("player_id", playerId).maybeSingle();
  if (existing) { toast("Player is already in this game"); return; }
  const order = state.game?.id === gameId ? state.gamePlayers.length : 0;
  const { error } = await sb.from("game_players").insert({ game_id: gameId, player_id: playerId, score: 0, player_order: order, owner_id: state.session.user.id });
  if (error) { toast(error.message); return; }
  closeModal();
  toast("Player added to game");
  if (state.game?.id === gameId) await openGame(gameId);
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
  const g = state.games.find(x => x.id === id) || state.completedGames.find(x => x.id === id) || (state.game?.id === id ? state.game : null); if (!g) return;
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
style.textContent = `.winner-inline{margin-top:18px;padding:18px 20px;border:1px solid var(--border);border-radius:20px;background:var(--card);font-size:18px;display:flex;flex-direction:column;gap:6px}.winner-inline small{color:var(--muted);font-size:14px}.add-player-game{width:100%;margin-top:14px}.celebrate{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%) scale(.7);z-index:100;background:var(--accent);color:white;padding:18px 28px;border-radius:18px;font-size:22px;font-weight:900;box-shadow:0 12px 40px rgba(0,0,0,.25);animation:celebrate 1.25s ease both}@keyframes celebrate{0%{opacity:0;transform:translate(-50%,-50%) scale(.6)}25%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}70%{transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-70%) scale(1)}}`;
document.head.appendChild(style);
bootAuth();
