(function(){
  const s=document.createElement("script");
  s.src="loader-v17-delete-history.js?18";
  s.onload=function(){
    const wait=()=>{
      if(typeof state==="undefined" || typeof render!=="function"){
        setTimeout(wait,50);
        return;
      }

      const iconMap={
        "undercut":"icons/undercut-icon.png",
        "lavaa":"icons/lavaa-icon.png",
        "dingu":"icons/dingu-icon.png",
        "hukun kaalaa":"icons/hukun-kaalaa-icon.png",
        "custom":"icons/custom-icon.png"
      };

      function patchGameIcons(){
        const root=document.querySelector("#content");
        if(!root) return;

        root.querySelectorAll(".game-icon").forEach(el=>{
          const card=el.closest(".card") || el.closest("button") || el.parentElement;
          if(!card) return;

          const text=(card.textContent||"").trim().toLowerCase();
          let key=null;

          for(const name of Object.keys(iconMap)){
            if(text.includes(name)){
              key=name;
              break;
            }
          }

          if(!key) return;

          const src=iconMap[key];
          let img=el.querySelector("img.scorekeeper-game-icon");

          if(!img){
            el.textContent="";
            img=document.createElement("img");
            img.className="scorekeeper-game-icon";
            img.alt=key;
            el.appendChild(img);
          }

          if(img.getAttribute("src")!==src) img.src=src;
          el.setAttribute("aria-label",key);
        });
      }

      const style=document.createElement("style");
      style.id="scorekeeper-game-icons-v18";
      style.textContent=`
        .game-icon{
          width:64px!important;
          height:64px!important;
          min-width:64px!important;
          min-height:64px!important;
          padding:0!important;
          overflow:hidden!important;
          border-radius:16px!important;
          display:flex!important;
          align-items:center!important;
          justify-content:center!important;
        }
        .scorekeeper-game-icon{
          width:100%!important;
          height:100%!important;
          display:block!important;
          object-fit:cover!important;
          border-radius:16px!important;
        }
      `;
      document.head.appendChild(style);

      const originalRender=render;
      render=function(){
        const result=originalRender.apply(this,arguments);
        setTimeout(patchGameIcons,0);
        setTimeout(patchGameIcons,150);
        return result;
      };

      const observer=new MutationObserver(()=>{
        if(state.tab==="games" || state.tab==="history"){
          patchGameIcons();
        }
      });
      observer.observe(document.querySelector("#content")||document.body,{childList:true,subtree:true});

      patchGameIcons();
      window.__scorekeeperVersion="v18-icons";
    };
    wait();
  };
  s.onerror=function(){console.error("Could not load Scorekeeper v17");};
  document.head.appendChild(s);
})();
