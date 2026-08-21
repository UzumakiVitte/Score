(function(){
  const s = document.createElement("script");
  s.src = "loader-v17-delete-history.js?19";

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

      function patchGameIcons() {
        const root = document.querySelector("#content");
        if (!root) return;

        root.querySelectorAll(".game-icon").forEach(el => {
          const card =
            el.closest(".card") ||
            el.closest("button") ||
            el.parentElement;

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

          if (img.src !== new URL(src, document.baseURI).href) {
            img.src = src;
          }

          el.setAttribute("aria-label", key);
        });

        root.querySelectorAll(".preset-icon").forEach(el => {
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

          if (img.src !== new URL(src, document.baseURI).href) {
            img.src = src;
          }
        });
      }

      const style = document.createElement("style");
      style.id = "scorekeeper-game-icons-v19";
      style.textContent = `
        .game-icon,
        .preset-icon {
          width: 64px !important;
          height: 64px !important;
          min-width: 64px !important;
          min-height: 64px !important;
          padding: 0 !important;
          overflow: hidden !important;
          border-radius: 16px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }

        .scorekeeper-game-icon {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          object-fit: cover !important;
          border-radius: 16px !important;
        }

        .preset-icon .scorekeeper-game-icon {
          width: 64px !important;
          height: 64px !important;
        }
      `;

      const oldStyle = document.getElementById("scorekeeper-game-icons-v19");
      if (!oldStyle) document.head.appendChild(style);

      const originalRender = render;

      render = function(){
        const result = originalRender.apply(this, arguments);

        setTimeout(patchGameIcons, 0);
        setTimeout(patchGameIcons, 100);
        setTimeout(patchGameIcons, 300);

        return result;
      };

      const content = document.querySelector("#content");

      if (content) {
        const observer = new MutationObserver(() => {
          if (
            typeof state !== "undefined" &&
            (state.tab === "games" || state.tab === "history")
          ) {
            patchGameIcons();
          }
        });

        observer.observe(content, {
          childList: true,
          subtree: true
        });
      }

      patchGameIcons();

      window.__scorekeeperVersion = "v19-icons";
    };

    wait();
  };

  s.onerror = function(){
    console.error("Could not load loader-v17-delete-history.js");
  };

  document.head.appendChild(s);
})();
