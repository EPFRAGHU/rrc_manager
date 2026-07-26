# Agent Behavioral Rules & Guidelines for RRC Manager

## Automatic Version & Subversion Incrementing Rule (MANDATORY)

- On **EVERY SINGLE CODE CHANGE, EDIT, OR BUG FIX** made to the web application (`public/js/app.js`, `public/index.html`, `public/css/staradmin.css`, etc.):
  - You MUST automatically increment the version/subversion number (e.g. `v2.5.0` -> `v2.5.1` -> `v2.5.2` -> `v2.6.0`).
  - Update `const APP_VERSION = 'v2.5.x';` in `public/js/app.js`.
  - Update `#appVersionBadge` in `public/index.html`.
  - Update the script tag query parameter `<script src="js/app.js?v=2.5.x"></script>` in `public/index.html` to guarantee instant browser cache-busting.
  - DO NOT wait for the user to request a version bump. Do it automatically on every edit!
