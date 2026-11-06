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
- Build `1.1.0` (versionCode 2) is a later test than the limited `1.0` APK. Cold launch stays offline. The online address and the account API are the same configured server (`www/server-endpoint.js`). The default, until the player types another address, is `wss://pricopbum-server.onrender.com/ws` and `https://pricopbum-server.onrender.com`. That public host is the old server. Connecting to it shows a banner that new accounts, 30-player Trenches, and 150-player battle royale are not available there. Device coins are not uploaded.
- Battle royale on this server admits 150 humans. A separate-process run of 150 websocket clients (not people) reached 150 humans and 150 tanks. Server RSS was about 97–99 MB, heap about 17–21 MB, step about 1.3 ms average and about 18 ms max. The earlier crash to about 2 GB was the test process keeping every parsed snapshot, with per-socket deflate contexts still enabled. Snapshots are no longer compressed, a backed-up socket skips a snapshot, and tile deltas already sent are dropped. `brGoalVerified` stays false: no human players and not the public host. Trenches on this server is 15×15. The 30-websocket run is not 30 phones.
- Hosted international tournaments are not implemented (`hostedTournament: false`). The screen in `www/game.js` builds a local bracket and fills seats from a built-in name list. There is no bundler in this repo and no source map: `www/game.js` is the playable client, and `src/net/client.js` is not what the page loads. A hosted bracket needs the owner’s pre-minified client sources and the script that produced `www/game.js`. This build does not invent that screen.
- The SQLite ledger is not a replacement for the device save. Device `localStorage` is kept and is not spent by the server.
- A dropped online match can be rejoined for 45 seconds (`REJOIN_MS`); after that the tank is handed to a bot.
- Do not treat `npm start` on a laptop as a production deploy. The live host is separate and is not updated by this repository change alone.
