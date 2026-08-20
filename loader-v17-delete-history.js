(function(){
  const s=document.createElement("script");
  s.src="loader-v16.js?20";
  s.onload=function(){
    const wait=()=>{
      if(typeof state==="undefined" || typeof render!=="function" || typeof deleteHistoryGameV16!=="function"){
        setTimeout(wait,50);
        return;
      }

      const addDeleteButtons=()=>{
        if(state.tab!=="history") return;

        const content=document.querySelector("#content");
        if(!content) return;

        const triggers=[...content.querySelectorAll("[onclick]")].filter(el=>{
          const value=el.getAttribute("onclick")||"";
          return value.includes("historyGame(");
        });

        triggers.forEach(trigger=>{
          const onclick=trigger.getAttribute("onclick")||"";
          const match=onclick.match(/historyGame\(['"]([^'"]+)['"]\)/);
          if(!match) return;

          const id=match[1];
          let card=trigger.closest(".history-card") || trigger.closest(".card");
          if(!card) card=trigger.parentElement;
          if(!card || card.querySelector(".history-delete-v18")) return;

          const btn=document.createElement("button");
          btn.className="btn danger history-delete-v18";
          btn.type="button";
          btn.textContent="Delete Game";
          btn.setAttribute("aria-label","Delete this game from history");
          btn.onclick=(e)=>{
            e.preventDefault();
            e.stopPropagation();
            deleteHistoryGameV16(id);
          };

          card.appendChild(btn);
        });
      };

      const originalRender=render;
      render=function(){
        const result=originalRender.apply(this,arguments);
        setTimeout(addDeleteButtons,0);
        return result;
      };

      const style=document.createElement("style");
      style.id="history-v18-style";
      style.textContent=`
        .history-delete-v18{
          width:100%!important;
          margin-top:12px!important;
          background:#b83b3b!important;
          color:#fff!important;
          border-color:#b83b3b!important;
          display:block!important;
          visibility:visible!important;
          opacity:1!important;
          position:relative!important;
          z-index:5!important;
        }
      `;
      document.head.appendChild(style);

      const observer=new MutationObserver(()=>{
        if(state.tab==="history") setTimeout(addDeleteButtons,0);
      });
      observer.observe(document.querySelector("#content")||document.body,{childList:true,subtree:true});

      addDeleteButtons();
      window.__scorekeeperVersion="v18";
    };
    wait();
  };
  s.onerror=function(){console.error("Could not load Scorekeeper v16");};
  document.head.appendChild(s);
})();
