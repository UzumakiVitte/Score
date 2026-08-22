/*
 Scorekeeper V29 UI fixes
 1. UnderCut default lowest-player deduction becomes 5.
 2. Align player checkboxes in game creation.
 3. Remove "Or use your own picture" label while keeping the upload button.
 This is additive and does not change game scoring logic.
*/
(function(){
  "use strict";

  const MIGRATION_KEY = "scorekeeper_undercut_default_v29";

  function setUnderCutDefault(){
    try{
      if(typeof state === "undefined") return;

      // Migrate the old default of 10 to the new default of 5 once.
      // After migration, user changes are respected.
      if(localStorage.getItem(MIGRATION_KEY) !== "1"){
        let saved = {};
        try{
          saved = JSON.parse(localStorage.getItem("score_undercut_settings") || "{}");
        }catch(_){ saved = {}; }

        if(!Object.prototype.hasOwnProperty.call(saved, "undercutPenalty") ||
           Number(saved.undercutPenalty) === 10){
          saved.undercutPenalty = 5;
          if(!Object.prototype.hasOwnProperty.call(saved, "undercutAward")) saved.undercutAward = 60;
          if(!Object.prototype.hasOwnProperty.call(saved, "roundWinnerPenalty")) saved.roundWinnerPenalty = 10;
          localStorage.setItem("score_undercut_settings", JSON.stringify(saved));
        }

        state.undercutSettings = {
          ...(state.undercutSettings || {}),
          undercutPenalty: 5
        };

        localStorage.setItem(MIGRATION_KEY, "1");

        if(state.tab === "settings" && typeof render === "function"){
          setTimeout(()=>render(), 0);
        }
      }
    }catch(_){}
  }

  function alignGamePlayerChoices(root){
    const host = root || document;
    host.querySelectorAll(".choice-row").forEach(row=>{
      const input = row.querySelector('input[type="checkbox"]');
      if(!input) return;

      const inner = row.querySelector(":scope > .row");
      if(inner){
        inner.style.display = "flex";
        inner.style.width = "100%";
        inner.style.alignItems = "center";
        inner.style.justifyContent = "flex-start";
        inner.style.gap = "12px";
      }

      row.style.display = "flex";
      row.style.width = "100%";
      row.style.alignItems = "center";
      row.style.justifyContent = "space-between";
      row.style.gap = "12px";
      row.style.minHeight = "64px";
      row.style.boxSizing = "border-box";

      input.style.marginLeft = "auto";
      input.style.flex = "0 0 auto";
      input.style.width = "22px";
      input.style.height = "22px";
      input.style.accentColor = "var(--accent)";
    });
  }

  function removeOwnPictureLabel(root){
    const host = root || document;
    [...host.querySelectorAll(".avatar-section-title")].forEach(el=>{
      const text = (el.textContent || "").trim().toLowerCase();
      if(text === "or use your own picture"){
        el.remove();
      }
    });
  }

  function addStyles(){
    if(document.getElementById("scorekeeper-v29-ui-fixes")) return;

    const style = document.createElement("style");
    style.id = "scorekeeper-v29-ui-fixes";
    style.textContent = `
      .choice-row{
        display:flex !important;
        width:100% !important;
        align-items:center !important;
        justify-content:space-between !important;
        gap:12px !important;
        min-height:64px !important;
        box-sizing:border-box !important;
      }

      .choice-row > .row{
        display:flex !important;
        width:100% !important;
        align-items:center !important;
        justify-content:flex-start !important;
        gap:12px !important;
        min-width:0 !important;
      }

      .choice-row input[type="checkbox"]{
        width:22px !important;
        height:22px !important;
        min-width:22px !important;
        flex:0 0 22px !important;
        margin:0 2px 0 auto !important;
        accent-color:var(--accent) !important;
      }

      .avatar-section-title{
        color:var(--muted);
      }

      .avatar-upload{
        margin-top:0 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function patch(){
    addStyles();
    alignGamePlayerChoices(document);
    removeOwnPictureLabel(document);
    setUnderCutDefault();
  }

  function wrapPlayerEditor(){
    if(typeof showPlayerEditor !== "function" || showPlayerEditor.__v29Wrapped) return;

    const base = showPlayerEditor;
    function wrapped(existing){
      const result = base.apply(this, arguments);
      setTimeout(()=>removeOwnPictureLabel(document), 0);
      setTimeout(()=>removeOwnPictureLabel(document), 100);
      return result;
    }
    wrapped.__v29Wrapped = true;
    showPlayerEditor = wrapped;
  }

  function wrapRender(){
    if(typeof render !== "function" || render.__v29Wrapped) return;

    const base = render;
    function wrapped(){
      const result = base.apply(this, arguments);
      setTimeout(patch, 0);
      setTimeout(patch, 100);
      return result;
    }
    wrapped.__v29Wrapped = true;
    render = wrapped;
  }

  function boot(){
    addStyles();
    wrapPlayerEditor();
    wrapRender();
    patch();

    const modal = document.getElementById("modalRoot");
    if(modal && !modal.__v29Observer){
      const observer = new MutationObserver(()=>patch());
      observer.observe(modal, {childList:true, subtree:true});
      modal.__v29Observer = true;
    }
  }

  const wait = ()=>{
    if(typeof state === "undefined" || typeof render !== "function"){
      setTimeout(wait, 80);
      return;
    }
    boot();
  };

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", wait);
  }else{
    wait();
  }

  setTimeout(boot, 500);
  setTimeout(boot, 1500);

  window.__scorekeeperVersion = "v29-ui-fixes";
})();
