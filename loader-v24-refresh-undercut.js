(function(){
  function setup(){
    try {
      const key = "score_undercut_settings";
      if (!localStorage.getItem(key) && typeof state !== "undefined") {
        state.undercutSettings = {
          ...(state.undercutSettings || {}),
          undercutPenalty: 5
        };
        localStorage.setItem(key, JSON.stringify(state.undercutSettings));
      }
    } catch(e) {}

    const btn = document.getElementById("scoreRefreshBtn");
    if (btn && !btn.dataset.ready) {
      btn.dataset.ready = "1";
      btn.onclick = function(){
        btn.classList.add("refreshing");
        window.location.reload();
      };
    }
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }

  setTimeout(setup, 250);
  setTimeout(setup, 1000);
})();