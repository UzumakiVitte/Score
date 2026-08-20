(function(){
  const s=document.createElement("script");
  s.src="loader-v10.js?11";
  s.onload=function(){
    const waitForApp=()=>{
      if(!window.__scorekeeperVersion || typeof state==="undefined" || typeof showModal!=="function"){
        setTimeout(waitForApp,50);
        return;
      }
      const style=document.createElement("style");
      style.textContent=`
        .next-round-btn{width:100%;margin-top:10px}
        .history-winner{padding:10px 4px 2px;text-align:center}
        .history-winner .trophy{font-size:58px}
        .history-winner .winner-name{font-size:30px}
        .history-winner .winner-score{font-size:42px}
        .history-winner .winner-sub{color:var(--muted);font-size:16px;margin-top:6px}
        .history-winner .history-podium{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:18px}
        .history-winner .history-podium .card{padding:12px 6px;text-align:center}
        .history-winner .history-podium .avatar{margin:auto}
        .history-winner .history-podium .place{font-size:11px;color:var(--muted);font-weight:800}
        .history-winner .history-podium .score{font-size:24px}
      `;
      document.head.appendChild(style);

      const originalRenderGame=renderGame;
      renderGame=function(){
        originalRenderGame();
        if(state.game?.status!=="completed"){
          const hasRoundActivity=state.history.some(x=>Number(x.round)===Number(state.game.round));
          if(hasRoundActivity && !document.querySelector(".next-round-btn")){
            const finish=document.querySelector(".finish-btn");
            if(finish){
              const b=document.createElement("button");
              b.className="btn primary next-round-btn";
              b.textContent="Next Round";
              b.onclick=()=>nextRound(false);
              finish.parentNode.insertBefore(b,finish);
            }
          }
        }
      };

      const originalConfirmUndercut=confirmUndercut;
      confirmUndercut=async function(pid){
        const roundBefore=Number(state.game.round);
        await originalConfirmUndercut(pid);
        if(state.game?.status==="completed") return;
        if(Number(state.game.round)===roundBefore){
          const completedPlayers=new Set(
            state.history.filter(x=>Number(x.round)===roundBefore).map(x=>x.player_id)
          );
          if(completedPlayers.size>=state.gamePlayers.length){
            await nextRound(false);
          }
        }
      };

      saveScore=async function(direction){
        const input=$("#scoreAmount");
        const amount=Number(input?.value);
        if(!Number.isFinite(amount)){toast("Enter a score");return;}
        const wholeAmount=Math.trunc(Math.abs(amount));
        if(wholeAmount<=0){toast("Enter a score");return;}
        const delta=wholeAmount*direction;
        closeModal();
        toast(delta>=0?`+${delta}`:`${delta}`);
        const ok=await applyDelta(selectedPlayerId,delta);
        if(ok) await advanceIfRoundComplete();
      };

      const originalScorePlayer=scorePlayer;
      scorePlayer=function(pid){
        originalScorePlayer(pid);
        const input=$("#scoreAmount");
        if(input){
          input.setAttribute("enterkeyhint","done");
          input.addEventListener("keydown",e=>{
            if(e.key==="Enter"){e.preventDefault();saveScore(1);}
          });
        }
      };

      renderHistory=async function(){
        const games=state.completedGames||[];
        if(!games.length){$("#content").innerHTML=`<div class="card empty">No game history yet.</div>`;return;}
        const rows=await Promise.all(games.map(async g=>{
          const {data,error}=await sb.from("game_players").select("*, players(*)").eq("game_id",g.id).order("player_order");
          return {g,data:data||[],error};
        }));
        $("#content").innerHTML=`
          <div class="page-intro"><h2>Game History</h2><p>Finished games are kept here. Ongoing games stay in Games.</p></div>
          <div class="stack">${rows.map(({g,data,error})=>{
            if(error||!data.length)return `<button class="card row history-game" style="text-align:left" onclick="historyGame('${g.id}')"><div class="row" style="justify-content:flex-start"><div class="game-icon">🎮</div><div><h3>${esc(g.name)}</h3><div class="game-meta">Finished · Round ${g.round}</div></div></div><span class="chevron">›</span></button>`;
            const uc=String(g.name).trim().toLowerCase()==="undercut";
            const sorted=[...data].sort((a,b)=>uc?a.score-b.score:b.score-a.score);
            const w=sorted[0];
            return `<button class="card history-game" style="text-align:left" onclick="historyGame('${g.id}')"><div class="row" style="justify-content:flex-start"><div class="game-icon">🎮</div><div><h3>${esc(g.name)}</h3><div class="game-meta">Finished · Round ${g.round}</div></div></div><div class="winner-inline" style="margin-top:14px"><b>🏆 Winner: ${esc(w.players?.name||"Player")} · ${w.score} points</b><small>${uc?"Lowest score wins in UnderCut.":"Highest score wins."}</small></div></button>`;
          }).join("")}</div>`;
      };

      historyGame=async function(id){
        const g=state.games.find(x=>x.id===id)||state.completedGames.find(x=>x.id===id)||(state.game?.id===id?state.game:null);
        if(!g)return;
        const {data,error}=await sb.from("game_players").select("*, players(*)").eq("game_id",id).order("player_order");
        if(error||!data?.length){toast(error?.message||"Could not load game history");return;}
        const uc=String(g.name).trim().toLowerCase()==="undercut";
        const sorted=[...data].sort((a,b)=>uc?a.score-b.score:b.score-a.score);
        const w=sorted[0];
        closeModal();
        showModal(`<div class="history-winner"><div class="trophy">🏆</div><div class="winner-kicker">GAME OVER</div><div class="winner-label">Winner</div><div class="winner-name">${esc(w.players?.name||"Player")}</div><div class="score-big winner-score">${w.score}</div><div class="winner-sub">${uc?"Lowest score wins in UnderCut.":"Highest score wins."}</div><div class="history-podium">${sorted.slice(0,3).map((p,i)=>`<div class="card"><div class="place">${["1ST","2ND","3RD"][i]}</div>${avatar(p.players)}<div class="player-name" style="margin-top:8px">${esc(p.players?.name||"Player")}</div><div class="score">${p.score}</div></div>`).join("")}</div><div class="actions" style="margin-top:18px"><button class="btn primary" onclick="closeModal()">Close</button></div></div>`);
      };

      window.__scorekeeperVersion="v11";
      if(state.game) renderGame();
    };
    waitForApp();
  };
  s.onerror=function(){console.error("Scorekeeper v11 loader could not load loader-v10.js");};
  document.head.appendChild(s);
})();