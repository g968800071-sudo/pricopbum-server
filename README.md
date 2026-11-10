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

## Client source

`npm run build` reads `src/client/main.js`, bundles it with esbuild, and writes `www/game.js` and `www/index.html`. Tests that mention the shipped client read that file. The recovered ZIP’s `pricopbum-app/build.mjs` is the pipeline that produced earlier playable bundles. Newer server, ledger, payment, and routing behavior was reapplied in the editable sources before this build. The ZIP’s `src_backup.tsx` is a previous generated embed, not an editor source.

## Phone shell

`android/` and `ios/` are a Capacitor WebView wrapper around `www/`, not a native game renderer. See `MOBILE.md`. A debug APK can be built with the public Android SDK. No iPhone binary is produced here.

## What this build does not do

- The debug APK is a WebView shell, not a native renderer and not a Play Store build. No iPhone executable is produced here. A home-screen icon of the website is still the website.
- Debug APK `1.2.6` (versionCode 9) is a later test than `1.2.5`, `1.2.4`, `1.2.3`, `1.2.2`, `1.1.0`, and the limited `1.0` APK. An online result shows that match's server delta and the account total separately, and leaves the device wallet unchanged. A draw does not deduct rank points. Offline matches still pay the device wallet. Cold launch stays offline. The online address and the account API are the same configured server (`www/server-endpoint.js`). The default, until the player types another address, is `wss://pricopbum-server.onrender.com/ws` and `https://pricopbum-server.onrender.com`. That public host is the old server. Connecting to it shows a banner that new accounts, 30-player Trenches, and 150-player battle royale are not available there. Device coins are not uploaded. On Android the account token and server address are also stored in `SharedPreferences`, because WebView `localStorage` did not survive a force-stop. An online match credits the server ledger only.
- On this branch server, standard battle royale and giant battle royale (`br` and `brg`, the 600×600 map) both admit 150 tanks. Team and the other non-BR modes stay on `MAX_TANKS` (24 unless overridden). A separate-process run of 150 websocket clients on standard battle royale reached 150 sockets and 150 tanks, RSS about 95 MB, step about 1.2 ms average. Those sockets are not 150 people, and the public host was not upgraded. A giant world constructed in-process also contains 150 tanks; that is not a 150-person match. `brGoalVerified` stays false. Trenches on this server is 15×15, 30 humans. The 30-websocket run is not 30 phones.
- A hosted tournament of connected sockets is implemented (`hostedTournament: true`, sizes 2, 4 and 8). Empty seats are not filled with bots. Four websocket clients on this machine rejoined a lobby, one opened a read-only camera of the other pairing (snapshots of that room, inputs ignored), and the bracket finished. Those were sockets, not people. The practice screen is labeled as bots and does not write the server ledger. The score line is only a caption. The spectator view follows a tank in the other match and does not send controls.
- The SQLite ledger is not a replacement for the device save. Device `localStorage` is kept and is not spent by the server.
- A dropped online match can be rejoined for 45 seconds (`REJOIN_MS`); after that the tank is handed to a bot.
- Do not treat `npm start` on a laptop as a production deploy. The live host is separate and is not updated by this repository change alone.
