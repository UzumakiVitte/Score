COMPLETE HOME SCREEN CACHE FIX

Upload/replace these 4 files in the ROOT of your Score repository:

1. index.html
2. manifest.json
3. loader-v24-refresh-undercut.js
4. loader-v25-cache-buster.js

Do not replace app.js, style-v4.css, loader-v22-avatars-nav.js, loader-v23-admin.js, config.js, game files, or icons.

This version:
- Keeps the new bottom navigation.
- Keeps the small refresh button.
- Keeps the UnderCut new default deduction of 5 for users with no saved setting.
- Adds cache-busting query versions to the app assets.
- Updates the manifest start URL.
- Clears old Cache Storage when the app version changes.
- Reloads once after detecting the new version.

After uploading:
1. Commit all 4 files.
2. Wait for GitHub Pages to publish.
3. Open the normal Safari website once and confirm the new UI appears.
4. Delete the old Home Screen Scorekeeper icon.
5. Add the site to Home Screen again.
