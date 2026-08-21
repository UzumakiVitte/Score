(function(){
  function setup(){
    const btn=document.getElementById("scoreRefreshBtn");
    if(!btn || btn.dataset.ready) return;
    btn.dataset.ready="1";
    btn.onclick=function(){
      btn.classList.add("refreshing");
      location.reload();
    };

    try{
      const key="score_undercut_settings";
      const saved=localStorage.getItem(key);
      if(!saved && typeof state!=="undefined"){
        state.undercutSettings={
          ...(state.undercutSettings||{}),
          undercutPenalty:5
        };
        localStorage.setItem(key,JSON.stringify(state.undercutSettings));
      }
    }catch(e){}
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",setup);
  else setup();
  setTimeout(setup,250);
  setTimeout(setup,1000);
})();