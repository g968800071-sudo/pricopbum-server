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

`ACCOUNT_DB` (default `data/accounts.sqlite`) is a local SQLite file. It is not `localStorage` and it is not a paid database host. The first link copies coins, rank and legendary mods from the device once and does not delete the device copy. A later link with the same token does not reset that ledger. Online match rewards are computed on the server from the match it actually ran and are not paid twice. Offline spends stay on the device and are kept when a server snapshot arrives.

## Phone shell

`android/` and `ios/` are a Capacitor WebView wrapper around `www/`, not a native game renderer. See `MOBILE.md`. A debug APK can be built with the public Android SDK. No iPhone binary is produced here.

## What this build does not do

- The debug APK is a WebView shell, not a native renderer and not a Play Store build. No iPhone executable is produced here. A home-screen icon of the website is still the website.
- Battle royale online stays capped at 24 tanks (`MAX_TANKS`). A 150-player battle has not been run. Trenches is 15×15 (30 tanks). A simulated-client run of 30 websocket clients on this machine started in about 160 ms and stepped at about 0.4 ms average (max about 4 ms). That is not 30 physical phones.
- The SQLite ledger is not a replacement for every local save. Device `localStorage` is kept. International tournaments in the client are still local brackets with bots, not a hosted world ladder.
- A dropped online match can be rejoined for 45 seconds (`REJOIN_MS`); after that the tank is handed to a bot.
- Do not treat `npm start` on a laptop as a production deploy. The live host is separate and is not updated by this repository change alone.
