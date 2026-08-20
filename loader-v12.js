(function(){
  const s=document.createElement("script");
  s.src="loader-v11.js?12";
  s.onload=function(){
    const waitForApp=()=>{
      if(!window.__scorekeeperVersion || typeof state==="undefined" || typeof renderHistory!=="function" || typeof loadAll!=="function"){
        setTimeout(waitForApp,50);
        return;
      }

      const style=document.createElement("style");
      style.textContent=`
        .history-card{display:block}
        .history-card-main{width:100%;display:block;border:0;background:transparent;color:inherit;padding:0;text-align:left;font:inherit;cursor:pointer}
        .history-delete{width:100%;margin-top:12px}
        .btn.danger{background:#b83b3b;color:#fff;border-color:#b83b3b}
        .btn.danger:disabled{opacity:.65}
      `;
      document.head.appendChild(style);

      window.deleteHistoryGame=async function(id){
        if(!id) return;
        const game=state.completedGames.find(g=>g.id===id);
        if(!game) return;
        if(!window.confirm(`Delete "${game.name}" from game history? This cannot be undone.`)) return;

        const buttons=document.querySelectorAll(`.history-delete[data-game-id="${id}"]`);
        buttons.forEach(b=>{b.disabled=true;b.textContent="Deleting…";});

        try{
          if(!state.session?.user?.id) throw new Error("Your login session is not ready. Please log in again.");

          const ownerId=state.session.user.id;

          const scoreChanges=await runWithTimeout(
            sb.from("score_changes").delete().eq("game_id",id).eq("owner_id",ownerId),
            12000,
            "Deleting the game's score history timed out. Please try again."
          );
          if(scoreChanges.error) throw scoreChanges.error;

          const gamePlayers=await runWithTimeout(
            sb.from("game_players").delete().eq("game_id",id).eq("owner_id",ownerId),
            12000,
            "Deleting the game's players timed out. Please try again."
          );
          if(gamePlayers.error) throw gamePlayers.error;

          const deletedGame=await runWithTimeout(
            sb.from("games").delete().eq("id",id).eq("owner_id",ownerId),
            12000,
            "Deleting the game timed out. Please try again."
          );
          if(deletedGame.error) throw deletedGame.error;

          toast("Game deleted");
          await runWithTimeout(loadAll(),15000,"Game deleted, but refreshing history timed out. Please refresh once.");
          state.tab="history";
          render();
        }catch(err){
          console.error("Delete history game error",err);
          toast(err?.message||"Could not delete game");
          buttons.forEach(b=>{b.disabled=false;b.textContent="Delete Game";});
        }
      };

      const originalRenderHistory=renderHistory;
      renderHistory=async function(){
        const games=state.completedGames||[];
        if(!games.length){
          $("#content").innerHTML=`<div class="card empty">No game history yet.</div>`;
          return;
        }

        const rows=await Promise.all(games.map(async g=>{
          const {data,error}=await sb.from("game_players").select("*, players(*)").eq("game_id",g.id).order("player_order");
          return {g,data:data||[],error};
        }));

        $("#content").innerHTML=`
          <div class="page-intro"><h2>Game History</h2><p>Finished games are kept here. You can delete any finished game.</p></div>
          <div class="stack">${rows.map(({g,data,error})=>{
            if(error||!data.length){
              return `<div class="card history-card">
                <button class="history-card-main" onclick="historyGame('${g.id}')">
                  <div class="row" style="justify-content:flex-start"><div class="game-icon">🎮</div><div><h3>${esc(g.name)}</h3><div class="game-meta">Finished · Round ${g.round}</div></div></div>
                  <span class="chevron">›</span>
                </button>
                <button class="btn danger history-delete" data-game-id="${g.id}" onclick="deleteHistoryGame('${g.id}')">Delete Game</button>
              </div>`;
            }

            const uc=String(g.name).trim().toLowerCase()==="undercut";
            const sorted=[...data].sort((a,b)=>uc?a.score-b.score:b.score-a.score);
            const w=sorted[0];
            return `<div class="card history-card">
              <button class="history-card-main" onclick="historyGame('${g.id}')">
                <div class="row" style="justify-content:flex-start"><div class="game-icon">🎮</div><div><h3>${esc(g.name)}</h3><div class="game-meta">Finished · Round ${g.round}</div></div></div>
                <div class="winner-inline" style="margin-top:14px"><b>🏆 Winner: ${esc(w.players?.name||"Player")} · ${w.score} points</b><small>${uc?"Lowest score wins in UnderCut.":"Highest score wins."}</small></div>
              </button>
              <button class="btn danger history-delete" data-game-id="${g.id}" onclick="deleteHistoryGame('${g.id}')">Delete Game</button>
            </div>`;
          }).join("")}</div>`;
      };

      window.__scorekeeperVersion="v12";
      if(state.tab==="history") renderHistory();
    };
    waitForApp();
  };
  s.onerror=function(){console.error("Scorekeeper v12 loader could not load loader-v11.js");};
  document.head.appendChild(s);
})();