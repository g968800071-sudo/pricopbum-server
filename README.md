# PRICOPBUM

Tank combat from PRICOP.studio. This repository is the existing game: an authoritative WebSocket server (`server/server.js`, simulation in `src/sim`) and the playable browser client in `www/` (`index.html` + `game.js`). It is a landscape web game with on-screen touch controls. It is not a native App Store or Google Play build.

```bash
npm install
npm test          # lives, respawn, loot, armour, rank, mode isolation, match reconnect
npm run smoke     # boots the server, loads the page, starts a duel
npm start         # http://0.0.0.0:$PORT   (WebSocket /ws)
```

Real-money checkout is not connected. Mythic items, the premium battle pass and coin packs paid in euros do not charge and do not grant the item. Coins earned in battle still work. Legendary tank upgrades can be bought with those coins. When the client links an account, that spend is checked against the server ledger. Mythic upgrade requests are refused.

## Account ledger

`ACCOUNT_DB` (default `data/accounts.sqlite`) is a local SQLite file. It is not `localStorage`. Spendable coins, rank and legendary mods on that ledger come only from matches this server simulated. A device save is noted and then ignored: it cannot mint the balance. The device copy is not deleted.

On Render's ephemeral filesystem that file is lost on deploy, restart, or spin-down. It is durable only when `ACCOUNT_DB` points at a persistent disk and `ACCOUNT_DURABLE=1`. This repo does not attach a disk and does not write the production database. The public host does not have this ledger yet.

## Phone shell

`android/` and `ios/` are a Capacitor WebView wrapper around `www/`, not a native game renderer. See `MOBILE.md`. A debug APK can be built with the public Android SDK. No iPhone binary is produced here.

## What this build does not do

- The debug APK is a WebView shell, not a native renderer and not a Play Store build. No iPhone executable is produced here. A home-screen icon of the website is still the website.
- The debug APK's online default is `wss://pricopbum-server.onrender.com/ws`, the existing production host. It is not this branch and it does not serve the new account API or 30-player Trenches. A cold start loads the bundled page and does not open a socket until the player chooses online.
- Battle royale matchmaking lists a queue of 100 (`CAP.br`) but a room admits `min(100, MAX_TANKS)`. The default is 24 humans. A local run of 26 websocket clients started one room of 24 humans and 24 tanks (step about 0.8 ms average, max about 3 ms) and left the other two queued. Raising `MAX_TANKS` does not raise the queue above 100, and it does not make 150 verified. On this machine a run with `MAX_TANKS=150` still started the room at 100 sockets and was then killed by V8 (heap about 2039 MB, about 76 s, SIGABRT). No step time was recorded. `brGoalVerified` stays false. Those runs were sockets on this machine, not people and not the public host. Trenches on this server build is 15×15. The earlier 30-websocket run is not 30 phones. The client’s battle-royale card still says 100 tanks; that text is not the server cap.
- Hosted international tournaments are not implemented (`hostedTournament: false`). The in-game tournament screen builds a local bracket and fills empty seats from a built-in name list. There is no server bracket, no pairing of real sockets, and no spectator feed of those matches. Wiring that screen needs the minified client (`www/game.js`) to grow a new message path; that path is not in this build.
- The SQLite ledger is not a replacement for the device save. Device `localStorage` is kept and is not spent by the server.
- A dropped online match can be rejoined for 45 seconds (`REJOIN_MS`); after that the tank is handed to a bot.
- Do not treat `npm start` on a laptop as a production deploy. The live host is separate and is not updated by this repository change alone.
