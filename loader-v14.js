(function(){
  const s=document.createElement("script");
  s.src="loader-v13.js?14";
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

      function isDinguGame(){
        return state.game && String(state.game.name).trim().toLowerCase()==="dingu";
      }

      function dinguEntries(round){
        return state.history.filter(x=>Number(x.round)===Number(round));
      }

      function dinguPlayersCompleted(round){
        return new Set(dinguEntries(round).map(x=>x.player_id));
      }

      function dinguRoundScore(pid, round){
        return dinguEntries(round)
          .filter(x=>x.player_id===pid)
          .reduce((sum,x)=>sum+Number(x.delta||0),0);
      }

      function dinguHasCardEntry(pid, round){
        return dinguEntries(round).some(x=>x.player_id===pid && x.dingu_card_entry===true);
      }

      function dinguWinnerBonusEntry(pid, round){
        return dinguEntries(round).some(x=>x.player_id===pid && x.dingu_winner_bonus===true);
      }

      function dinguCompleted(round){
        return new Set(
          dinguEntries(round)
            .filter(x=>x.dingu_card_entry===true)
            .map(x=>x.player_id)
        );
      }

      function dinguPoints(pid,round){
        return dinguRoundScore(pid,round);
      }

      function renderDinguGame(){
        const ps=orderedPlayers();
        const finished=state.game.status==="completed";
        const round=Number(state.game.round);
        const completed=dinguCompleted(round);
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

          <div class="dingu-round-card card">
            <div class="dingu-round-title">Count the cards in each player's hand</div>
            <div class="dingu-round-sub">Enter each player's card count. The round winner then receives +100 points.</div>
            ${completed.size ? `<div class="dingu-progress">${completed.size} of ${ps.length} players recorded</div>` : ""}
          </div>

          <div class="player-list dingu-player-list">
            ${ps.map(gp=>{
              const done=completed.has(gp.player_id);
              const roundScore=dinguPoints(gp.player_id,round);
              const previous=round>1 ? dinguRoundScore(gp.player_id,round-1) : null;
              const bonus=dinguWinnerBonusEntry(gp.player_id,round);
              return `
                <button class="simple-player dingu-player ${done?"done":""}" ${done||finished?"disabled":""} onclick="dinguEnterCards('${gp.player_id}')">
                  ${avatar(gp.players)}
                  <div class="simple-player-main">
                    <div class="player-name">${esc(gp.players.name)}</div>
                    <div class="player-sub">
                      ${round>1?`Round ${round-1}: ${previous} · `:""}
                      This round: ${done?roundScore:0}${bonus?" · +100 winner bonus":""}
                    </div>
                  </div>
                  <div class="score-big">${gp.score}</div>
                  ${done ? `<div class="dingu-recorded">✓</div>` : `<span class="chevron">›</span>`}
                </button>`;
            }).join("")}
          </div>

          ${finished ? `
            <div class="winner-inline">
              🏆 <b>Winner: ${esc(winner?.players?.name||"")}${winner?` · ${winner.score} points`:""}</b>
              <small>Highest score wins in Dingu.</small>
            </div>
          ` : `
            <div class="actions game-actions">
              <button class="btn" onclick="undo()">↶ Undo</button>
              <button class="btn" onclick="historyGame('${state.game.id}')">History</button>
            </div>
            ${completed.size ? `<button class="btn primary dingu-next-round" onclick="dinguManualNextRound()">Next Round</button>` : ""}
            <button class="btn finish-btn" onclick="finishGame()">Finish Game</button>
            <button class="btn primary add-player-game" onclick="addPlayerToGameUI()">＋ Add Player to Game</button>
          `}
        `;

        if(!document.querySelector("#dingu-v14-style")){
          const style=document.createElement("style");
          style.id="dingu-v14-style";
          style.textContent=`
            .dingu-round-card{margin-bottom:12px;padding:14px 16px}
            .dingu-round-title{font-weight:800;font-size:16px}
            .dingu-round-sub{margin-top:4px;color:var(--muted);font-size:13px;line-height:1.35}
            .dingu-progress{margin-top:10px;font-size:12px;font-weight:800}
            .dingu-player.done{opacity:.72}
            .dingu-recorded{font-size:18px;font-weight:900;color:var(--muted);min-width:22px;text-align:right}
            .dingu-next-round{width:100%;margin:10px 0}
            .dingu-winner-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
            .dingu-winner-grid .lowest-player{padding:10px}
          `;
          document.head.appendChild(style);
        }
      }

      function dinguEnterCards(pid){
        if(!isDinguGame() || state.game.status==="completed") return;
        const gp=state.gamePlayers.find(x=>x.player_id===pid);
        if(!gp) return;

        showModal(`
          <div class="player-modal-head">
            ${avatar(gp.players)}
            <div>
              <h2>${esc(gp.players.name)}</h2>
              <div class="game-meta">Round ${state.game.round} · Total ${gp.score}</div>
            </div>
          </div>

          <div class="score-display" id="dinguCardDisplay">0</div>
          <p class="game-meta" style="text-align:center">How many cards are in ${esc(gp.players.name)}'s hand?</p>
          <input id="dinguCardCount" class="score-key-input" type="number" min="0" step="1" inputmode="numeric" placeholder="0" autocomplete="off">
          <div class="actions" style="margin-top:14px">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn primary" onclick="dinguSaveCards('${pid}')">Record</button>
          </div>
        `);

        const input=$("#dinguCardCount");
        if(input){
          input.addEventListener("input",()=>$("#dinguCardDisplay").textContent=input.value||"0");
          input.addEventListener("keydown",e=>{
            if(e.key==="Enter"){e.preventDefault();dinguSaveCards(pid);}
          });
          input.focus();
        }
      }

      async function dinguSaveCards(pid){
        const input=$("#dinguCardCount");
        const count=Number(input?.value);
        if(!Number.isInteger(count) || count<0){
          toast("Enter a whole number of cards");
          return;
        }

        const round=Number(state.game.round);
        const already=dinguCompleted(round);
        if(already.has(pid)){
          closeModal();
          return;
        }

        closeModal();

        if(!(await baseApplyDelta(pid,count))) return;

        // Mark this local history entry as the Dingu card-count entry.
        const latest=state.history.find(x=>
          x.player_id===pid &&
          Number(x.round)===round &&
          Number(x.delta)===count
        );
        if(latest) latest.dingu_card_entry=true;

        const after=dinguCompleted(round);

        if(after.size>=state.gamePlayers.length){
          await dinguChooseRoundWinner();
        }else{
          renderDinguGame();
        }
      }

      async function dinguChooseRoundWinner(){
        const round=Number(state.game.round);
        const ps=orderedPlayers();

        showModal(`
          <div class="undercut-modal">
            <div class="undercut-symbol">🏆</div>
            <h2>Round Winner</h2>
            <p class="question">Who won this round?</p>
            <p>Select the player who should receive the additional <b>+100 points</b>.</p>
            <div class="dingu-winner-grid">
              ${ps.map(gp=>`
                <button class="lowest-player" onclick="dinguConfirmRoundWinner('${gp.player_id}')">
                  ${avatar(gp.players)}
                  <span>${esc(gp.players.name)}</span>
                </button>`).join("")}
            </div>
          </div>
        `);
      }

      async function dinguConfirmRoundWinner(pid){
        const round=Number(state.game.round);
        if(dinguWinnerBonusEntry(pid,round)){
          closeModal();
          return;
        }

        if(!(await baseApplyDelta(pid,100))) return;

        const latest=state.history.find(x=>
          x.player_id===pid &&
          Number(x.round)===round &&
          Number(x.delta)===100
        );
        if(latest) latest.dingu_winner_bonus=true;

        closeModal();
        toast("+100 Round Winner");
        await dinguAdvanceRound();
      }

      async function dinguAdvanceRound(){
        if(state.game.status==="completed") return;

        await baseNextRound(true);
      }

      async function dinguManualNextRound(){
        if(!isDinguGame() || state.game.status==="completed") return;

        const round=Number(state.game.round);
        const completed=dinguCompleted(round);

        if(completed.size<state.gamePlayers.length){
          toast("Record all players first");
          return;
        }

        const hasWinner=dinguEntries(round).some(x=>x.dingu_winner_bonus===true);
        if(!hasWinner){
          await dinguChooseRoundWinner();
          return;
        }

        await dinguAdvanceRound();
      }

      async function dinguFinishGame(){
        if(!isDinguGame()) return baseFinishGame();
        if(state.game.status==="completed") return;

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
        renderDinguGame();
        showWinners(sorted,winner);
        celebrate(`WINNER: ${winner.players.name}`);
      }

      renderGame=function(){
        if(isDinguGame()) return renderDinguGame();
        return baseRenderGame();
      };

      window.dinguEnterCards=dinguEnterCards;
      window.dinguSaveCards=dinguSaveCards;
      window.dinguChooseRoundWinner=dinguChooseRoundWinner;
      window.dinguConfirmRoundWinner=dinguConfirmRoundWinner;
      window.dinguManualNextRound=dinguManualNextRound;

      finishGame=function(){
        if(isDinguGame()) return dinguFinishGame();
        return baseFinishGame();
      };

      window.__scorekeeperVersion="v14";
      if(isDinguGame()) renderDinguGame();
    };
    waitForApp();
  };
  s.onerror=function(){console.error("Scorekeeper v14 loader could not load loader-v13.js");};
  document.head.appendChild(s);
})();