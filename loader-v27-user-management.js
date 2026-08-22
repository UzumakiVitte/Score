/*
 Scorekeeper V27 User Management + Ongoing History
 Additive integration layer. Existing game scoring is untouched.
*/
(function () {
  "use strict";

  const V = "27.0";

  function getSupabase() {
    try {
      return window.supabaseClient || window._supabase || window.supabase || null;
    } catch (_) {
      return null;
    }
  }

  async function recordLastLogin() {
    const client = getSupabase();
    if (!client || !client.auth || !client.auth.getUser) return;
    try {
      const { data } = await client.auth.getUser();
      const user = data && data.user;
      if (!user) return;

      if (client.from) {
        await client.from("profiles")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    } catch (_) {
      // Login tracking must never break the app.
    }
  }

  function formatDate(value) {
    if (!value) return "Never";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleString();
  }

  function isFinished(game) {
    return !!(game && (
      game.finished === true ||
      game.status === "finished" ||
      game.status === "completed" ||
      game.ended_at ||
      game.finished_at
    ));
  }

  function ongoingWinner(game) {
    return isFinished(game) ? (game.winner || game.winner_name || null) : null;
  }

  /*
   Public helpers for the existing admin/history UI.
   They do not replace the app's existing game rendering.
  */
  window.ScorekeeperV27 = {
    version: V,
    formatDate,
    isFinished,
    winnerForHistory: ongoingWinner,
    roundsForHistory: function (game) {
      return game && Array.isArray(game.rounds) ? game.rounds : [];
    },

    loadUserDetails: async function (userId) {
      const client = getSupabase();
      if (!client || !userId) return null;

      const result = {
        lastLogin: null,
        players: [],
        games: []
      };

      try {
        const profile = await client.from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (profile.data) result.lastLogin = profile.data.last_login_at || null;
      } catch (_) {}

      // Discover common player/game tables without breaking if a project uses
      // different names. Existing data is read-only here.
      const playerTables = ["players", "game_players"];
      for (const table of playerTables) {
        try {
          const r = await client.from(table).select("*").eq("user_id", userId);
          if (!r.error && Array.isArray(r.data)) {
            result.players = result.players.concat(r.data);
            break;
          }
        } catch (_) {}
      }

      const gameTables = ["games", "game_sessions", "game_history"];
      for (const table of gameTables) {
        try {
          const r = await client.from(table).select("*").eq("user_id", userId);
          if (!r.error && Array.isArray(r.data)) {
            result.games = r.data;
            break;
          }
        } catch (_) {}
      }

      return result;
    }
  };

  /*
   Hide winner elements for explicitly ongoing game history cards.
   This is intentionally conservative. It only acts on elements that already
   identify themselves as ongoing, and never touches score calculations.
  */
  function protectOngoingWinnerUI() {
    document.querySelectorAll('[data-game-status="ongoing"]').forEach(function (card) {
      card.querySelectorAll("[data-winner], .winner, .winner-label").forEach(function (el) {
        el.hidden = true;
      });
    });
  }

  function boot() {
    recordLastLogin();
    protectOngoingWinnerUI();

    const observer = new MutationObserver(function () {
      protectOngoingWinnerUI();
    });
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
