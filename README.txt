SCOREKEEPER CLASSIC V3

Upload all files to the root of your GitHub score repository.

The app uses the Supabase project configured in config.js.
The existing database schema remains compatible. No new SQL is required for this update.

New in V3:
- Four built-in game types: UnderCut, Lavaa, Dingu, Hukun kaalaa.
- UnderCut scoring system is active.
- Tap a player to open the classic scoring panel.
- UnderCut button awards the configured amount, default +60.
- UnderCut asks who has the lowest and allows multiple players to be selected.
- Selected lowest players receive the configured deduction, default -10 each.
- UnderCut points can be changed in Settings.
- Lavaa, Dingu and Hukun kaalaa are game slots for later scoring rules.
- Existing history, player history, sorting, deletion, light/dark mode and winner screen remain.


V3.1 fixes:
- Each player shows the previous round's total score under their name.
- Score entry applies immediately with + or - and no Add Score button.
- Any whole number can be entered. The sign is controlled by the + or - button.
- UnderCut winners are ranked from lowest total score to highest.
