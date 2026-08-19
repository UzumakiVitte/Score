const { createClient } = window.supabase;
const configured = window.SUPABASE_URL && !window.SUPABASE_URL.startsWith("YOUR_") &&
                   window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.startsWith("YOUR_");
const db = configured ? createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const THEME_KEY = "scoremate-theme";

let players = [];
let games = [];
let history = [];
let currentGameId = null;
let currentHistoryGameId = null;
let currentPlayerHistoryId = null;
let currentFilter = "active";
let pendingScore = 0;

const colors = ["#6b45d8","#2d76d2","#2d9d5c","#d69b00","#c75a43","#218d9e","#a044b6","#68707c"];

function esc(s){return String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}
function initials(name){return String(name||"?").trim().slice(0,1).toUpperCase()||"?";}
function avatarHTML(p,i=0,cls="avatar"){
  if(p?.avatar_url) return `<img class="${cls} avatar-photo" src="${esc(p.avatar_url)}" alt="">`;
  return `<span class="${cls}" style="--avatar:${colors[i%colors.length]}">${initials(p?.name)}</span>`;
}
function playerName(id){return players.find(p=>p.id===id)?.name || "Player";}
function playerObj(id){return players.find(p=>p.id===id);}
function gameObj(id){return games.find(g=>g.id===id);}
function gameName(id){return gameObj(id)?.name || "Game";}
function setStatus(text,good=false){
  $("#cloudStatus").textContent=text;
  $("#cloudStatus").className="cloud-status"+(good?" good":"");
  $("#accountStatus").textContent=text;
}
function applyTheme(){
  const theme=localStorage.getItem(THEME_KEY)||"dark";
  document.documentElement.classList.toggle("dark",theme==="dark");
  $("#themeBtn").textContent=theme==="dark"?"☀":"☾";
  $$("[data-theme-choice]").forEach(b=>b.classList.toggle("active",b.dataset.themeChoice===theme));
}
function saveTheme(t){localStorage.setItem(THEME_KEY,t);applyTheme();}
function showView(id){
  $$(".view").forEach(v=>v.classList.remove("active"));
  $("#"+id).classList.add("active");
  $$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===id));
  const titles={gamesView:"Games",playersView:"Players",historyView:"History",settingsView:"Settings",gameView:"Game",gameHistoryView:"History",playerHistoryView:"History"};
  $("#pageTitle").textContent=titles[id]||"ScoreMate";
  if(id==="gamesView") renderGames();
  if(id==="playersView") renderPlayers();
  if(id==="historyView") renderHistory();
}
function openModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden");}
function closeModal(){$("#modal").classList.add("hidden");$("#modalContent").innerHTML="";}
$("#closeModal").onclick=closeModal;
$("#modal").onclick=e=>{if(e.target.id==="modal")closeModal();};

async function loadAll(){
  if(!db){setStatus("Cloud not connected. Check config.js.");return;}
  setStatus("Syncing...");
  const [pRes,gRes,hRes]=await Promise.all([
    db.from("players").select("*").order("created_at",{ascending:true}),
    db.from("games").select("*").order("updated_at",{ascending:false}),
    db.from("score_changes").select("*").order("created_at",{ascending:true})
  ]);
  if(pRes.error||gRes.error||hRes.error){
    console.error(pRes.error||gRes.error||hRes.error);
    setStatus("Database error. Run the updated schema.sql.");
    return;
  }
  players=pRes.data||[];
  history=hRes.data||[];
  const gpRes=await db.from("game_players").select("id,game_id,player_id,score,player_order,players(id,name,avatar_url)");
  if(gpRes.error){console.error(gpRes.error);setStatus("Could not load game players.");return;}
  games=(gRes.data||[]).map(g=>({
    ...g,
    players:(gpRes.data||[])
      .filter(x=>x.game_id===g.id)
      .map(x=>({id:x.id,playerId:x.player_id,score:x.score,player_order:x.player_order,name:x.players?.name||"Player",avatar_url:x.players?.avatar_url||null}))
  }));
  games.forEach(g=>g.players=sortPlayers(g,g.players));
  setStatus("Cloud synced ✓",true);
  renderGames();
  if(currentGameId && gameObj(currentGameId)) renderGame();
  if(currentHistoryGameId && gameObj(currentHistoryGameId)) renderGameHistory();
}
function sortPlayers(g,list){
  const arr=[...list];
  if(g.sort_mode==="highest") return arr.sort((a,b)=>b.score-a.score || a.player_order-b.player_order);
  if(g.sort_mode==="lowest") return arr.sort((a,b)=>a.score-b.score || a.player_order-b.player_order);
  return arr.sort((a,b)=>a.player_order-b.player_order);
}
function renderGames(){
  const q=$("#gameSearch").value.toLowerCase().trim();
  const list=games.filter(g=>{
    const status=currentFilter==="active"?"active":"completed";
    return g.status===status && g.name.toLowerCase().includes(q);
  });
  $("#gamesList").innerHTML=list.length?list.map(g=>{
    const leader=[...g.players].sort((a,b)=>b.score-a.score)[0];
    return `<button class="game-item" data-open-game="${g.id}">
      <div class="game-icon">🎮</div>
      <div class="item-main"><h3>${esc(g.name)}</h3><p>${g.players.length} players · ${g.round} round${g.round===1?"":"s"}</p></div>
      <div class="score-preview"><strong>${leader?esc(leader.name):"No players"}</strong><span>${leader?leader.score+" pts":""}</span></div>
    </button>`;
  }).join(""):`<div class="empty">No ${currentFilter==="active"?"games in progress":"completed games"}.</div>`;
  $$("[data-open-game]").forEach(b=>b.onclick=()=>openGame(b.dataset.openGame));
}
function renderPlayers(){
  const q=$("#playerSearch").value.toLowerCase().trim();
  const list=players.filter(p=>p.name.toLowerCase().includes(q));
  $("#playersList").innerHTML=list.length?list.map((p,i)=>`
    <button class="player-item" data-edit-player="${p.id}">
      ${avatarHTML(p,i)}
      <span class="item-main"><strong>${esc(p.name)}</strong><p>Tap to edit or delete</p></span>
      <span>›</span>
    </button>`).join(""):`<div class="empty">No players found.</div>`;
  $$("[data-edit-player]").forEach(b=>b.onclick=()=>editPlayer(b.dataset.editPlayer));
}
function renderHistory(){
  const completedAndActive=games.filter(g=>history.some(h=>h.game_id===g.id));
  $("#historyList").innerHTML=completedAndActive.length?completedAndActive.map(g=>{
    const count=history.filter(h=>h.game_id===g.id).length;
    return `<button class="history-game" data-history-game="${g.id}">
      <div class="game-icon">🎮</div>
      <div class="item-main"><h3>${esc(g.name)}</h3><p>${count} score changes · ${g.status==="completed"?"Completed":"In progress"}</p></div>
      <span class="chevron">›</span>
    </button>`;
  }).join(""):`<div class="empty">No score history yet.</div>`;
  $$("[data-history-game]").forEach(b=>b.onclick=()=>openGameHistory(b.dataset.historyGame));
}
function renderGameHistory(){
  const g=gameObj(currentHistoryGameId);if(!g)return;
  $("#historyGameName").textContent=g.name;
  $("#historyGameMeta").textContent=`${history.filter(h=>h.game_id===g.id).length} score changes`;
  const rows=history.filter(h=>h.game_id===g.id).slice().reverse();
  $("#gameHistoryList").innerHTML=rows.length?rows.map(h=>{
    const p=playerObj(h.player_id)||{name:"Player"};
    return `<button class="history-item" data-player-history="${h.player_id}">
      <div class="round-label">Round ${h.round}</div>
      <div class="history-row">${avatarHTML(p,0)}<span class="grow"><strong>${esc(p.name)}</strong><div class="history-meta">${new Date(h.created_at).toLocaleString()}</div></span><span class="history-delta ${h.delta>=0?"plus":"minus"}">${h.delta>=0?"+":""}${h.delta}</span></div>
    </button>`;
  }).join(""):`<div class="empty">No score history for this game.</div>`;
  $$("[data-player-history]").forEach(b=>b.onclick=()=>openPlayerHistory(currentHistoryGameId,b.dataset.playerHistory));
}
function renderPlayerHistory(){
  const g=gameObj(currentHistoryGameId),p=playerObj(currentPlayerHistoryId);if(!g||!p)return;
  $("#playerHistoryName").textContent=p.name;
  $("#playerHistoryGame").textContent=g.name;
  const rows=history.filter(h=>h.game_id===g.id&&h.player_id===p.id).slice().reverse();
  let running=0;
  const chronological=rows.slice().reverse();
  const totals=new Map();
  chronological.forEach(h=>{running+=h.delta;totals.set(h.id,running)});
  $("#playerHistoryList").innerHTML=rows.length?rows.map(h=>{
    const total=totals.get(h.id);
    return `<div class="history-item"><div class="round-label">Round ${h.round}</div><div class="history-row"><span class="grow"><strong>${h.delta>=0?"+":""}${h.delta} points</strong><div class="history-meta">${new Date(h.created_at).toLocaleString()} · Total after change: ${total}</div></span><span class="history-delta ${h.delta>=0?"plus":"minus"}">${total}</span></div></div>`;
  }).join(""):`<div class="empty">No score changes for this player.</div>`;
}
function openGame(id){currentGameId=id;showView("gameView");renderGame();}
function renderGame(){
  const g=gameObj(currentGameId);if(!g)return;
  $("#gameName").textContent=g.name;$("#roundLabel").textContent=`Round ${g.round}`;
  const ps=sortPlayers(g,g.players);
  $("#scoreCards").innerHTML=ps.map((p,i)=>`
    <div class="score-card" style="--player-color:${colors[i%colors.length]}">
      ${avatarHTML(p,i)}
      <div class="grow"><div class="name">${esc(p.name)}</div><div class="score ${p.score<0?"negative":""}">${p.score}</div></div>
      <div class="score-buttons"><button class="add" data-plus="${p.playerId}">+</button><button data-minus="${p.playerId}">−</button></div>
    </div>`).join("") || `<div class="empty">No players in this game.</div>`;
  $$("#scoreCards [data-plus]").forEach(b=>b.onclick=()=>openScoreModal(b.dataset.plus));
  $$("#scoreCards [data-minus]").forEach(b=>b.onclick=()=>openScoreModal(b.dataset.minus));
  const vals=[5,10,25,50,100,-5,-10,-25,-50,-100];
  $("#quickGrid").innerHTML=vals.map(n=>`<button data-quick="${n}">${n>0?"+":"−"}${Math.abs(n)}</button>`).join("");
  $$("#quickGrid [data-quick]").forEach(b=>b.onclick=()=>choosePlayerForQuick(Number(b.dataset.quick)));
}
function openScoreModal(pid){
  const p=gameObj(currentGameId).players.find(x=>x.playerId===pid);
  openModal(`<h2>Score ${esc(p?.name||"Player")}</h2>
    <div class="field"><label>Amount</label><input id="scoreAmount" type="number" inputmode="decimal" placeholder="Enter any amount" value="10"></div>
    <div class="theme-choice"><button id="addMode" class="active">Add points</button><button id="subtractMode">Subtract points</button></div>
    <button class="primary wide" id="saveScore">Save score</button>`);
  let sign=1;
  $("#addMode").onclick=()=>{sign=1;$("#addMode").classList.add("active");$("#subtractMode").classList.remove("active")};
  $("#subtractMode").onclick=()=>{sign=-1;$("#subtractMode").classList.add("active");$("#addMode").classList.remove("active")};
  $("#saveScore").onclick=()=>{const n=Number($("#scoreAmount").value);if(!Number.isFinite(n)||n===0)return alert("Enter an amount.");closeModal();addScore(pid,sign*Math.abs(n));};
  setTimeout(()=>$("#scoreAmount").focus(),50);
}
function choosePlayerForQuick(delta){
  const g=gameObj(currentGameId);
  if(g.players.length===1){addScore(g.players[0].playerId,delta);return;}
  openModal(`<h2>${delta>=0?"Add":"Subtract"} ${Math.abs(delta)} points</h2><div class="check-list">
    ${g.players.map((p,i)=>`<button class="player-item" data-pick-player="${p.playerId}">${avatarHTML(p,i)}<span class="item-main"><strong>${esc(p.name)}</strong><p>${p.score} points</p></span></button>`).join("")}</div>
    <button class="secondary wide" id="customInstead">Enter a different amount</button>`);
  $$("[data-pick-player]").forEach(b=>b.onclick=()=>{closeModal();addScore(b.dataset.pickPlayer,delta)});
  $("#customInstead").onclick=()=>{closeModal();openScoreModal(g.players[0].playerId);};
}
async function addScore(pid,delta){
  const g=gameObj(currentGameId);if(!g||!pid)return;
  const p=g.players.find(x=>x.playerId===pid);if(!p)return;
  const newScore=p.score+delta;
  const up=await db.from("game_players").update({score:newScore}).eq("id",p.id);
  if(up.error){alert(up.error.message);return;}
  const ins=await db.from("score_changes").insert({game_id:g.id,player_id:pid,round:g.round,delta});
  if(ins.error){alert(ins.error.message);return;}
  await db.from("games").update({updated_at:new Date().toISOString()}).eq("id",g.id);
  await loadAll();
}
async function undo(){
  const g=gameObj(currentGameId);if(!g)return;
  const {data,error}=await db.from("score_changes").select("*").eq("game_id",g.id).order("created_at",{ascending:false}).limit(1).maybeSingle();
  if(error||!data){alert("Nothing to undo.");return;}
  const p=g.players.find(x=>x.playerId===data.player_id);if(!p)return;
  const up=await db.from("game_players").update({score:p.score-data.delta}).eq("id",p.id);
  if(up.error){alert(up.error.message);return;}
  const del=await db.from("score_changes").delete().eq("id",data.id);
  if(del.error){alert(del.error.message);return;}
  await loadAll();
}
async function nextRound(){
  const g=gameObj(currentGameId);if(!g)return;
  await db.from("games").update({round:g.round+1,updated_at:new Date().toISOString()}).eq("id",g.id);
  await loadAll();
}
async function finishGame(){
  const g=gameObj(currentGameId);if(!g)return;
  await db.from("games").update({status:"completed",updated_at:new Date().toISOString()}).eq("id",g.id);
  await loadAll();showView("gamesView");
}
async function deleteGame(id){
  const g=gameObj(id);if(!g)return;
  openModal(`<h2>Delete game?</h2><p class="confirm-text">This permanently removes <strong>${esc(g.name)}</strong>, its players in the game, scores, and all score history.</p><div class="confirm-actions"><button class="secondary" id="cancelDelete">Cancel</button><button class="danger-btn" id="confirmDelete">Delete</button></div>`);
  $("#cancelDelete").onclick=closeModal;
  $("#confirmDelete").onclick=async()=>{
    const {error}=await db.from("games").delete().eq("id",id);
    if(error){alert(error.message);return;}
    closeModal();currentGameId=null;currentHistoryGameId=null;await loadAll();showView("gamesView");
  };
}
async function deleteHistory(id){
  openModal(`<h2>Delete all history?</h2><p class="confirm-text">This removes every score change for this game. Current player scores will remain unchanged.</p><div class="confirm-actions"><button class="secondary" id="cancelHistoryDelete">Cancel</button><button class="danger-btn" id="confirmHistoryDelete">Delete</button></div>`);
  $("#cancelHistoryDelete").onclick=closeModal;
  $("#confirmHistoryDelete").onclick=async()=>{
    const {error}=await db.from("score_changes").delete().eq("game_id",id);
    if(error){alert(error.message);return;}
    closeModal();await loadAll();renderGameHistory();
  };
}
function openGameHistory(id){currentHistoryGameId=id;showView("gameHistoryView");renderGameHistory();}
function openPlayerHistory(gameId,playerId){currentHistoryGameId=gameId;currentPlayerHistoryId=playerId;showView("playerHistoryView");renderPlayerHistory();}

async function editPlayer(id){
  const p=playerObj(id);if(!p)return;
  openModal(`<h2>Edit player</h2>
    <div class="profile-editor"><div id="playerPreview">${avatarHTML(p,0,"avatar large-avatar")}</div>
    <label class="upload-btn">📷 ${p.avatar_url?"Change picture":"Add picture"}<input id="avatarInput" type="file" accept="image/*" hidden></label></div>
    <div class="field"><label>Name</label><input id="editPlayerName" value="${esc(p.name)}"></div>
    <button class="primary wide" id="savePlayer">Save</button>
    ${p.avatar_url?'<button class="secondary wide" id="removeAvatar" style="margin-top:8px">Remove picture</button>':""}
    <button class="danger-btn" id="deletePlayer">Delete player</button>`);
  $("#avatarInput").onchange=e=>{const f=e.target.files?.[0];if(f)$("#playerPreview").innerHTML=`<img class="avatar large-avatar avatar-photo" src="${URL.createObjectURL(f)}" alt="">`;};
  if($("#removeAvatar"))$("#removeAvatar").onclick=async()=>{
    await db.from("players").update({avatar_url:null}).eq("id",id);closeModal();await loadAll();renderPlayers();
  };
  $("#savePlayer").onclick=async()=>{
    const name=$("#editPlayerName").value.trim();if(!name)return;
    const file=$("#avatarInput").files?.[0];let avatar_url=p.avatar_url;
    if(file){
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
      const path=`${id}/${crypto.randomUUID()}.${ext}`;
      const up=await db.storage.from("player-avatars").upload(path,file,{upsert:true,contentType:file.type});
      if(up.error){alert(up.error.message);return;}
      avatar_url=db.storage.from("player-avatars").getPublicUrl(path).data.publicUrl;
    }
    const {error}=await db.from("players").update({name,avatar_url}).eq("id",id);
    if(error){alert(error.message);return;}
    closeModal();await loadAll();renderPlayers();
  };
  $("#deletePlayer").onclick=()=>confirmDeletePlayer(id);
}
function confirmDeletePlayer(id){
  const p=playerObj(id);if(!p)return;
  openModal(`<h2>Delete player?</h2><p class="confirm-text">Delete <strong>${esc(p.name)}</strong> everywhere? Their saved games and score history will lose this player.</p><div class="confirm-actions"><button class="secondary" id="cancelP">Cancel</button><button class="danger-btn" id="confirmP">Delete</button></div>`);
  $("#cancelP").onclick=closeModal;
  $("#confirmP").onclick=async()=>{
    const {error}=await db.from("players").delete().eq("id",id);
    if(error){alert(error.message);return;}
    closeModal();await loadAll();renderPlayers();
  };
}
async function addPlayer(){
  const name=$("#newPlayerName").value.trim();if(!name)return;
  if(players.some(p=>p.name.toLowerCase()===name.toLowerCase())){alert("That player already exists.");return;}
  const {data,error}=await db.from("players").insert({name}).select().single();
  if(error){alert(error.message);return;}
  const file=$("#newAvatarInput")?.files?.[0];
  if(file){
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
    const path=`${data.id}/${crypto.randomUUID()}.${ext}`;
    const up=await db.storage.from("player-avatars").upload(path,file,{upsert:true,contentType:file.type});
    if(!up.error){
      const avatar_url=db.storage.from("player-avatars").getPublicUrl(path).data.publicUrl;
      await db.from("players").update({avatar_url}).eq("id",data.id);
    }
  }
  closeModal();await loadAll();renderPlayers();
}
function newPlayer(){
  openModal(`<h2>Add player</h2><div class="profile-editor"><div id="newPlayerPreview">${avatarHTML({name:"?"},0,"avatar large-avatar")}</div><label class="upload-btn">📷 Add picture<input id="newAvatarInput" type="file" accept="image/*" hidden></label></div><div class="field"><label>Name</label><input id="newPlayerName" placeholder="Player name"></div><button class="primary wide" id="createPlayer">Add Player</button>`);
  $("#newAvatarInput").onchange=e=>{const f=e.target.files?.[0];if(f)$("#newPlayerPreview").innerHTML=`<img class="avatar large-avatar avatar-photo" src="${URL.createObjectURL(f)}" alt="">`;};
  $("#createPlayer").onclick=addPlayer;
}
async function newGame(){
  if(!players.length){alert("Add at least one player first.");return;}
  const checks=players.map((p,i)=>`<label class="check-row"><input type="checkbox" value="${p.id}" ${i<4?"checked":""}>${avatarHTML(p,i,"avatar") }<span>${esc(p.name)}</span></label>`).join("");
  openModal(`<h2>New Game</h2>
    <div class="field"><label>Game name</label><input id="newGameName" placeholder="e.g. Rummy Night"></div>
    <div class="field"><label>Players</label><div class="check-list" id="playerChecks">${checks}</div></div>
    <div class="field"><label>Target score (optional)</label><input id="winningScore" type="number" inputmode="numeric" value="500"></div>
    <div class="field"><label>Winner rule</label><div class="mode-buttons"><button id="higher" class="active">Higher wins</button><button id="lower">Lower wins</button><button id="none">No target</button></div></div>
    <button class="primary wide" id="startGame">Start Game</button>`);
  let rule="higher", target=500;
  $("#higher").onclick=()=>{rule="higher";$("#higher").classList.add("active");$("#lower").classList.remove("active");$("#none").classList.remove("active");};
  $("#lower").onclick=()=>{rule="lower";$("#lower").classList.add("active");$("#higher").classList.remove("active");$("#none").classList.remove("active");};
  $("#none").onclick=()=>{rule="higher";target=0;$("#none").classList.add("active");$("#higher").classList.remove("active");$("#lower").classList.remove("active");};
  $("#startGame").onclick=async()=>{
    const name=$("#newGameName").value.trim()||"Card Game";
    const ids=$$("#playerChecks input:checked").map(x=>x.value);
    if(!ids.length){alert("Select at least one player.");return;}
    const targetInput=Number($("#winningScore").value);
    target=$("#none").classList.contains("active")?0:(Number.isFinite(targetInput)&&targetInput>0?targetInput:500);
    const {data,error}=await db.from("games").insert({name,winning_score:target,winner_rule:rule,sort_mode:"custom"}).select().single();
    if(error){alert(error.message);return;}
    const rows=ids.map((player_id,i)=>({game_id:data.id,player_id,score:0,player_order:i}));
    const ins=await db.from("game_players").insert(rows);
    if(ins.error){alert(ins.error.message);return;}
    closeModal();await loadAll();openGame(data.id);
  };
}
async function openOrder(){
  const g=gameObj(currentGameId);if(!g)return;
  const ps=sortPlayers(g,g.players);
  openModal(`<h2>Player order</h2>
    <div class="field"><label>Automatic order</label><div class="mode-buttons">
      <button data-mode="custom" class="${g.sort_mode==="custom"?"active":""}">Custom</button>
      <button data-mode="highest" class="${g.sort_mode==="highest"?"active":""}">Highest first</button>
      <button data-mode="lowest" class="${g.sort_mode==="lowest"?"active":""}">Lowest first</button>
    </div></div>
    <div id="customOrderArea"></div>`);
  async function setMode(mode){
    await db.from("games").update({sort_mode:mode,updated_at:new Date().toISOString()}).eq("id",g.id);
    await loadAll();openOrder();
  }
  $$("[data-mode]").forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
  function renderCustom(){
    if(g.sort_mode!=="custom"){$("#customOrderArea").innerHTML=`<p class="confirm-text">Switch to Custom to manually arrange players.</p>`;return;}
    $("#customOrderArea").innerHTML=`<div class="order-list">${ps.map((p,i)=>`<div class="order-row"><span class="item-main">${i+1}. ${esc(p.name)}</span><div class="move-buttons"><button data-up="${p.playerId}" ${i===0?"disabled":""}>↑</button><button data-down="${p.playerId}" ${i===ps.length-1?"disabled":""}>↓</button></div></div>`).join("")}</div>`;
    $$("[data-up]").forEach(b=>b.onclick=()=>movePlayer(b.dataset.up,-1));
    $$("[data-down]").forEach(b=>b.onclick=()=>movePlayer(b.dataset.down,1));
  }
  async function movePlayer(pid,dir){
    const ordered=[...g.players].sort((a,b)=>a.player_order-b.player_order);
    const idx=ordered.findIndex(p=>p.playerId===pid);const next=idx+dir;
    if(idx<0||next<0||next>=ordered.length)return;
    [ordered[idx],ordered[next]]=[ordered[next],ordered[idx]];
    for(let i=0;i<ordered.length;i++)await db.from("game_players").update({player_order:i}).eq("id",ordered[i].id);
    await loadAll();openOrder();
  }
  renderCustom();
}
function gameMenu(){
  const g=gameObj(currentGameId);if(!g)return;
  openModal(`<h2>${esc(g.name)}</h2>
    <button class="secondary wide" id="renameGame">Rename game</button>
    <button class="secondary wide" id="finishFromMenu" style="margin-top:7px">${g.status==="completed"?"Mark in progress":"Finish game"}</button>
    <button class="danger-btn" id="deleteGameFromMenu">Delete game</button>`);
  $("#renameGame").onclick=()=>renameGame(g.id);
  $("#finishFromMenu").onclick=async()=>{closeModal();if(g.status==="completed"){await db.from("games").update({status:"active"}).eq("id",g.id);await loadAll();}else finishGame();};
  $("#deleteGameFromMenu").onclick=()=>deleteGame(g.id);
}
function renameGame(id){
  const g=gameObj(id);closeModal();
  openModal(`<h2>Rename game</h2><div class="field"><label>Game name</label><input id="renameInput" value="${esc(g.name)}"></div><button class="primary wide" id="saveRename">Save</button>`);
  $("#saveRename").onclick=async()=>{const name=$("#renameInput").value.trim();if(!name)return;const {error}=await db.from("games").update({name,updated_at:new Date().toISOString()}).eq("id",id);if(error)alert(error.message);else{closeModal();await loadAll();}};
}

$("#newGameBtn").onclick=newGame;
$("#addPlayerBtn").onclick=newPlayer;
$("#gameSearch").oninput=renderGames;
$("#playerSearch").oninput=renderPlayers;
$("#themeBtn").onclick=()=>saveTheme((localStorage.getItem(THEME_KEY)||"dark")==="dark"?"light":"dark");
$("#menuBtn").onclick=()=>showView("settingsView");
$("#backBtn").onclick=()=>showView("gamesView");
$("#historyBackBtn").onclick=()=>showView("historyView");
$("#playerHistoryBackBtn").onclick=()=>{showView("gameHistoryView");renderGameHistory();};
$("#undoBtn").onclick=undo;
$("#nextRoundBtn").onclick=nextRound;
$("#finishGameBtn").onclick=finishGame;
$("#historyBtn").onclick=()=>{currentHistoryGameId=currentGameId;showView("gameHistoryView");renderGameHistory();};
$("#orderBtn").onclick=openOrder;
$("#gameMenuBtn").onclick=gameMenu;
$("#syncBtn").onclick=loadAll;
$("#deleteGameHistoryBtn").onclick=()=>deleteHistory(currentHistoryGameId);
$$(".nav").forEach(n=>n.onclick=()=>showView(n.dataset.view));
$$(".segmented button").forEach(b=>b.onclick=()=>{$$(".segmented button").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentFilter=b.dataset.filter;renderGames();});
$$("[data-theme-choice]").forEach(b=>b.onclick=()=>saveTheme(b.dataset.themeChoice));

applyTheme();
loadAll();
