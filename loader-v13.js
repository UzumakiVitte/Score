(function(){
  const s=document.createElement("script");
  s.src="loader-v12.js?13";
  s.onload=function(){
    const waitForApp=()=>{
      if(!window.__scorekeeperVersion || typeof state==="undefined" || typeof renderGame!=="function" || typeof loadAll!=="function"){
        setTimeout(waitForApp,50);
        return;
      }

      const baseRenderGame=renderGame;
      const baseApplyDelta=applyDelta;
      const baseNextRound=nextRound;
      const baseFinishGame=finishGame;
      const baseHistoryGame=historyGame;

      function isLavaaGame(){
        return state.game && String(state.game.name).trim().toLowerCase()==="lavaa";
      }

      function lavPoints(playerCount, position){
        if(playerCount <= 1) return -100;
        if(position === playerCount) return -100;
        return (playerCount - position + 1) * 100;
      }

      function lavRoundEntries(round){
        return state.history.filter(x=>Number(x.round)===Number(round));
      }

      function lavCompleted(round){
        return new Set(lavRoundEntries(round).map(x=>x.player_id));
      }

      function lavRoundPoints(pid, round){
        return lavRoundEntries(round)
          .filter(x=>x.player_id===pid)
          .reduce((sum,x)=>sum+Number(x.delta||0),0);
      }

      function lavPosition(pid, round){
        const entries=lavRoundEntries(round);
        for(let i=0;i<entries.length;i++){
          if(entries[i].player_id===pid) return i+1;
        }
        return null;
      }

      function renderLavaaGame(){
        const ps=orderedPlayers();
        const finished=state.game.status==="completed";
        const round=Number(state.game.round);
        const completed=lavCompleted(round);
        const winner=finished ? currentWinner() : null;

        setTitle(state.game.name);

        const currentOrder=[...completed]
          .map(pid=>{
            const gp=state.gamePlayers.find(x=>x.player_id===pid);
            return gp;
          })
          .filter(Boolean);

        $("#content").innerHTML=`
          <div class="game-header">
            <button class="btn small" onclick="goGames()">‹ Games</button>
            <div class="game-title-center">
              <h2>${esc(state.game.name)}</h2>
              <div class="game-meta">Round ${round}</div>
            </div>
            <button class="btn small" onclick="gameMenu()">•••</button>
          </div>

          <div class="lavaa-round-card card">
            <div class="lavaa-round-title">Tap players in the order they finish</div>
            <div class="lavaa-round-sub">1st gets ${ps.length*100} points. Last gets −100 points.</div>
            ${currentOrder.length ? `
              <div class="lavaa-order">
                ${currentOrder.map((gp,i)=>{
                  const p=lavPoints(ps.length,i+1);
                  return `<span class="lavaa-chip">${i+1} · ${esc(gp.players.name)} <b>${p>=0?"+":""}${p}</b></span>`;
                }).join("")}
              </div>` : ""}
          </div>

          <div class="player-list lavaa-player-list">
            ${ps.map(gp=>{
              const done=completed.has(gp.player_id);
              const pos=lavPosition(gp.player_id,round);
              const pts=done ? lavRoundPoints(gp.player_id,round) : 0;
              const prev=round>1 ? lavRoundPoints(gp.player_id,round-1) : 0;
              return `
                <button class="simple-player lavaa-player ${done?"done":""}" ${done||finished?"disabled":""} onclick="lavaaFinishPlayer('${gp.player_id}')">
                  ${avatar(gp.players)}
                  <div class="simple-player-main">
                    <div class="player-name">${esc(gp.players.name)}</div>
                    <div class="player-sub">${round>1?`Round ${round-1}: ${prev} · `:""}This round: ${done?(pts>=0?"+":"")+pts:"0"}</div>
                  </div>
                  <div class="score-big">${gp.score}</div>
                  ${done ? `<div class="lavaa-position">${pos}th</div>` : `<span class="chevron">›</span>`}
                </button>`;
            }).join("")}
          </div>

          ${finished ? `
            <div class="winner-inline">🏆 <b>Winner: ${esc(winner?.players?.name||"")}${winner?` · ${winner.score} points`:""}</b><small>Highest score wins in Lavaa.</small></div>
          ` : `
            <div class="actions game-actions">
              <button class="btn" onclick="undo()">↶ Undo</button>
              <button class="btn" onclick="historyGame('${state.game.id}')">History</button>
            </div>
            ${completed.size ? `<button class="btn primary lavaa-next-round" onclick="lavaaManualNextRound()">Next Round</button>` : ""}
            <button class="btn finish-btn" onclick="finishGame()">Finish Game</button>
            <button class="btn primary add-player-game" onclick="addPlayerToGameUI()">＋ Add Player to Game</button>
          `}
        `;

        const style=document.createElement("style");
        style.id="lavaa-v13-style";
        style.textContent=`
          .lavaa-round-card{margin-bottom:12px;padding:14px 16px}
          .lavaa-round-title{font-weight:800;font-size:16px}
          .lavaa-round-sub{margin-top:4px;color:var(--muted);font-size:13px}
          .lavaa-order{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
          .lavaa-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 9px;border-radius:999px;background:var(--soft);font-size:12px}
          .lavaa-player.done{opacity:.72}
          .lavaa-player:disabled{cursor:default}
          .lavaa-position{font-size:12px;font-weight:800;color:var(--muted);min-width:38px;text-align:right}
          .lavaa-next-round{width:100%;margin:10px 0}
        `;
        if(!document.querySelector("#lavaa-v13-style")) document.head.appendChild(style);
      }

      async function lavFinishPlayer(pid){
        if(!isLavaaGame() || state.game.status==="completed") return;

        const round=Number(state.game.round);
        const playerCount=state.gamePlayers.length;
        const completed=lavCompleted(round);
        if(completed.has(pid)) return;

        const position=completed.size+1;
        const delta=lavPoints(playerCount,position);

        // Update locally and persist through the existing scoring path.
        if(!(await baseApplyDelta(pid,delta))) return;

        const after=lavCompleted(round);
        if(after.size>=playerCount){
          // Every player's result is recorded, so start the next round automatically.
          await baseNextRound(true);
        }else{
          renderLavaaGame();
        }
      }

      async function lavManualNextRound(){
        if(!isLavaaGame() || state.game.status==="completed") return;
        const completed=lavCompleted(Number(state.game.round));
        if(!completed.size){
          toast("Record at least one finish first");
          return;
        }
        await baseNextRound(false);
      }

      async function lavFinishGame(){
        if(!isLavaaGame()){
          return baseFinishGame();
        }
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

        if(error){toast(error.message);return;}

        state.game.status="completed";
        renderLavaaGame();
        showWinners(sorted,winner);
        celebrate(`WINNER: ${winner.players.name}`);
      }

      renderGame=function(){
        if(isLavaaGame()) return renderLavaaGame();
        return baseRenderGame();
      };

      window.lavaaFinishPlayer=lavFinishPlayer;
      window.lavaaManualNextRound=lavManualNextRound;
      nextRound=function(auto=false){
        if(isLavaaGame()) return baseNextRound(auto);
        return baseNextRound(auto);
      };
      finishGame=function(){
        if(isLavaaGame()) return lavFinishGame();
        return baseFinishGame();
      };

      window.__scorekeeperVersion="v13";
      if(isLavaaGame()) renderLavaaGame();
    };
    waitForApp();
  };
  s.onerror=function(){console.error("Scorekeeper v13 loader could not load loader-v12.js");};
  document.head.appendChild(s);
})();