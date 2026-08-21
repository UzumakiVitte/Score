(function(){
  const s = document.createElement("script");
  s.src = "loader-v17-delete-history.js?21";

  s.onload = function(){
    const wait = () => {
      if (typeof state === "undefined" || typeof render !== "function") {
        setTimeout(wait, 50);
        return;
      }

      const iconMap = {
        "undercut": "icons/undercut-icon.png",
        "lavaa": "icons/lavaa-icon.png",
        "dingu": "icons/dingu-icon.png",
        "hukun kaalaa": "icons/hukun-kaalaa-icon.png",
        "custom": "icons/custom-icon.png"
      };

      function getGameKey(text) {
        const value = String(text || "").trim().toLowerCase();
        if (value.includes("hukun kaalaa")) return "hukun kaalaa";
        if (value.includes("undercut")) return "undercut";
        if (value.includes("lavaa")) return "lavaa";
        if (value.includes("dingu")) return "dingu";
        if (value.includes("custom")) return "custom";
        return null;
      }

      function addStyles(){
        if (document.getElementById("scorekeeper-game-icons-v21")) return;

        const style = document.createElement("style");
        style.id = "scorekeeper-game-icons-v21";
        style.textContent = `
          .preset-card {
            grid-template-columns: 64px minmax(0, 1fr) auto !important;
            column-gap: 16px !important;
            align-items: center !important;
          }

          .preset-card .preset-icon {
            width: 64px !important;
            height: 64px !important;
            min-width: 64px !important;
            min-height: 64px !important;
            flex-shrink: 0 !important;
            overflow: hidden !important;
            padding: 0 !important;
            border-radius: 16px !important;
            display: grid !important;
            place-items: center !important;
          }

          .preset-card > span:nth-child(2) {
            min-width: 0 !important;
            overflow: hidden !important;
          }

          .preset-card > span:nth-child(2) b,
          .preset-card > span:nth-child(2) small {
            display: block !important;
            min-width: 0 !important;
            overflow-wrap: anywhere !important;
          }

          .preset-card .preset-arrow {
            flex-shrink: 0 !important;
          }

          .scorekeeper-game-icon {
            width: 100% !important;
            height: 100% !important;
            display: block !important;
            object-fit: cover !important;
            border-radius: 16px !important;
          }

          .game-card .game-icon {
            width: 64px !important;
            height: 64px !important;
            min-width: 64px !important;
            min-height: 64px !important;
            padding: 0 !important;
            overflow: hidden !important;
          }
        `;
        document.head.appendChild(style);
      }

      function patchIcons(){
        addStyles();

        const root = document.querySelector("#content");
        if (!root) return;

        root.querySelectorAll(".preset-card .preset-icon").forEach(el => {
          const card = el.closest(".preset-card");
          if (!card) return;

          const key = getGameKey(card.textContent);
          if (!key) return;

          const src = iconMap[key];
          let img = el.querySelector("img.scorekeeper-game-icon");

          if (!img) {
            el.textContent = "";
            img = document.createElement("img");
            img.className = "scorekeeper-game-icon";
            img.alt = key;
            img.loading = "lazy";
            el.appendChild(img);
          }

          img.src = src;
        });

        root.querySelectorAll(".game-icon").forEach(el => {
          const card = el.closest(".card") || el.closest("button") || el.parentElement;
          if (!card) return;

          const key = getGameKey(card.textContent);
          if (!key) return;

          const src = iconMap[key];
          let img = el.querySelector("img.scorekeeper-game-icon");

          if (!img) {
            el.textContent = "";
            img = document.createElement("img");
            img.className = "scorekeeper-game-icon";
            img.alt = key;
            img.loading = "lazy";
            el.appendChild(img);
          }

          img.src = src;
        });
      }

      addStyles();

      const originalRender = render;
      render = function(){
        const result = originalRender.apply(this, arguments);
        setTimeout(patchIcons, 0);
        setTimeout(patchIcons, 100);
        return result;
      };

      if (typeof renderGames === "function") {
        const originalRenderGames = renderGames;
        renderGames = function(){
          const result = originalRenderGames.apply(this, arguments);
          setTimeout(patchIcons, 0);
          setTimeout(patchIcons, 100);
          return result;
        };
      }

      if (typeof renderHistory === "function") {
        const originalRenderHistory = renderHistory;
        renderHistory = function(){
          const result = originalRenderHistory.apply(this, arguments);
          setTimeout(patchIcons, 0);
          setTimeout(patchIcons, 100);
          return result;
        };
      }

      const content = document.querySelector("#content");
      if (content) {
        const observer = new MutationObserver(() => patchIcons());
        observer.observe(content, {childList:true, subtree:true});
      }

      patchIcons();
      window.__scorekeeperVersion = "v21-icons";
    };

    wait();
  };

  s.onerror = function(){
    console.error("Could not load loader-v17-delete-history.js");
  };

  document.head.appendChild(s);
})();
