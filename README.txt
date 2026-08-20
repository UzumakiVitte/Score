SCOREKEEPER PRIVATE ACCOUNTS

1. Upload the app files to GitHub.
2. Run schema.sql in Supabase SQL Editor.
3. In Supabase Dashboard, go to Authentication > Providers > Email and turn OFF Confirm email.
4. Open the app and create an account using a username and password.

USERNAME LOGIN
The app displays username + password only. Supabase Auth internally uses a synthetic email address derived from the username. Users never need to enter an email in the app.

PRIVACY
Each account has its own games, players, scores and history. Row Level Security prevents one account from reading or changing another account's data.

LEGACY DATA
Games created before private accounts have NULL owner_id and are hidden after schema.sql is applied. If you need to keep them, edit claim_legacy_data.sql, replace YOUR_USERNAME with your account username, and run it once in Supabase SQL Editor.

CURRENT GAME FEATURES
- UnderCut scoring
- UnderCut settings
- Round Winner deduction
- Automatic round advance when every player has recorded a score
- Previous round and current round scores shown on player cards
- Finished games become read-only
- Finished games move to History
- Add existing or new players to an ongoing game
- Player photos, emojis and built-in avatars
