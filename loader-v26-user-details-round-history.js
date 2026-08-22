/*
 Scorekeeper V26.1 additive admin/history enhancement.
 This file is intentionally isolated from existing game/scoring logic.
 It only adds optional UI helpers when the corresponding existing elements
 are present. It does not replace or modify existing game rules.
*/
(function () {
  "use strict";

  window.ScorekeeperV26 = {
    version: "26.1",
    isFinishedGame: function (game) {
      return !!(game && (
        game.finished === true ||
        game.status === "finished" ||
        game.status === "completed" ||
        game.ended_at
      ));
    },

    winnerForHistory: function (game) {
      if (!this.isFinishedGame(game)) return null;
      return game.winner || game.winner_name || null;
    },

    roundsForHistory: function (game) {
      if (!game) return [];
      return Array.isArray(game.rounds) ? game.rounds : [];
    }
  };

  // Do not alter the existing app until its own DOM is ready.
  function markOngoingHistory() {
    document.querySelectorAll("[data-game-status]").forEach(function (el) {
      if (el.dataset.gameStatus !== "ongoing") return;
      el.querySelectorAll(".winner, [data-winner], .winner-label").forEach(function (winner) {
        winner.hidden = true;
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", markOngoingHistory);
  } else {
    markOngoingHistory();
  }
  window.addEventListener("load", markOngoingHistory);
})();
