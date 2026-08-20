(function(){
  const s=document.createElement("script");
  s.src="loader-v15.js?16";
  s.onload=function(){
    const waitForApp=()=>{
      if(!window.__scorekeeperVersion || typeof state==="undefined" || typeof renderGame!=="function" || typeof loadAll!=="function" || typeof sb==="undefined"){
        setTimeout(waitForApp,50);
        return;
      }

      const baseRenderGame=renderGame;
      const baseFinishGame=finishGame;
      const baseHistoryGame=historyGame;
      const baseApplyDelta=applyDelta;
      const baseNextRound=nextRound;

      function isCustomGame(){
        return state.game && String(state.game.name).trim().toLowerCase()==="custom";
      }

      function customEntries(round){
        return state.history.filter(x=>Number(x.round)===Number(round) && x.custom_entry===true);
      }

      function customCompleted(round){
        return new Set(customEntries(round).map(x=>x.player_id));
      }

      function customRoundScore(pid,round){
        return customEntries(round)
          .filter(x=>x.player_id===pid)
          .reduce((sum,x)=>sum+Number(x.delta||0),0);
      }

      function customEntry(pid,round){
        return customEntries(round).find(x=>x.player_id===pid);
      }

      function renderCustomGame(){
        const ps=orderedPlayers();
        const finished=state.game.status==="completed";
        const round=Number(state.game.round);
        const completed=customCompleted(round);
        const winner=finished ? currentWinner() : null;

        setTitle(state.game.name);

        $("#content").innerHTML=`
          <div class="game-header">
            <button class="btn small" onclick="goGames()">‹ Games</button>
            <div class="game-title-center">
              <h2>${esc(state.game.name)}</h2>
              <div class="game-meta">Round ${round} · ${ps.length} player${ps.length===1?"":"s"}</div>
            </div>
            <button class="btn small" onclick="gameMenu()">•••</button>
          </div>

          <div class="custom-round-card card">
            <div class="custom-round-title">Enter each player's custom score</div>
            <div class="custom-round-sub">Use any positive or negative amount. The round advances after every player has been recorded.</div>
            <div class="custom-progress">${completed.size} of ${ps.length} players recorded</div>
          </div>

          <div class="player-list custom-player-list">
            ${ps.map(gp=>{
              const entry=customEntry(gp.player_id,round);
              const done=!!entry;
              const prev=round>1?customRoundScore(gp.player_id,round-1):null;
              const delta=entry?Number(entry.delta):0;
              return `<button class="simple-player custom-player ${done?"done":""}" ${done||finished?"disabled":""} onclick="customEnterAmount('${gp.player_id}')">
                ${avatar(gp.players)}
                <div class="simple-player-main">
                  <div class="player-name">${esc(gp.players.name)}</div>
                  <div class="player-sub">${round>1?`Round ${round-1}: ${prev} · `:""}This round: ${done?(delta>=0?"+":"")+delta:"0"}</div>
                </div>
                <div class="score-big">${gp.score}</div>
                ${done?`<div class="custom-recorded">✓</div>`:`<span class="chevron">›</span>`}
              </button>`;
            }).join("")}
          </div>

          ${finished?`
            <div class="winner-inline">
              <b>🏆 Winner: ${esc(winner?.players?.name||"")}${winner?` · ${winner.score} points`:""}</b>
              <small>Highest score wins in Custom.</small>
            </div>
          `:`
            <div class="actions game-actions">
              <button class="btn" onclick="undo()">↶ Undo</button>
              <button class="btn" onclick="historyGame('${state.game.id}')">History</button>
            </div>
            ${completed.size?`<button class="btn primary custom-next-round" onclick="customManualNextRound()">Next Round</button>`:""}
            <button class="btn finish-btn" onclick="finishGame()">Finish Game</button>
            <button class="btn primary add-player-game" onclick="addPlayerToGameUI()">＋ Add Player to Game</button>
          `}
        `;

        if(!document.querySelector("#custom-v16-style")){
          const style=document.createElement("style");
          style.id="custom-v16-style";
          style.textContent=`
            .custom-round-card{margin-bottom:12px;padding:14px 16px}
            .custom-round-title{font-weight:800;font-size:16px}
            .custom-round-sub{margin-top:4px;color:var(--muted);font-size:13px;line-height:1.4}
            .custom-progress{margin-top:10px;font-size:12px;font-weight:800}
            .custom-player.done{opacity:.72}
            .custom-player:disabled{cursor:default}
            .custom-recorded{font-size:18px;font-weight:900;color:var(--muted);min-width:22px;text-align:right}
            .custom-next-round{width:100%;margin:10px 0}
            .custom-amount-display{font-size:42px;font-weight:900;text-align:center;margin:12px 0}
          `;
          document.head.appendChild(style);
        }
      }

      function customEnterAmount(pid){
        if(!isCustomGame() || state.game.status==="completed") return;
        const gp=state.gamePlayers.find(x=>x.player_id===pid);
        if(!gp) return;

        const round=Number(state.game.round);
        const existing=customEntry(pid,round);
        const existingValue=existing?Number(existing.delta):"";

        showModal(`
          <div class="player-modal-head">
            ${avatar(gp.players)}
            <div>
              <h2>${esc(gp.players.name)}</h2>
              <div class="game-meta">Round ${round} · Total ${gp.score}</div>
            </div>
          </div>
          <div class="custom-amount-display" id="customAmountDisplay">${existingValue===""?"0":existingValue}</div>
          <p class="game-meta" style="text-align:center">Enter the score for ${esc(gp.players.name)} this round. Negative values are allowed.</p>
          <input id="customAmountInput" class="score-key-input" type="number" step="1" inputmode="numeric" placeholder="0" value="${existingValue}" autocomplete="off">
          <div class="actions" style="margin-top:14px">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn primary" onclick="customSaveAmount('${pid}')">Record</button>
          </div>
        `);

        const input=$("#customAmountInput");
        if(input){
          input.addEventListener("input",()=>$("#customAmountDisplay").textContent=input.value||"0");
          input.addEventListener("keydown",e=>{
            if(e.key==="Enter"){
              e.preventDefault();
              customSaveAmount(pid);
            }
          });
          input.focus();
        }
      }

      async function customSaveAmount(pid){
        if(!isCustomGame() || state.game.status==="completed") return;

        const input=$("#customAmountInput");
        const amount=Number(input?.value);
        if(!Number.isFinite(amount)){
          toast("Enter a score");
          return;
        }

        const delta=Math.trunc(amount);
        const round=Number(state.game.round);

        if(customEntry(pid,round)){
          closeModal();
          return;
        }

        closeModal();

        if(!(await baseApplyDelta(pid,delta))) return;

        const latest=state.history.find(x=>
          x.player_id===pid &&
          Number(x.round)===round &&
          Number(x.delta)===delta
        );
        if(latest) latest.custom_entry=true;

        if(customCompleted(round).size>=state.gamePlayers.length){
          await baseNextRound(true);
        }else{
          renderCustomGame();
        }
      }

      async function customManualNextRound(){
        if(!isCustomGame() || state.game.status==="completed") return;

        const round=Number(state.game.round);
        if(customCompleted(round).size<state.gamePlayers.length){
          toast("Record all players first");
          return;
        }

        await baseNextRound(false);
      }

      function renderGamesWithCustom(){
        const presets=["UnderCut","Lavaa","Dingu","Hukun kaalaa"];

        $("#content").innerHTML=`
          <div class="row page-intro">
            <div>
              <h2>Your Games</h2>
              <p>${state.games.length} ongoing game${state.games.length===1?"":"s"}</p>
            </div>
            <button class="btn primary" onclick="newGame()">+ New Game</button>
          </div>

          <div class="section-title">Game types</div>

          <div class="game-types">
            ${presets.map((name,i)=>`
              <button class="preset-card ${i===0?"featured":""}" onclick="newGame('${esc(name)}')">
                <span class="preset-icon">🎮</span>
                <span><b>${esc(name)}</b><small>Ready to play</small></span>
                <span class="preset-arrow">›</span>
              </button>
            `).join("")}

            <button class="preset-card custom-game-card" onclick="customNewGame()">
              <span class="preset-icon">✏️</span>
              <span><b>Custom</b><small>Enter your own scores</small></span>
              <span class="preset-arrow">›</span>
            </button>
          </div>

          <div class="section-title">Saved games</div>

          <div class="stack">
            ${state.games.length
              ? state.games.map(g=>`
                <button class="card game-card" style="text-align:left" onclick="openGame('${g.id}')">
                  <div class="row">
                    <div class="row" style="justify-content:flex-start">
                      <div class="game-icon">🎮</div>
                      <div><h3>${esc(g.name)}</h3><div class="game-meta">Active · Round ${g.round}</div></div>
                    </div>
                    <span class="chevron">›</span>
                  </div>
                </button>
              `).join("")
              : `<div class="card empty">No saved games yet.<br>Choose a game type above to start.</div>`
            }
          </div>
        `;

        if(!document.querySelector("#custom-games-v16-style")){
          const style=document.createElement("style");
          style.id="custom-games-v16-style";
          style.textContent=`.custom-game-card{border-style:dashed}.custom-game-card .preset-icon{background:var(--soft)}`;
          document.head.appendChild(style);
        }
      }

      function customNewGame(){
        if(!state.players.length){
          toast("Add at least one player first");
          return;
        }

        showModal(`
          <h2>New Custom Game</h2>
          <p class="game-meta">Choose the players. You can enter any positive or negative score each round.</p>
          <div class="section-title" style="margin-top:14px">Players</div>
          <div id="customPlayerChoices" class="choice-list">
            ${state.players.map(p=>`
              <label class="choice-row">
                <input type="checkbox" value="${p.id}">
                <span>${avatar(p)}</span>
                <b>${esc(p.name)}</b>
              </label>
            `).join("")}
          </div>
          <div class="actions" style="margin-top:16px">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn primary" onclick="createCustomGame()">Create Game</button>
          </div>
        `);
      }

      async function createCustomGame(){
        const selected=[...document.querySelectorAll("#customPlayerChoices input:checked")].map(x=>x.value);

        if(!selected.length){
          toast("Choose at least one player");
          return;
        }

        if(!state.session?.user?.id){
          toast("Your login session is not ready. Please log in again.");
          return;
        }

        const button=document.querySelector("#modalRoot .btn.primary:last-child");
        if(button){
          button.disabled=true;
          button.textContent="Creating…";
        }

        try{
          const ownerId=state.session.user.id;

          const {data:g,error}=await runWithTimeout(
            sb.from("games")
              .insert({name:"Custom",sort_mode:"custom",owner_id:ownerId})
              .select("id,name,round,status,sort_mode,owner_id")
              .single(),
            12000,
            "Creating the game timed out. Please try again."
          );

          if(error) throw error;

          const rows=selected.map((pid,i)=>({
            game_id:g.id,
            player_id:pid,
            score:0,
            player_order:i,
            owner_id:ownerId
          }));

          const {error:e}=await runWithTimeout(
            sb.from("game_players").insert(rows),
            12000,
            "The game was created, but adding its players timed out."
          );

          if(e){
            await sb.from("games").delete().eq("id",g.id).eq("owner_id",ownerId);
            throw e;
          }

          closeModal();
          await runWithTimeout(loadAll(),15000,"Game created, but refreshing your games timed out.");
          await runWithTimeout(openGame(g.id),15000,"Game created, but opening it timed out.");
        }catch(err){
          console.error("Create custom game error",err);
          toast(err?.message||"Could not create game");
          if(button){
            button.disabled=false;
            button.textContent="Create Game";
          }
        }
      }

      async function customFinishGame(){
        if(!isCustomGame()) return baseFinishGame();
        if(state.game?.status==="completed") return;

        const ps=orderedPlayers();
        if(!ps.length) return;

        if(!confirm("Finish this game? Scores will become read-only.")) return;

        const sorted=[...ps].sort((a,b)=>b.score-a.score);
        const winner=sorted[0];

        const {error}=await sb.from("games").update({
          status:"completed",
          updated_at:new Date().toISOString()
        }).eq("id",state.game.id);

        if(error){
          toast(error.message);
          return;
        }

        state.game.status="completed";
        renderCustomGame();
        showWinners(sorted,winner);
        celebrate(`WINNER: ${winner.players.name}`);
      }

      async function deleteHistoryGameV16(id){
        if(!id) return;

        const game=(state.completedGames||[]).find(g=>g.id===id);
        if(!game) return;

        if(!confirm(`Delete "${game.name}" from game history? This cannot be undone.`)) return;

        try{
          const ownerId=state.session?.user?.id;
          if(!ownerId) throw new Error("Your login session is not ready. Please log in again.");

          const a=await runWithTimeout(
            sb.from("score_changes").delete().eq("game_id",id).eq("owner_id",ownerId),
            12000,
            "Deleting the game's score history timed out. Please try again."
          );
          if(a.error) throw a.error;

          const b=await runWithTimeout(
            sb.from("game_players").delete().eq("game_id",id).eq("owner_id",ownerId),
            12000,
            "Deleting the game's players timed out. Please try again."
          );
          if(b.error) throw b.error;

          const c=await runWithTimeout(
            sb.from("games").delete().eq("id",id).eq("owner_id",ownerId),
            12000,
            "Deleting the game timed out. Please try again."
          );
          if(c.error) throw c.error;

          closeModal();
          toast("Game deleted");
          await runWithTimeout(loadAll(),15000,"Game deleted, but refreshing history timed out. Please refresh once.");
          state.tab="history";
          render();
        }catch(err){
          console.error("Delete history game error",err);
          toast(err?.message||"Could not delete game");
        }
      }

      async function renderHistoryV16(){
        const games=state.completedGames||[];

        if(!games.length){
          $("#content").innerHTML=`<div class="card empty">No game history yet.</div>`;
          return;
        }

        const rows=await Promise.all(games.map(async g=>{
          const {data,error}=await sb.from("game_players")
            .select("*, players(*)")
            .eq("game_id",g.id)
            .order("player_order");
          return {g,data:data||[],error};
        }));

        $("#content").innerHTML=`
          <div class="page-intro">
            <h2>Game History</h2>
            <p>Finished games are kept here. Ongoing games stay in Games.</p>
          </div>

          <div class="stack">
            ${rows.map(({g,data,error})=>{
              if(error||!data.length){
                return `<div class="card history-card">
                  <button class="history-card-main" onclick="historyGame('${g.id}')">
                    <div class="row" style="justify-content:flex-start">
                      <div class="game-icon">🎮</div>
                      <div><h3>${esc(g.name)}</h3><div class="game-meta">Finished · Round ${g.round}</div></div>
                    </div>
                    <span class="chevron">›</span>
                  </button>
                  <button class="btn danger history-delete-v16" onclick="deleteHistoryGameV16('${g.id}')">Delete Game</button>
                </div>`;
              }

              const uc=String(g.name).trim().toLowerCase()==="undercut";
              const sorted=[...data].sort((a,b)=>uc?a.score-b.score:b.score-a.score);
              const w=sorted[0];

              return `<div class="card history-card">
                <button class="history-card-main" onclick="historyGame('${g.id}')">
                  <div class="row" style="justify-content:flex-start">
                    <div class="game-icon">🎮</div>
                    <div><h3>${esc(g.name)}</h3><div class="game-meta">Finished · Round ${g.round}</div></div>
                  </div>
                  <div class="winner-inline" style="margin-top:14px">
                    <b>🏆 Winner: ${esc(w.players?.name||"Player")} · ${w.score} points</b>
                    <small>${uc?"Lowest score wins in UnderCut.":"Highest score wins."}</small>
                  </div>
                </button>
                <button class="btn danger history-delete-v16" onclick="deleteHistoryGameV16('${g.id}')">Delete Game</button>
              </div>`;
            }).join("")}
          </div>
        `;

        if(!document.querySelector("#history-v16-style")){
          const style=document.createElement("style");
          style.id="history-v16-style";
          style.textContent=`
            .history-card{display:block}
            .history-card-main{width:100%;display:block;border:0;background:transparent;color:inherit;padding:0;text-align:left;font:inherit;cursor:pointer}
            .history-delete-v16{width:100%;margin-top:12px}
            .history-modal-actions{display:flex;gap:10px;justify-content:center;align-items:center}
            .history-modal-actions .btn{flex:1}
            .history-v16-modal-delete{background:#b83b3b;color:#fff;border-color:#b83b3b}
          `;
          document.head.appendChild(style);
        }
      }

      renderGame=function(){
        if(isCustomGame()) return renderCustomGame();
        return baseRenderGame();
      };

      renderHistory=renderHistoryV16;

      window.customNewGame=customNewGame;
      window.createCustomGame=createCustomGame;
      window.customEnterAmount=customEnterAmount;
      window.customSaveAmount=customSaveAmount;
      window.customManualNextRound=customManualNextRound;
      window.deleteHistoryGameV16=deleteHistoryGameV16;

      finishGame=function(){
        if(isCustomGame()) return customFinishGame();
        return baseFinishGame();
      };

      renderGames=function(){
        renderGamesWithCustom();
      };

      historyGame=async function(id){
        await baseHistoryGame(id);

        const modal=$("#modalRoot");
        if(!modal) return;
        if(modal.querySelector(".history-v16-modal-delete")) return;

        const closeButton=modal.querySelector(".history-winner .actions .btn.primary");
        if(!closeButton) return;

        const actions=closeButton.parentElement;
        actions.classList.add("history-modal-actions");

        const del=document.createElement("button");
        del.className="btn danger history-v16-modal-delete";
        del.textContent="Delete Game";
        del.onclick=()=>deleteHistoryGameV16(id);
        actions.appendChild(del);
      };

      window.__scorekeeperVersion="v16";

      if(state.game) renderGame();
      else if(state.tab==="history") renderHistory();
      else if(state.tab==="games") renderGames();
    };
    waitForApp();
  };
  s.onerror=function(){console.error("Scorekeeper v16 loader could not load loader-v15.js");};
  document.head.appendChild(s);
})();