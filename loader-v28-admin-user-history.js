/*
 Scorekeeper V28
 Finished admin user details + login tracking + ongoing game history.
 Additive override layer. Existing scoring rules are untouched.
*/
(function () {
  "use strict";

  const wait = () => {
    if (
      typeof state === "undefined" ||
      typeof sb === "undefined" ||
      typeof renderSettings !== "function" ||
      typeof renderGame !== "function" ||
      typeof historyGame !== "function"
    ) {
      setTimeout(wait, 80);
      return;
    }

    const isAdmin = () => state.profile?.is_admin === true;

    const fmtDate = (value) => {
      if (!value) return "Never";
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleString();
    };

    const fmtShortDate = (value) => {
      if (!value) return "Unknown";
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? "Unknown" : d.toLocaleDateString();
    };

    const escLocal = (value) => {
      if (typeof esc === "function") return esc(value);
      return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
      }[c]));
    };

    const winnerFor = (game, rows) => {
      if (!game || game.status !== "completed" || !rows?.length) return null;
      const undercut = String(game.name || "").trim().toLowerCase() === "undercut";
      return [...rows].sort((a, b) =>
        undercut ? Number(a.score) - Number(b.score) : Number(b.score) - Number(a.score)
      )[0] || null;
    };

    async function recordLogin() {
      if (!state.session?.user?.id) return;
      try {
        const stamp = new Date().toISOString();
        const { error } = await sb.from("profiles")
          .update({ last_login_at: stamp })
          .eq("id", state.session.user.id);
        if (!error && state.profile) state.profile.last_login_at = stamp;
      } catch (_) {
        // Login tracking must never interrupt the app.
      }
    }

    async function loadAdminUsers() {
      if (!isAdmin()) return;
      const { data, error } = await sb
        .from("profiles")
        .select("id,username,created_at,is_admin,last_login_at")
        .order("created_at", { ascending: false });

      if (error) {
        toast(error.message);
        return;
      }

      const users = data || [];
      const root = document.querySelector("#adminUsers");
      if (!root) return;

      root.innerHTML = users.map(u => {
        const self = state.session?.user?.id === u.id;
        return `
          <button class="admin-user-row admin-user-click" onclick="openAdminUserDetails('${u.id}')">
            <div class="admin-user-avatar">${escLocal((u.username || "?").slice(0, 1).toUpperCase())}</div>
            <div class="admin-user-info">
              <b>${escLocal(u.username || "Unknown")}</b>
              <small>Joined ${escLocal(fmtShortDate(u.created_at))}${self ? " · You" : ""}</small>
              <small>Last login: ${escLocal(fmtDate(u.last_login_at))}</small>
            </div>
            <span class="admin-role ${u.is_admin ? "on" : ""}">${u.is_admin ? "Admin" : "User"}</span>
          </button>`;
      }).join("") || '<p class="admin-empty">No registered users.</p>';

      const count = document.querySelector("#adminUserCount");
      if (count) {
        count.textContent = users.length + " registered user" + (users.length === 1 ? "" : "s");
      }
    }

    window.toggleAdminUser = async function (id, value) {
      if (!isAdmin()) return toast("Admin access required.");
      const self = state.session?.user?.id === id;
      if (self) return toast("You cannot change your own admin access here.");

      const { error } = await sb.from("profiles")
        .update({ is_admin: value })
        .eq("id", id);

      if (error) return toast(error.message);
      toast(value ? "Admin access granted" : "Admin access removed");
      loadAdminUsers();
    };

    window.openAdminPanel = async function () {
      if (!isAdmin()) return toast("Admin access required.");

      showModal(`
        <div class="admin-modal">
          <div class="row">
            <div>
              <h2>User Management</h2>
              <p id="adminUserCount" class="admin-subtitle">Loading...</p>
            </div>
            <button class="icon-btn" onclick="closeModal()">×</button>
          </div>
          <p class="admin-help">Tap a user to view their login, players, games, and activity.</p>
          <div id="adminUsers" class="admin-users"></div>
        </div>
      `);

      await loadAdminUsers();
    };

    window.openAdminUserDetails = async function (userId) {
      if (!isAdmin()) return toast("Admin access required.");

      showModal(`
        <div class="admin-detail-modal">
          <div class="row">
            <div>
              <h2>User details</h2>
              <p class="admin-subtitle">Loading...</p>
            </div>
            <button class="icon-btn" onclick="openAdminPanel()">×</button>
          </div>
          <div class="admin-loading">Loading user activity...</div>
        </div>
      `);

      const { data, error } = await sb.rpc("admin_user_details", {
        target_user_id: userId
      });

      if (error || !data) {
        toast(error?.message || "Could not load user details");
        return;
      }

      const profile = data.profile || {};
      const players = Array.isArray(data.players) ? data.players : [];
      const games = Array.isArray(data.games) ? data.games : [];
      const gamePlayers = Array.isArray(data.game_players) ? data.game_players : [];
      const changes = Array.isArray(data.score_changes) ? data.score_changes : [];

      const gameRows = games.map(game => {
        const rows = gamePlayers.filter(x => x.game_id === game.id);
        const winner = winnerFor(game, rows);
        const status = game.status === "completed" ? "Finished" : "Ongoing";
        const winnerText = winner
          ? ` · Winner: ${escLocal(winner.player_name || "Player")} · ${escLocal(winner.score)}`
          : "";
        return `
          <div class="admin-game-row">
            <div>
              <b>${escLocal(game.name || "Game")}</b>
              <small>${status} · Round ${escLocal(game.round ?? 1)}${winnerText}</small>
            </div>
            <span>${rows.length} players</span>
          </div>`;
      }).join("") || '<div class="admin-empty">No games yet.</div>';

      const playerRows = players.map(p => `
        <div class="admin-mini-row">
          <span class="admin-mini-avatar">${escLocal((p.name || "?").slice(0, 1).toUpperCase())}</span>
          <div><b>${escLocal(p.name || "Player")}</b><small>Added ${escLocal(fmtShortDate(p.created_at))}</small></div>
        </div>
      `).join("") || '<div class="admin-empty">No players added yet.</div>';

      const completed = games.filter(g => g.status === "completed").length;
      const ongoing = games.filter(g => g.status !== "completed").length;
      const rounds = new Set(changes.map(x => `${x.game_id}:${x.round}`)).size;

      const root = document.querySelector(".admin-detail-modal");
      if (!root) return;

      root.innerHTML = `
        <div class="row">
          <div>
            <h2>${escLocal(profile.username || "User")}</h2>
            <p class="admin-subtitle">Joined ${escLocal(fmtShortDate(profile.created_at))}</p>
          </div>
          <button class="icon-btn" onclick="openAdminPanel()">×</button>
        </div>

        <div class="admin-stat-grid">
          <div class="admin-stat"><b>${escLocal(fmtDate(profile.last_login_at))}</b><small>Last login</small></div>
          <div class="admin-stat"><b>${players.length}</b><small>Players added</small></div>
          <div class="admin-stat"><b>${games.length}</b><small>Games played</small></div>
          <div class="admin-stat"><b>${rounds}</b><small>Rounds recorded</small></div>
        </div>

        <div class="admin-detail-section">
          <div class="admin-detail-title">Players added</div>
          <div class="admin-mini-list">${playerRows}</div>
        </div>

        <div class="admin-detail-section">
          <div class="admin-detail-title">Games</div>
          <div class="admin-game-list">${gameRows}</div>
          <div class="admin-game-summary">${completed} finished · ${ongoing} ongoing · ${changes.length} score changes</div>
        </div>

        <button class="btn primary" style="width:100%;margin-top:16px" onclick="openAdminPanel()">Back to users</button>
      `;
    };

    const originalRenderSettings = renderSettings;
    renderSettings = function () {
      const result = originalRenderSettings.apply(this, arguments);
      setTimeout(async () => {
        if (!isAdmin()) return;
        const content = document.querySelector("#content");
        if (!content || content.querySelector("#adminSettingsCard")) return;

        const card = document.createElement("div");
        card.id = "adminSettingsCard";
        card.className = "stack";
        card.innerHTML = `
          <div class="section-title">Administration</div>
          <button class="card admin-settings-card" onclick="openAdminPanel()">
            <span class="admin-shield">♟</span>
            <span><b>User management</b><small>View users, login activity, players and games</small></span>
            <span class="preset-arrow">›</span>
          </button>`;
        content.appendChild(card);
      }, 0);
      return result;
    };

    /*
      Ongoing game history:
      - Shows every recorded round.
      - Never calculates or displays a winner while the game is ongoing.
      - Only completed games show a winner.
    */
    window.showGameRoundHistoryV28 = function (game, history, gamePlayers) {
      const finished = game?.status === "completed";
      const byRound = {};

      (history || []).forEach(x => {
        const round = Number(x.round || 1);
        (byRound[round] ||= []).push(x);
      });

      const rounds = Object.keys(byRound)
        .map(Number)
        .sort((a, b) => b - a);

      const roundHtml = rounds.length
        ? rounds.map(round => {
            const rows = byRound[round]
              .slice()
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            const totals = {};
            rows.forEach(x => {
              totals[x.player_id] = (totals[x.player_id] || 0) + Number(x.delta || 0);
            });

            return `
              <div class="admin-round-card">
                <div class="admin-round-head">
                  <b>Round ${round}</b>
                  <span>${rows.length} score change${rows.length === 1 ? "" : "s"}</span>
                </div>
                <div class="admin-round-rows">
                  ${Object.entries(totals).map(([pid, delta]) => {
                    const item = gamePlayers.find(gp => gp.player_id === pid);
                    return `<div class="admin-round-row">
                      <span>${escLocal(item?.players?.name || rows.find(x => x.player_id === pid)?.players?.name || "Player")}</span>
                      <b class="${delta >= 0 ? "round-positive" : "round-negative"}">${delta >= 0 ? "+" : ""}${delta}</b>
                    </div>`;
                  }).join("")}
                </div>
              </div>`;
          }).join("")
        : '<div class="admin-empty">No rounds have been recorded yet.</div>';

      let winnerHtml = "";
      if (finished) {
        const winner = winnerFor(game, gamePlayers);
        if (winner) {
          const uc = String(game.name || "").trim().toLowerCase() === "undercut";
          winnerHtml = `
            <div class="winner-inline">
              🏆 <b>Winner: ${escLocal(winner.players?.name || winner.player_name || "Player")} · ${escLocal(winner.score)} points</b>
              <small>${uc ? "Lowest score wins in UnderCut." : "Highest score wins."}</small>
            </div>`;
        }
      }

      showModal(`
        <div class="history-v28">
          <div class="row">
            <div>
              <h2>${escLocal(game.name || "Game")} History</h2>
              <p class="admin-subtitle">${finished ? "Finished game" : "Ongoing game · no winner yet"} · Round ${escLocal(game.round ?? 1)}</p>
            </div>
            <button class="icon-btn" onclick="closeModal()">×</button>
          </div>
          ${winnerHtml}
          <div class="history-round-list">${roundHtml}</div>
          <div class="actions" style="margin-top:14px">
            <button class="btn" onclick="closeModal()">Close</button>
          </div>
        </div>
      `);
    };

    const originalHistoryGame = historyGame;
    historyGame = async function (id) {
      const g =
        state.games.find(x => x.id === id) ||
        state.completedGames.find(x => x.id === id) ||
        (state.game?.id === id ? state.game : null);

      if (!g) return;

      const [historyResult, playersResult] = await Promise.all([
        sb.from("score_changes").select("*, players(name)").eq("game_id", id).order("created_at", { ascending: false }),
        sb.from("game_players").select("*, players(*)").eq("game_id", id).order("player_order")
      ]);

      if (historyResult.error || playersResult.error) {
        toast(historyResult.error?.message || playersResult.error?.message || "Could not load game history");
        return;
      }

      closeModal();
      showGameRoundHistoryV28(g, historyResult.data || [], playersResult.data || []);
    };

    /*
      Add a compact round-history section directly to an open game.
      The existing score controls and scoring functions remain unchanged.
    */
    const originalRenderGame = renderGame;
    renderGame = function () {
      originalRenderGame.apply(this, arguments);

      setTimeout(() => {
        if (!state.game) return;

        const content = document.querySelector("#content");
        if (!content || content.querySelector("#roundHistoryV28")) return;

        const history = Array.isArray(state.history) ? state.history : [];
        const rounds = [...new Set(history.map(x => Number(x.round || 1)))].sort((a, b) => b - a);
        if (!rounds.length) return;

        const section = document.createElement("div");
        section.id = "roundHistoryV28";
        section.className = "round-history-v28";
        section.innerHTML = `
          <div class="section-title">Round history</div>
          <button class="card round-history-button" onclick="historyGame('${state.game.id}')">
            <span>
              <b>${rounds.length} round${rounds.length === 1 ? "" : "s"} recorded</b>
              <small>View every round and score change</small>
            </span>
            <span class="chevron">›</span>
          </button>`;
        const addPlayer = content.querySelector(".add-player-game");
        if (addPlayer) addPlayer.before(section);
        else content.appendChild(section);
      }, 0);
    };

    const style = document.createElement("style");
    style.textContent = `
      .admin-settings-card{width:100%;display:grid;grid-template-columns:48px minmax(0,1fr) auto;gap:14px;align-items:center;text-align:left;padding:15px 16px!important}
      .admin-shield{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:rgba(78,136,237,.12);color:#78a9e8;font-size:22px}
      .admin-settings-card b,.admin-settings-card small{display:block}
      .admin-settings-card small{margin-top:3px;color:#8fa4c3}
      .admin-modal,.admin-detail-modal,.history-v28{max-height:75vh;overflow:auto}
      .admin-subtitle{margin:2px 0 0;color:#8fa4c3;font-size:13px}
      .admin-help{color:#8fa4c3;margin:12px 0 0}
      .admin-users{margin-top:18px;display:grid;gap:9px}
      .admin-user-row{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:11px;align-items:center;padding:11px;border:1px solid var(--line);border-radius:15px;background:var(--surface2)}
      button.admin-user-row{width:100%;color:inherit;text-align:left;font:inherit;cursor:pointer}
      .admin-user-row:active{transform:scale(.99)}
      .admin-user-avatar{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:rgba(78,136,237,.12);color:#78a9e8;font-weight:800;font-size:18px}
      .admin-user-info{min-width:0}
      .admin-user-info b,.admin-user-info small{display:block}
      .admin-user-info small{color:#8fa4c3;margin-top:3px;font-size:12px}
      .admin-role{border:1px solid var(--line);border-radius:999px;padding:7px 11px;background:transparent;color:#8fa4c3;font-weight:700;white-space:nowrap}
      .admin-role.on{color:#4e88ed;border-color:#4e88ed;background:rgba(78,136,237,.1)}
      .admin-detail-modal{padding-bottom:2px}
      .admin-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:16px}
      .admin-stat{padding:13px;border:1px solid var(--line);border-radius:15px;background:var(--surface2)}
      .admin-stat b,.admin-stat small{display:block}
      .admin-stat b{font-size:14px;line-height:1.25}
      .admin-stat small{margin-top:5px;color:#8fa4c3;font-size:12px}
      .admin-detail-section{margin-top:20px}
      .admin-detail-title{font-weight:800;font-size:16px;margin-bottom:9px}
      .admin-mini-list,.admin-game-list{display:grid;gap:8px}
      .admin-mini-row,.admin-game-row{display:flex;align-items:center;gap:10px;padding:10px 11px;border:1px solid var(--line);border-radius:14px;background:var(--surface2)}
      .admin-mini-row>div{min-width:0}
      .admin-mini-row b,.admin-mini-row small,.admin-game-row b,.admin-game-row small{display:block}
      .admin-mini-row small,.admin-game-row small{color:#8fa4c3;margin-top:3px;font-size:12px}
      .admin-mini-avatar{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:rgba(78,136,237,.12);color:#78a9e8;font-weight:800}
      .admin-game-row{justify-content:space-between}
      .admin-game-row>div{min-width:0}
      .admin-game-row>span{color:#8fa4c3;font-size:12px;white-space:nowrap}
      .admin-game-summary{margin-top:8px;color:#8fa4c3;font-size:12px}
      .admin-loading,.admin-empty{text-align:center;color:#8fa4c3;padding:25px}
      .round-history-v28{margin-top:16px}
      .round-history-button{width:100%;display:flex;justify-content:space-between;align-items:center;text-align:left}
      .round-history-button b,.round-history-button small{display:block}
      .round-history-button small{color:#8fa4c3;margin-top:4px}
      .history-round-list{display:grid;gap:9px;margin-top:15px}
      .admin-round-card{border:1px solid var(--line);border-radius:15px;background:var(--surface2);padding:12px}
      .admin-round-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:8px}
      .admin-round-head span{color:#8fa4c3;font-size:12px}
      .admin-round-rows{display:grid;gap:5px}
      .admin-round-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid var(--line)}
      .admin-round-row:first-child{border-top:0}
      .round-positive{color:#7fc59a}.round-negative{color:#e08a8a}
    `;
    document.head.appendChild(style);

    window.__scorekeeperVersion = "v28-admin-user-history";

    recordLogin();

    // If the admin panel is already open after a hot refresh, refresh its list.
    if (document.querySelector("#adminUsers")) loadAdminUsers();
  };

  wait();
})();
