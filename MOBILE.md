# PRICOPBUM phone packages

The Android and iOS projects are a **Capacitor WebView shell** around the same `www/` game. They are not a native renderer, not a native physics port, and not a store submission. The tank game still runs as the existing JavaScript and canvas/WebGL client inside the system web view.

No signing secrets, keystores, or provisioning profiles are in this repository. `android/local.properties` and `*.keystore` are gitignored.

## Android debug APK

Built on this machine with the public Android command-line SDK (platform 35, build-tools 34/35) and JDK 21. Gradle signed it with the **debug** keystore that the Android Gradle plugin creates outside the repo (`~/.android/debug.keystore`). That file is not committed.

- Project: `android/`
- Package: `studio.pricop.pricopbum`, versionName `1.2.6`, versionCode `9`, minSdk 22, targetSdk 35
- This is a later test than `1.2.1` (SHA256 `1ca0194e7cbfe82f4a19571f4241d54bbacc0a4a36a86340af7b47197645416d`), `1.2.0`, `1.1.0`, and the limited `1.0` APK. The screen shows `PRICOPBUM 1.2.2 test`.
- Gradle output: `android/app/build/outputs/apk/debug/app-debug.apk`
- SHA256: `c0f02fbe83db6c93124bf2b660f7e4fe82e7c641eed6776f13b42a8101546763`
- Copy: `/cursor/stores/self/artifacts/pricopbum-1.2.6-debug.apk`

Rebuild:

```bash
# Android SDK required. sdk.dir goes in android/local.properties (not committed).
cd android && ./gradlew assembleDebug
```

Install the debug APK with `adb install -r app-debug.apk` on a device that allows debug installs. This is not a Play Store package. It does not enable Google Play Billing. Real-money buttons inside the WebView still refuse the purchase.

The WebView loads the files shipped inside the APK. It does not contain a game server. A cold launch does not open a socket and does not call `/api`. The page origin is `http://localhost` (the asset host). `www/server-endpoint.js` picks one game server for both the socket and the account API. Until the player enters another address, that server is `wss://pricopbum-server.onrender.com/ws` with API `https://pricopbum-server.onrender.com`. The public host is the old build. A welcome without `features` shows that new accounts, 30-player rooms, and 150-player battle royale are not available, and device coins are not sent.

Installed on a local emulator (Pixel 6, Android 15, KVM). For `1.2.1`, `am start -W` reported `LaunchState: COLD`. Cold launch resolved the production address and did not call it (`[pb-acct] no-restore productionDefault=true`). Connect was then pointed at a throwaway server on this machine (`ws://10.0.2.2:8791/ws`, sqlite file under `/tmp`, not the public host). The account token was also written to Android `SharedPreferences` (`pricopbum`) because WebView `localStorage` did not survive `am force-stop`.

After connect, logcat recorded `[pb-acct] linked serverCoins=0 deviceCoins=20 auth=true credited=false`. Force-stop and a cold start then recorded `[pb-acct] restored` with the same token, `onlineAuth` true, device coins 20, and server coins 0. The socket was bound to that token (`payments` false). Four sockets (the emulator plus three Node clients named N1, N2, N3) finished a hosted bracket. During the other pairing the page text was `Табло счёта другого боя, не камера и не вид из танка: N1 0 — 0 N3`. The finished screen showed those names, the line `Живые игроки на этом сервере. Ботов в сетке нет.`, and `Champion — вы`. Device coins stayed 20. The throwaway ledger row for that token ended at 3 coins from the server match formula, not from the device wallet. No production user data was written. This was one emulator, not a physical phone. An online match does not add coins to the device wallet; the server ledger is the balance that changes.

## iOS

`ios/` is the Capacitor/Xcode project. This Linux machine has no Xcode, so it cannot compile the shell. `.github/workflows/ios-simulator.yml` uses the standard free `macos-latest` runner on this public repository. The workflow builds an unsigned iOS Simulator `.app` and is set up to launch it with `-pbProbe` and drive the real page: menu text, a touch on the stick, a throwaway server on that Mac, force-quit and relaunch, then a four-socket bracket and the read-only camera. iOS stores the account token in `UserDefaults` the same way Android uses `SharedPreferences`. The product is not a signed iPhone app and cannot be installed on a phone. The SQLite file is durable only when `ACCOUNT_DB` is on a persistent disk and `ACCOUNT_DURABLE=1`. This repo does not provision that disk.

Run [42198434197](https://github.com/g968800071-sudo/pricopbum-server/actions/runs/42198434197) completed on commit `8c739c6` (macOS 26.6.2 arm64, Xcode 26.6 build 17F113) and launched that older bundle as pid 9616. Run [42204446408](https://github.com/g968800071-sudo/pricopbum-server/actions/runs/42204446408) built the 1.2.1 sources, then `simctl bootstatus` hit a 120 second cap while CoreLocation migration was still running, so that attempt did not upload. Run [42205452912](https://github.com/g968800071-sudo/pricopbum-server/actions/runs/42205452912) on commit `4eebf74` is the 1.2.1 simulator app. The runner was macOS 26.7.2 arm64 with the same Xcode 26.6 (17F113). `codesign -dv` reported an ad-hoc linker signature, `TeamIdentifier=not set`, and no sealed resources. The binary is a universal simulator Mach-O (`x86_64` and `arm64`). The copied web bundle contains build `1.2.1`. `simctl launch` started `studio.pricop.pricopbum` as pid 5274 on iPhone 17 Pro simulator `2CC7A2C1-E1A7-4633-911A-DB60BDEB97F0`. This is not an installable iPhone build.

On a Mac, later:

```bash
cd ios/App
pod install
open App.xcworkspace
```

Then select your Apple Developer team, set a bundle id if you change `studio.pricop.pricopbum`, and archive. Signing certificates stay on that Mac. Do not commit them.

## iOS In-App Purchase

Apple requires StoreKit for coins and other virtual goods. Apple Pay is not used for them. The shop still shows `недоступно` on the web and on Android, because `BILLING_ENABLED` is false and there is no Play Billing session. On iOS the native `StoreKit` plugin loads products from `ios/App/TouchUITests/PRICOPBUM.storekit`, purchases, restores unfinished transactions, and reports cancel. The server grants coins from `src/iap/products.js` only after it checks the signed transaction. The same transaction id does not pay twice. Device coins are not increased. Mythic combat mods still return `payments-off`. `features.payments` stays false; `features.appleIap` is the purchase flag.

The local `.storekit` file is for the simulator. It does not create App Store Connect products and does not charge a card. Xcode receipts are accepted only when the server is started with `IAP_XCODE=1`. Leave that off on any shared or public host. Sandbox and Production receipts must chain to Apple Root CA - G3.

The owner still has to do these steps. This repository does not sign up for the Apple Developer Program, does not sign the app, and does not create the products:

1. Enroll in the Apple Developer Program and accept the Paid Apps agreement, tax, and banking in App Store Connect.
2. Create the app with bundle id `studio.pricop.pricopbum` if it does not exist.
3. Turn on the In-App Purchase capability and sign a device build with that team. The simulator build in this repo stays unsigned.
4. In App Store Connect, create one In-App Purchase for every id in `store/apple-products.json`. Consumable rows are the coin packs, gem packs, and `tier_*` price points. The other rows are non-consumables. Use the `price` column as the price point. `skin_gold` is listed at 1.24 and `season_pass` at 6.99 because those are the local StoreKit prices; Apple's price list may not have 1.24 or 7.00, so pick the nearest price point and keep the product id exact.
5. Add a sandbox tester only for a real device. The simulator test uses the local `.storekit` file and does not need one.
6. Ship the signed build. The public server must not set `IAP_XCODE=1`.

Coin packs: `coins_500` (500), `coins_1400` (1400), `coins_3000` (3000), `coins_6500` (6500), `coins_14000` (14000), `coins_38000` (38000). The full id list, including gems, the season pass, mythic items, and the `tier_*` products used by the rest of the shop, is `store/apple-products.json`.
