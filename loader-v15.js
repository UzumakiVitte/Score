(function(){
  const s=document.createElement("script");
  s.src="loader-v14.js?15";
  s.onload=function(){
    const waitForApp=()=>{
      if(!window.__scorekeeperVersion || typeof state==="undefined" || typeof renderGame!=="function" || typeof loadAll!=="function"){
        setTimeout(waitForApp,50);
        return;
      }

      const baseRenderGame=renderGame;
      const baseNewGame=newGame;
      const baseFinishGame=finishGame;
      const baseHistoryGame=historyGame;
      const baseRenderGames=renderGames;

      const HUKUN_NAME="Hukun kaalaa";
      const HUKUN_STORAGE_PREFIX="scorekeeper_hukun_v15_";

      function isHukunGame(){
        return state.game && String(state.game.name).trim().toLowerCase()===HUKUN_NAME.toLowerCase();
      }

      function hukunKey(){
        return HUKUN_STORAGE_PREFIX + state.game.id;
      }

      function blankHukunData(){
        return { rounds:{} };
      }

      function getHukunData(){
        try{
          const raw=localStorage.getItem(hukunKey());
          const data=raw ? JSON.parse(raw) : blankHukunData();
          if(!data.rounds) data.rounds={};
          return data;
        }catch(e){
          return blankHukunData();
        }
      }

      function saveHukunData(data){
        localStorage.setItem(hukunKey(),JSON.stringify(data));
      }

      function getHukunRound(round){
        const data=getHukunData();
        const key=String(round);
        if(!data.rounds[key]){
          data.rounds[key]={guesses:{},results:{}};
          saveHukunData(data);
        }
        return data.rounds[key];
      }

      function hukunRoundComplete(round){
        const r=getHukunRound(round);
        const ps=state.gamePlayers||[];
        return ps.length>0 && ps.every(gp =>
          Object.prototype.hasOwnProperty.call(r.guesses,gp.player_id) &&
          Object.prototype.hasOwnProperty.call(r.results,gp.player_id)
        );
      }

      function hukunGuessingComplete(round){
        const r=getHukunRound(round);
        const ps=state.gamePlayers||[];
        return ps.length>0 && ps.every(gp =>
          Object.prototype.hasOwnProperty.call(r.guesses,gp.player_id)
        );
      }

      function hukunRoundScore(pid,round){
        return state.history
          .filter(x=>x.player_id===pid && Number(x.round)===Number(round))
          .reduce((sum,x)=>sum+Number(x.delta||0),0);
      }

      function hukunGuessSet(pid,round){
        const r=getHukunRound(round);
        return Object.prototype.hasOwnProperty.call(r.guesses,pid);
      }

      function hukunResultSet(pid,round){
        const r=getHukunRound(round);
        return Object.prototype.hasOwnProperty.call(r.results,pid);
      }

      function hukunResultDelta(pid,round){
        const r=getHukunRound(round);
        const guess=Number(r.guesses[pid]||0);
        if(!Object.prototype.hasOwnProperty.call(r.results,pid)) return 0;
        return r.results[pid] ? guess*100 : -guess*100;
      }

      function hukunDisplayDelta(pid,round){
        const delta=hukunResultDelta(pid,round);
        return delta>0 ? "+"+delta : String(delta);
      }

      function renderHukunGame(){
        const ps=orderedPlayers();
        const finished=state.game.status==="completed";
        const round=Number(state.game.round);
        const r=getHukunRound(round);
        const allGuessed=hukunGuessingComplete(round);
        const allDone=hukunRoundComplete(round);
        const winner=finished ? currentWinner() : null;

        setTitle(state.game.name);

        const previousRound=round>1 ? round-1 : null;

        $("#content").innerHTML=`
          <div class="game-header">
            <button class="btn small" onclick="goGames()">‹ Games</button>
            <div class="game-title-center">
              <h2>${esc(state.game.name)}</h2>
              <div class="game-meta">Round ${round}</div>
            </div>
            <button class="btn small" onclick="gameMenu()">•••</button>
          </div>

          <div class="hukun-round-card card">
            <div class="hukun-round-title">${allGuessed ? "Mark whether each player made their guess" : "Enter each player's guess"}</div>
            <div class="hukun-round-sub">
              ${allGuessed
                ? "Tap ✓ if the player reached their guess. Tap ✕ if they did not."
                : "Each successful guess earns the guessed amount × 100. A missed guess deducts the same amount."}
            </div>
            <div class="hukun-progress">
              ${allGuessed
                ? `${Object.keys(r.results).length} of ${ps.length} results recorded`
                : `${Object.keys(r.guesses).length} of ${ps.length} guesses recorded`}
            </div>
          </div>

          <div class="player-list hukun-player-list">
            ${ps.map(gp=>{
              const pid=gp.player_id;
              const guessed=hukunGuessSet(pid,round);
              const resultSet=hukunResultSet(pid,round);
              const guess=guessed ? Number(r.guesses[pid]) : null;
              const delta=resultSet ? hukunDisplayDelta(pid,round) : "0";
              const previous=previousRound!==null ? hukunRoundScore(pid,previousRound) : null;

              return `
                <div class="simple-player hukun-player ${resultSet?"done":""}">
                  ${avatar(gp.players)}
                  <div class="simple-player-main">
                    <div class="player-name">${esc(gp.players.name)}</div>
                    <div class="player-sub">
                      ${previousRound!==null ? `Round ${previousRound}: ${previous} · ` : ""}
                      This round: ${resultSet ? delta : "0"}
                      ${guessed ? ` · Guess: ${guess}` : ""}
                    </div>
                    ${!finished && !allGuessed ? `
                      <button class="hukun-guess-button" onclick="hukunEnterGuess('${pid}')">
                        ${guessed ? `Guess: ${guess} · Edit` : "Enter Guess"}
                      </button>
                    ` : ""}
                    ${!finished && allGuessed && !resultSet ? `
                      <div class="hukun-result-buttons">
                        <button class="hukun-result yes" onclick="hukunMarkResult('${pid}',true)">✓</button>
                        <button class="hukun-result no" onclick="hukunMarkResult('${pid}',false)">✕</button>
                      </div>
                    ` : ""}
                  </div>
                  <div class="score-big">${gp.score}</div>
                  ${resultSet ? `<div class="hukun-recorded">${r.results[pid] ? "✓" : "✕"}</div>` : ""}
                </div>`;
            }).join("")}
          </div>

          ${finished ? `
            <div class="winner-inline">
              🏆 <b>Winner: ${esc(winner?.players?.name||"")}${winner ? ` · ${winner.score} points` : ""}</b>
              <small>Highest score wins in Hukun kaalaa.</small>
            </div>
          ` : `
            <div class="actions game-actions">
              <button class="btn" onclick="historyGame('${state.game.id}')">History</button>
            </div>
            <button class="btn finish-btn" onclick="finishGame()">Finish Game</button>
            <button class="btn primary add-player-game" onclick="addPlayerToGameUI()">＋ Add Player to Game</button>
          `}
        `;

        if(!document.querySelector("#hukun-v15-style")){
          const style=document.createElement("style");
          style.id="hukun-v15-style";
          style.textContent=`
            .hukun-round-card{margin-bottom:12px;padding:14px 16px}
            .hukun-round-title{font-weight:800;font-size:16px}
            .hukun-round-sub{margin-top:4px;color:var(--muted);font-size:13px;line-height:1.4}
            .hukun-progress{margin-top:10px;font-size:12px;font-weight:800}
            .hukun-player{min-height:92px;align-items:flex-start}
            .hukun-player.done{opacity:.78}
            .hukun-guess-button{margin-top:8px;border:1px solid var(--border);background:var(--soft);color:var(--text);border-radius:12px;padding:7px 10px;font:inherit;font-size:12px;font-weight:800}
            .hukun-result-buttons{display:flex;gap:8px;margin-top:8px}
            .hukun-result{width:48px;height:42px;border-radius:12px;border:1px solid var(--border);font-size:24px;font-weight:900}
            .hukun-result.yes{background:rgba(70,180,100,.16);color:#54c878}
            .hukun-result.no{background:rgba(190,70,70,.16);color:#ff6d6d}
            .hukun-recorded{font-size:18px;font-weight:900;color:var(--muted);min-width:22px;text-align:right}
          `;
          document.head.appendChild(style);
        }
      }

      function hukunEnterGuess(pid){
        if(!isHukunGame() || state.game.status==="completed") return;

        const round=Number(state.game.round);
        const r=getHukunRound(round);
        const gp=state.gamePlayers.find(x=>x.player_id===pid);
        if(!gp) return;

        const existing=Object.prototype.hasOwnProperty.call(r.guesses,pid) ? Number(r.guesses[pid]) : "";

        showModal(`
          <div class="player-modal-head">
            ${avatar(gp.players)}
            <div>
              <h2>${esc(gp.players.name)}</h2>
              <div class="game-meta">Round ${round} · Total ${gp.score}</div>
            </div>
          </div>

          <div class="score-display" id="hukunGuessDisplay">${existing==="" ? "0" : existing}</div>
          <p class="game-meta" style="text-align:center">How many hands do you think ${esc(gp.players.name)} will win?</p>
          <input id="hukunGuessInput" class="score-key-input" type="number" min="0" step="1" inputmode="numeric" placeholder="0" value="${existing}" autocomplete="off">

          <div class="actions" style="margin-top:14px">
            <button class="btn" onclick="closeModal()">Cancel</button>
            <button class="btn primary" onclick="hukunSaveGuess('${pid}')">Save Guess</button>
          </div>
        `);

        const input=$("#hukunGuessInput");
        if(input){
          input.addEventListener("input",()=>$("#hukunGuessDisplay").textContent=input.value||"0");
          input.addEventListener("keydown",e=>{
            if(e.key==="Enter"){
              e.preventDefault();
              hukunSaveGuess(pid);
            }
          });
          input.focus();
        }
      }

      function hukunSaveGuess(pid){
        if(!isHukunGame() || state.game.status==="completed") return;

        const input=$("#hukunGuessInput");
        const value=Number(input?.value);

        if(!Number.isInteger(value) || value<0){
          toast("Enter a whole number");
          return;
        }

        const round=Number(state.game.round);
        const data=getHukunData();
        if(!data.rounds[String(round)]) data.rounds[String(round)]={guesses:{},results:{}};
        data.rounds[String(round)].guesses[pid]=value;
        saveHukunData(data);

        closeModal();
        renderHukunGame();
      }

      async function hukunMarkResult(pid,madeIt){
        if(!isHukunGame() || state.game.status==="completed") return;

        const round=Number(state.game.round);
        const r=getHukunRound(round);

        if(!Object.prototype.hasOwnProperty.call(r.guesses,pid)){
          toast("Enter the player's guess first");
          return;
        }

        if(Object.prototype.hasOwnProperty.call(r.results,pid)) return;

        const guess=Number(r.guesses[pid]||0);
        const delta=madeIt ? guess*100 : -guess*100;

        if(!(await applyDelta(pid,delta))) return;

        const data=getHukunData();
        if(!data.rounds[String(round)]) data.rounds[String(round)]={guesses:{},results:{}};
        data.rounds[String(round)].results[pid]=!!madeIt;
        saveHukunData(data);

        if(hukunRoundComplete(round)){
          await nextRound(true);
        }else{
          renderHukunGame();
        }
      }

      function hukunResetRoundData(round){
        const data=getHukunData();
        delete data.rounds[String(round)];
        saveHukunData(data);
      }

      renderGame=function(){
        if(isHukunGame()) return renderHukunGame();
        return baseRenderGame();
      };

      renderGames=function(){
        baseRenderGames();
        document.querySelectorAll(".preset-card span small").forEach(el=>{
          el.textContent="Ready to play";
        });
      };

      newGame=function(preset=""){
        baseNewGame(preset);
        setTimeout(()=>{
          document.querySelectorAll(".game-choice small").forEach(el=>{
            el.textContent="Scoring ready";
          });
        },0);
      };

      window.hukunEnterGuess=hukunEnterGuess;
      window.hukunSaveGuess=hukunSaveGuess;
      window.hukunMarkResult=hukunMarkResult;

      finishGame=function(){
        if(isHukunGame()) return baseFinishGame();
        return baseFinishGame();
      };

      window.__scorekeeperVersion="v15";
      if(state.game) renderGame();
      else if(state.tab==="games") renderGames();
    };
    waitForApp();
  };
  s.onerror=function(){
    console.error("Scorekeeper v15 loader could not load loader-v14.js");
  };
  document.head.appendChild(s);
})();