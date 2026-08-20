Scorekeeper v15 Hukun kaalaa update

Files:
- loader-v15.js
- index.html

Upload loader-v15.js to the repository.
Replace the existing index.html with this index.html.

Hukun kaalaa:
- Supports any number of players already supported by the app.
- Each round starts with guesses.
- Each player enters a guess.
- After all guesses are entered, each player gets ✓ and ✕.
- ✓ awards guess × 100.
- ✕ deducts guess × 100.
- The app automatically starts the next round after every player is marked.
- The game can be finished manually.
- Highest final score wins.

The Hukun round data is stored in this browser's local storage so a refresh does not lose the current round's guesses/results. The existing game scores remain in Supabase.
