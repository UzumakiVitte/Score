const { createClient } = window.supabase;
const hasConfig = window.SUPABASE_URL && !window.SUPABASE_URL.startsWith("YOUR_") &&
                  window.SUPABASE_ANON_KEY && !window.SUPABASE_ANON_KEY.startsWith("YOUR_");
const db = hasConfig ? createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const LOCAL = "scoremate-theme";
let currentGameId = null, currentFilter = "active", games = [], players = [], history = [];

function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function initials(n){return n.trim().slice(0,1).toUpperCase()||"?"}
function avatarHTML(player, i=0, cls="avatar"){
  return player?.avatar_url
    ? `<img class="${cls} avatar-photo" src="${esc(player.avatar_url)}" alt="">`
    : `<span class="${cls}" style="--avatar:${colors[i%colors.length]}">${initials(player?.name||"")}</span>`;
}
const colors=["#7b45ed","#2777e8","#27a85b","#e5a900","#dc6546","#0f9db5","#d14bd8","#7d8798"];

function setStatus(text, good=false){
  $("#cloudStatus").textContent=text;
  $("#cloudStatus").className="cloud-status "+(good?"good":"");
  $("#accountStatus").textContent=text;
}
function applyTheme(){
  const theme=localStorage.getItem(LOCAL)||"dark";
  document.documentElement.classList.toggle("light",theme==="light");
  $("#themeBtn").textContent=theme==="light"?"☾":"☀";
  $$("[data-theme-choice]").forEach(b=>b.classList.toggle("active",b.dataset.themeChoice===theme));
}
function saveTheme(t){localStorage.setItem(LOCAL,t);applyTheme()}
function showView(id){
  $$(".view").forEach(v=>v.classList.remove("active")); $("#"+id).classList.add("active");
  $$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===id));
  $("#pageTitle").textContent={gamesView:"My Games",playersView:"Players",historyView:"History",settingsView:"Settings",gameView:"Game"}[id];
  if(id==="gamesView")renderGames(); if(id==="playersView")renderPlayers(); if(id==="historyView")renderHistory();
}
function openModal(html){$("#modalContent").innerHTML=html;$("#modal").classList.remove("hidden")}
function closeModal(){$("#modal").classList.add("hidden")}
$("#closeModal").onclick=closeModal;
$("#modal").onclick=e=>{if(e.target.id==="modal")closeModal()};

async function loadAll(){
  if(!db){setStatus("Cloud not connected. Add your Supabase keys to config.js."); return}
  setStatus("Syncing...");
  const [p,g,h]=await Promise.all([
    db.from("players").select("*").order("created_at",{ascending:true}),
    db.from("games").select("*").order("updated_at",{ascending:false}),
    db.from("score_changes").select("*").order("created_at",{ascending:true})
  ]);
  if(p.error||g.error||h.error){console.error(p.error||g.error||h.error);setStatus("Database error. Check your Supabase SQL setup.");return}
  players=p.data||[]; history=h.data||[];
  const gp=await db.from("game_players").select("id,game_id,player_id,score,players(name)");
  if(gp.error){setStatus("Could not load game players.");return}
  games=(g.data||[]).map(game=>({
    ...game,
    players:(gp.data||[]).filter(x=>x.game_id===game.id).map(x=>({id:x.id,playerId:x.player_id,name:x.players?.name||"Player",avatar_url:x.players?.avatar_url||null,score:x.score}))
  }));
  setStatus("Cloud synced ✓",true); renderGames(); if(currentGameId)renderGame();
}
async function editPlayer(id){
  const p=players.find(x=>x.id===id); if(!p)return;
  openModal(`<h2>Edit player</h2>
    <div class="profile-editor">
      <div id="playerPreview">${avatarHTML(p,0,"avatar large-avatar")}</div>
      <label class="upload-btn">📷 ${p.avatar_url?"Change picture":"Add picture"}<input id="avatarInput" type="file" accept="image/*" hidden></label>
      ${p.avatar_url?'<button class="secondary wide" id="removeAvatar">Remove picture</button>':""}
    </div>
    <div class="field"><label>Name</label><input id="editPlayerName" value="${esc(p.name)}"></div>
    <button class="primary wide" id="savePlayer">Save</button>`);
  $("#avatarInput").onchange=e=>{
    const f=e.target.files?.[0]; if(!f)return;
    const url=URL.createObjectURL(f);
    $("#playerPreview").innerHTML=`<img class="avatar large-avatar avatar-photo" src="${url}" alt="">`;
  };
  if($("#removeAvatar")) $("#removeAvatar").onclick=async()=>{
    if(p.avatar_url){
      const path=p.avatar_url.split("/player-avatars/")[1];
      if(path) await db.storage.from("player-avatars").remove([path]);
      await db.from("players").update({avatar_url:null}).eq("id",id);
    }
    await loadAll(); closeModal(); renderPlayers();
  };
  $("#savePlayer").onclick=async()=>{
    const name=$("#editPlayerName").value.trim(); if(!name)return;
    const file=$("#avatarInput").files?.[0];
    let avatar_url=p.avatar_url;
    if(file){
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase();
      const path=`${id}/${crypto.randomUUID()}.${ext}`;
      const up=await db.storage.from("player-avatars").upload(path,file,{upsert:true,contentType:file.type});
      if(up.error){alert(up.error.message);return}
      avatar_url=db.storage.from("player-avatars").getPublicUrl(path).data.publicUrl;
    }
    const {error}=await db.from("players").update({name,avatar_url}).eq("id",id);
    if(error){alert(error.message);return}
    closeModal();await loadAll();renderPlayers();
  };
}

async function addPlayer(){
  const n=$("#newPlayerName").value.trim(); if(!n)return;
  if(players.some(p=>p.name.toLowerCase()===n.toLowerCase())){alert("That player already exists.");return}
  const {data,error}=await db.from("players").insert({name:n}).select().single();
  if(error){alert(error.message);return}
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
function newPlayer(){openModal(`<h2>Add player</h2><div class="profile-editor"><div id="newPlayerPreview">${avatarHTML({name:"?"},0,"avatar large-avatar")}</div><label class="upload-btn">📷 Add picture<input id="newAvatarInput" type="file" accept="image/*" hidden></label></div><div class="field"><label>Name</label><input id="newPlayerName" placeholder="Player name"></div><button class="primary wide" id="createPlayer">Add Player</button>`);
  $("#newAvatarInput").onchange=e=>{const f=e.target.files?.[0];if(f)$("#newPlayerPreview").innerHTML=`<img class="avatar large-avatar avatar-photo" src="${URL.createObjectURL(f)}" alt="">`};$("#createPlayer").onclick=addPlayer}

function renderGames(){
  const q=$("#gameSearch").value.toLowerCase();
  const list=games.filter(g=>(currentFilter==="active"?g.status!=="completed":g.status==="completed")&&g.name.toLowerCase().includes(q));
  $("#gamesList").innerHTML=list.length?list.map(g=>{
    const top=[...g.players].sort((a,b)=>b.score-a.score)[0];
    return `<button class="game-item" data-open="${g.id}"><div class="game-icon">${g.status==="completed"?"🏆":"🃏"}</div><div class="item-main"><h3>${esc(g.name)}</h3><p>${g.players.length} players · ${g.round} round${g.round===1?"":"s"}</p></div><div class="score-preview"><strong>${top?esc(top.name):""} ${top?top.score:0}</strong><span>${g.status==="completed"?"Completed":"In progress"}</span></div></button>`
  }).join(""):`<div class="empty">No ${currentFilter==="active"?"active":"completed"} games yet.</div>`;
  $$("[data-open]").forEach(b=>b.onclick=()=>openGame(b.dataset.open));
}
function renderPlayers(){
  const q=$("#playerSearch").value.toLowerCase();
  const list=players.filter(p=>p.name.toLowerCase().includes(q));
  $("#playersList").innerHTML=list.length?list.map((p,i)=>`<button class="player-item" data-edit-player="${p.id}">${avatarHTML(p,i)}<span class="item-main"><strong>${esc(p.name)}</strong><p>Saved player</p></span><span>✎</span></button>`).join(""):`<div class="empty">No players found.</div>`;
  $$("[data-edit-player]").forEach(b=>b.onclick=()=>editPlayer(b.dataset.editPlayer));
}
function renderHistory(){
  const list=history.slice().reverse();
  $("#historyList").innerHTML=list.length?list.map(h=>`<div class="history-item"><div class="round-row"><span><strong>${esc(playerName(h.player_id))}</strong></span><span>${h.delta>=0?"+":""}${h.delta}</span></div><div class="round-row"><span>${esc(gameName(h.game_id))}</span><span>${new Date(h.created_at).toLocaleString()}</span></div></div>`).join(""):`<div class="empty">Score changes will appear here.</div>`;
}
function playerName(id){return players.find(p=>p.id===id)?.name||"Player"}
function gameName(id){return games.find(g=>g.id===id)?.name||"Game"}

async function newGame(){
  const checks=players.map((p,i)=>`<label class="check-row"><input type="checkbox" value="${p.id}" ${i<4?"checked":""}><span class="avatar" style="width:28px;height:28px;--avatar:${colors[i%colors.length]}">${initials(p.name)}</span>${esc(p.name)}</label>`).join("");
  openModal(`<h2>New Game</h2><div class="field"><label>Game name</label><input id="newGameName" placeholder="e.g. Rummy Night"></div><div class="field"><label>Select players</label><div class="check-list" id="playerChecks">${checks}</div></div><div class="field"><label>Winning score</label><input id="winningScore" type="number" value="500"></div><div class="field"><label>Winner rule</label><div class="theme-choice"><button id="higher" class="active">Higher wins</button><button id="lower">Lower wins</button></div></div><button class="primary wide" id="startGame">Start Game</button>`);
  let rule="higher";
  $("#higher").onclick=()=>{rule="higher";$("#higher").classList.add("active");$("#lower").classList.remove("active")};
  $("#lower").onclick=()=>{rule="lower";$("#lower").classList.add("active");$("#higher").classList.remove("active")};
  $("#startGame").onclick=async()=>{
    const name=$("#newGameName").value.trim()||"Card Game", ids=$$("#playerChecks input:checked").map(x=>x.value);
    if(!ids.length)return alert("Select at least one player.");
    const {data,error}=await db.from("games").insert({name,winning_score:Number($("#winningScore").value)||500,winner_rule:rule}).select().single();
    if(error){alert(error.message);return}
    const rows=ids.map(player_id=>({game_id:data.id,player_id,score:0}));
    const ins=await db.from("game_players").insert(rows);
    if(ins.error){alert(ins.error.message);return}
    closeModal();await loadAll();openGame(data.id);
  };
}
function openGame(id){currentGameId=id;showView("gameView");renderGame()}
function renderGame(){
  const g=games.find(x=>x.id===currentGameId);if(!g)return;
  $("#gameName").textContent=g.name;$("#roundLabel").textContent=`Round ${g.round}`;
  $("#scoreCards").innerHTML=g.players.map((p,i)=>`<div class="score-card" style="--player-color:${colors[i%colors.length]}">${avatarHTML(p,i)}<div class="grow"><div class="name">${esc(p.name)}</div><div class="score ${p.score<0?"negative":""}">${p.score}</div></div><div class="score-buttons"><button class="add" data-plus="${p.playerId}">+</button><button data-minus="${p.playerId}">−</button></div></div>`).join("");
  $$("#scoreCards [data-plus]").forEach(b=>b.onclick=()=>choosePlayer(b.dataset.plus,10));
  $$("#scoreCards [data-minus]").forEach(b=>b.onclick=()=>choosePlayer(b.dataset.minus,-10));
  $("#quickGrid").innerHTML=[5,10,25,50,100].map(n=>`<button data-q="${n}">+${n}</button>`).join("")+[5,10,25,50,100].map(n=>`<button data-q="-${n}">−${n}</button>`).join("");
  $$("#quickGrid [data-q]").forEach(b=>b.onclick=()=>choosePlayer(null,Number(b.dataset.q)));
}
function choosePlayer(pid,delta){
  const g=games.find(x=>x.id===currentGameId);
  if(pid)return addScore(pid,delta);
  openModal(`<h2>${delta>=0?"Add":"Subtract"} ${Math.abs(delta)} points</h2><div class="check-list">${g.players.map(p=>`<button class="player-item" data-pick="${p.playerId}">${avatarHTML(p)}<span class="item-main">${esc(p.name)}</span><span>${p.score}</span></button>`).join("")}</div>`);
  $$("[data-pick]").forEach(b=>b.onclick=()=>{addScore(b.dataset.pick,delta);closeModal()});
}
async function addScore(pid,delta){
  const g=games.find(x=>x.id===currentGameId), p=g.players.find(x=>x.playerId===pid);if(!p)return;
  const newScore=p.score+delta;
  const up=await db.from("game_players").update({score:newScore}).eq("id",p.id);
  if(up.error){alert(up.error.message);return}
  const ins=await db.from("score_changes").insert({game_id:g.id,player_id:pid,round:g.round,delta});
  if(ins.error){alert(ins.error.message);return}
  p.score=newScore; await db.from("games").update({updated_at:new Date().toISOString()}).eq("id",g.id);
  await loadAll();
}
async function undo(){
  const g=games.find(x=>x.id===currentGameId);
  const {data,error}=await db.from("score_changes").select("*").eq("game_id",g.id).order("created_at",{ascending:false}).limit(1).single();
  if(error||!data)return;
  const p=g.players.find(x=>x.playerId===data.player_id); if(!p)return;
  await db.from("game_players").update({score:p.score-data.delta}).eq("id",p.id);
  await db.from("score_changes").delete().eq("id",data.id);
  await loadAll();
}
async function nextRound(){
  const g=games.find(x=>x.id===currentGameId);const finished=g.rule==="higher"?g.players.some(p=>p.score>=g.winning_score):g.players.some(p=>p.score<=-Math.abs(g.winning_score));
  if(finished){await db.from("games").update({status:"completed",updated_at:new Date().toISOString()}).eq("id",g.id);await loadAll();showView("gamesView");return}
  await db.from("games").update({round:g.round+1,updated_at:new Date().toISOString()}).eq("id",g.id);await loadAll();
}
$("#newGameBtn").onclick=newGame;$("#addPlayerBtn").onclick=newPlayer;$("#gameSearch").oninput=renderGames;$("#playerSearch").oninput=renderPlayers;
$$(".segmented button").forEach(b=>b.onclick=()=>{$$(".segmented button").forEach(x=>x.classList.remove("active"));b.classList.add("active");currentFilter=b.dataset.filter;renderGames()});
$$(".nav").forEach(n=>n.onclick=()=>showView(n.dataset.view));
$("#themeBtn").onclick=()=>saveTheme((localStorage.getItem(LOCAL)||"dark")==="dark"?"light":"dark");
$$("[data-theme-choice]").forEach(b=>b.onclick=()=>saveTheme(b.dataset.themeChoice));
$("#menuBtn").onclick=()=>showView("settingsView");$("#backBtn").onclick=()=>showView("gamesView");$("#undoBtn").onclick=undo;$("#nextRoundBtn").onclick=nextRound;$("#historyBtn").onclick=()=>showView("historyView");$("#syncBtn").onclick=loadAll;
$("#renameGameBtn").onclick=()=>{const g=games.find(x=>x.id===currentGameId);openModal(`<h2>Rename game</h2><div class="field"><label>Game name</label><input id="rename" value="${esc(g.name)}"></div><button class="primary wide" id="saveRename">Save</button>`);$("#saveRename").onclick=async()=>{const n=$("#rename").value.trim();if(!n)return;const {error}=await db.from("games").update({name:n,updated_at:new Date().toISOString()}).eq("id",g.id);if(error)alert(error.message);else{closeModal();await loadAll()}}};

applyTheme();
loadAll();
