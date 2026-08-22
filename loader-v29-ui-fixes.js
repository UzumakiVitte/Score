/*
 Scorekeeper V30 UI fix
 Safe additive patch for the existing V29 build.

 Fixes:
 1. Player selection rows: player name on the left, checkbox on the right.
 2. Keeps all player rows aligned and evenly spaced.
 3. Removes "Or use your own picture" text from Add/Edit Player.
 4. Makes the UnderCut default lowest-player deduction 5.
 5. Does not change any game scoring rules.
*/
(function(){
  "use strict";

  const SETTINGS_MIGRATION = "scorekeeper_undercut_default_v30";

  function fixUndercutDefault(){
    try{
      if(typeof state === "undefined") return;

      if(localStorage.getItem(SETTINGS_MIGRATION) !== "1"){
        let saved = {};
        try{
          saved = JSON.parse(localStorage.getItem("score_undercut_settings") || "{}");
        }catch(_){ saved = {}; }

        /*
         The previous app default was 10. Convert that old default to 5 once.
         If the user already had another value saved, leave it alone.
        */
        if(!Object.prototype.hasOwnProperty.call(saved, "undercutPenalty") ||
           Number(saved.undercutPenalty) === 10){
          saved.undercutPenalty = 5;
          localStorage.setItem("score_undercut_settings", JSON.stringify(saved));
          state.undercutSettings = {
            ...(state.undercutSettings || {}),
            undercutPenalty: 5
          };
        }

        localStorage.setItem(SETTINGS_MIGRATION, "1");

        if(state.tab === "settings" && typeof render === "function"){
          setTimeout(()=>render(), 0);
        }
      }
    }catch(_){}
  }

  function fixPlayerSelection(root){
    const host = root || document;

    host.querySelectorAll("#playerChoices .choice-row, #customPlayerChoices .choice-row, .choice-list .choice-row").forEach(row=>{
      const inner = row.querySelector(":scope > .row");

      /*
       Current app structure:
       label.choice-row
         span.row
           input[type=checkbox]
           player name text

       Use CSS grid so the anonymous player-name text occupies column 1
       and the checkbox occupies column 2.
      */
      if(inner && inner.querySelector('input[type="checkbox"]')){
        const input = inner.querySelector('input[type="checkbox"]');

        inner.style.display = "grid";
        inner.style.gridTemplateColumns = "minmax(0, 1fr) 26px";
        inner.style.alignItems = "center";
        inner.style.width = "100%";
        inner.style.minWidth = "0";
        inner.style.gap = "14px";
        inner.style.justifyContent = "initial";

        input.style.gridColumn = "2";
        input.style.gridRow = "1";
        input.style.width = "24px";
        input.style.height = "24px";
        input.style.minWidth = "24px";
        input.style.margin = "0";
        input.style.justifySelf = "end";
        input.style.accentColor = "var(--accent)";
        input.style.flex = "none";

        row.style.display = "block";
        row.style.width = "100%";
        row.style.minHeight = "78px";
        row.style.boxSizing = "border-box";
        row.style.padding = "18px 20px";
      }

      /*
       Older/custom editor structure with direct children.
       Keep the name left and checkbox right if encountered.
      */
      const directInput = row.matches("label") ? row.querySelector(':scope > input[type="checkbox"]') : null;
      if(directInput){
        const name = row.querySelector(":scope > b");
        const avatar = row.querySelector(":scope > span");

        row.style.display = "grid";
        row.style.gridTemplateColumns = "minmax(0, 1fr) 26px";
        row.style.alignItems = "center";
        row.style.columnGap = "14px";
        row.style.width = "100%";
        row.style.minHeight = "78px";
        row.style.padding = "18px 20px";
        row.style.boxSizing = "border-box";

        if(name){
          name.style.gridColumn = "1";
          name.style.gridRow = "1";
          name.style.minWidth = "0";
        }
        if(avatar){
          avatar.style.gridColumn = "1";
          avatar.style.gridRow = "1";
        }

        directInput.style.gridColumn = "2";
        directInput.style.gridRow = "1";
        directInput.style.width = "24px";
        directInput.style.height = "24px";
        directInput.style.margin = "0";
        directInput.style.justifySelf = "end";
        directInput.style.accentColor = "var(--accent)";
      }
    });
  }

  function removeOwnPictureLabel(root){
    const host = root || document;

    [...host.querySelectorAll(".avatar-section-title")].forEach(el=>{
      const text = (el.textContent || "").replace(/\s+/g," ").trim().toLowerCase();
      if(text === "or use your own picture"){
        el.remove();
      }
    });

    /*
     Fallback for versions where the section title class differs.
    */
    [...host.querySelectorAll("*")].forEach(el=>{
      if(el.children.length !== 0) return;
      const text = (el.textContent || "").replace(/\s+/g," ").trim().toLowerCase();
      if(text === "or use your own picture"){
        el.remove();
      }
    });
  }

  function addStyles(){
    if(document.getElementById("scorekeeper-v30-ui-fixes")) return;

    const style = document.createElement("style");
    style.id = "scorekeeper-v30-ui-fixes";
    style.textContent = `
      #playerChoices .choice-row,
      #customPlayerChoices .choice-row,
      .choice-list .choice-row{
        width:100% !important;
        box-sizing:border-box !important;
      }

      #playerChoices .choice-row > .row,
      #customPlayerChoices .choice-row > .row,
      .choice-list .choice-row > .row{
        display:grid !important;
        grid-template-columns:minmax(0,1fr) 26px !important;
        align-items:center !important;
        width:100% !important;
        min-width:0 !important;
        gap:14px !important;
        justify-content:initial !important;
      }

      #playerChoices .choice-row > .row input[type="checkbox"],
      #customPlayerChoices .choice-row > .row input[type="checkbox"],
      .choice-list .choice-row > .row input[type="checkbox"]{
        grid-column:2 !important;
        grid-row:1 !important;
        width:24px !important;
        height:24px !important;
        min-width:24px !important;
        margin:0 !important;
        justify-self:end !important;
        accent-color:var(--accent) !important;
      }

      #playerChoices .choice-row,
      #customPlayerChoices .choice-row,
      .choice-list .choice-row{
        min-height:78px !important;
        padding:18px 20px !important;
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
    fixPlayerSelection(document);
    removeOwnPictureLabel(document);
    fixUndercutDefault();
  }

  function wrapFunction(name){
    try{
      if(typeof window[name] !== "function" || window[name]["__v30Wrapped"]) return;

      const base = window[name];

      function wrapped(){
        const result = base.apply(this, arguments);

        setTimeout(patch, 0);
        setTimeout(patch, 80);
        setTimeout(patch, 250);

        return result;
      }

      wrapped.__v30Wrapped = true;
      window[name] = wrapped;
    }catch(_){}
  }

  function boot(){
    addStyles();

    wrapFunction("render");
    wrapFunction("newGame");
    wrapFunction("customNewGame");
    wrapFunction("showPlayerEditor");

    patch();

    const modal = document.getElementById("modalRoot");
    if(modal && !modal.__scorekeeperV30Observer){
      const observer = new MutationObserver(()=>{
        fixPlayerSelection(modal);
        removeOwnPictureLabel(modal);
      });
      observer.observe(modal,{childList:true,subtree:true});
      modal.__scorekeeperV30Observer = true;
    }
  }

  function waitForApp(){
    if(typeof state === "undefined" || typeof render !== "function"){
      setTimeout(waitForApp,80);
      return;
    }

    boot();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded",waitForApp);
  }else{
    waitForApp();
  }

  setTimeout(boot,500);
  setTimeout(boot,1500);
  setTimeout(boot,3000);

  window.__scorekeeperVersion = "v30-player-selection-fix";
})();
