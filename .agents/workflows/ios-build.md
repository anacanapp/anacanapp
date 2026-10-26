---
description: Pull latest from GitHub, build the web app, sync iOS, and open Xcode.
---

// turbo-all

1. Pull the latest code from GitHub
   `git pull --rebase --autostash`
2. Run install, build and sync capacitor
   `npm install && npm run build && npx cap sync ios && npx cap open ios`
