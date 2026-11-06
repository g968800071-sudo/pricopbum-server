# PRICOPBUM

Tank combat from PRICOP.studio. This repository is the existing game: an authoritative WebSocket server (`server/server.js`, simulation in `src/sim`) and the playable browser client in `www/` (`index.html` + `game.js`). It is a landscape web game with on-screen touch controls. It is not a native App Store or Google Play build.

```bash
npm install
npm test          # lives, respawn, loot, armour, rank, mode isolation, match reconnect
npm run smoke     # boots the server, loads the page, starts a duel
npm start         # http://0.0.0.0:$PORT   (WebSocket /ws)
```

Real-money checkout is not connected. Mythic items, the premium battle pass and coin packs paid in euros do not charge and do not grant the item. Coins earned in battle still work, including permanent upgrades on legendary tanks. The server ignores client-claimed mythic upgrade levels.

## What this build does not do

- Native Android APK and native iOS app are not in this repo. See `MOBILE.md`. A home-screen icon is the browser app, not a store install, and an APK is not an iPhone build.
- Online rooms are capped at 24 tanks (`MAX_TANKS`, aimed at a small host). Battle royale is therefore not 150 players here, and online Trenches is not a full 15×15. The simulation itself still runs Trenches at 15×15 when `perTeam` is 15. Bots fill empty seats; they are not human players.
- No account server. Rank, coins and tank mods stay on the device. A dropped online match can be rejoined for 45 seconds (`REJOIN_MS`); after that the tank is handed to a bot.
- International tournament brackets and spectating exist in the client as local/bot brackets. They are not a hosted worldwide ladder.
- Do not treat `npm start` on a laptop as a production deploy. The live host is separate and is not updated by this repository change alone.
