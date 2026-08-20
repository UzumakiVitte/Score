(function(){
  const s=document.createElement("script");
  s.src="loader-v16.js?19";
  s.onload=function(){
    const wait=()=>{
      if(typeof state==="undefined" || typeof render!=="function" || typeof deleteHistoryGameV16!=="function"){
        setTimeout(wait,50);
        return;
      }

      const ensureDeleteButtons=()=>{
        if(state.tab!=="history") return;

        document.querySelectorAll(".history-card").forEach(card=>{
          if(card.querySelector(".history-delete-v17")) return;

          const main=card.querySelector(".history-card-main");
          if(!main) return;

          const onclick=main.getAttribute("onclick") || "";
          const match=onclick.match(/historyGame\('([^']+)'\)/);
          if(!match) return;

          const id=match[1];
          const btn=document.createElement("button");
          btn.className="btn danger history-delete-v17";
          btn.type="button";
          btn.textContent="Delete Game";
          btn.onclick=(e)=>{
            e.stopPropagation();
            deleteHistoryGameV16(id);
          };
          card.appendChild(btn);
        });
      };

      const originalRender=render;
      render=function(){
        const result=originalRender.apply(this,arguments);
        setTimeout(ensureDeleteButtons,0);
        return result;
      };

      const style=document.createElement("style");
      style.id="history-v17-style";
      style.textContent=`
        .history-delete-v17{
          width:100%;
          margin-top:12px;
          background:#b83b3b!important;
          color:#fff!important;
          border-color:#b83b3b!important;
          display:block!important;
          visibility:visible!important;
          opacity:1!important;
        }
      `;
      document.head.appendChild(style);

      ensureDeleteButtons();
      window.__scorekeeperVersion="v17";
    };
    wait();
  };
  s.onerror=function(){console.error("Could not load Scorekeeper v16");};
  document.head.appendChild(s);
})();