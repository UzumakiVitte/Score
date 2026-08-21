HOME SCREEN FORCE-NEW-URL FIX

This is different from the previous cache fix.

The Home Screen app can keep its installed start URL even after files at "/" are updated.
This package gives the Home Screen app a genuinely NEW start URL: home-v3.html.

UPLOAD/REPLACE:
1. Replace manifest.json with the included manifest.json.
2. Upload home-v3.html to the ROOT of the repository.

Do NOT replace app.js, style-v4.css, loader-v22-avatars-nav.js, loader-v23-admin.js,
loader-v24-refresh-undercut.js, config.js, or any game/icon files.

After GitHub Pages publishes:
1. Open the normal website and confirm it shows the new version.
2. Delete the old Scorekeeper Home Screen icon.
3. In Safari, open the normal Scorekeeper website.
4. Use Share > Add to Home Screen.
5. The newly installed Home Screen app will use home-v3.html as its start URL.
6. It redirects to the current index.html, so it will show the new navigation and refresh button.

Do not add the old shortcut again. This time the installed app's start URL is different.
