# PRICOPBUM phone packages

The Android and iOS projects are a **Capacitor WebView shell** around the same `www/` game. They are not a native renderer, not a native physics port, and not a store submission. The tank game still runs as the existing JavaScript and canvas/WebGL client inside the system web view.

No signing secrets, keystores, or provisioning profiles are in this repository. `android/local.properties` and `*.keystore` are gitignored.

## Android debug APK

Built on this machine with the public Android command-line SDK (platform 35, build-tools 34/35) and JDK 21. Gradle signed it with the **debug** keystore that the Android Gradle plugin creates outside the repo (`~/.android/debug.keystore`). That file is not committed.

- Project: `android/`
- Package: `studio.pricop.pricopbum`, versionName `1.2.1`, versionCode `4`, minSdk 22, targetSdk 35
- This is a later test than `1.2.0` (SHA256 `359ed2e8944b3d86783e66887ffa3b6d68460783a4fe47001758adefac47ce66`), `1.1.0` (SHA256 `9efecc88c152cadcb33ef1075f6cc63b0f7e881af2b12687ffd2efe324eee0fb`) and the limited `1.0` APK (SHA256 `4572a4edddad394a032f3d6731df5d403d09c955c050bda5a28be0f251221764`). The screen shows `PRICOPBUM 1.2.1 test`.
- Gradle output: `android/app/build/outputs/apk/debug/app-debug.apk`
- SHA256: `1ca0194e7cbfe82f4a19571f4241d54bbacc0a4a36a86340af7b47197645416d`
- Copy: `/opt/cursor/artifacts/pricopbum-1.2.1-debug.apk`

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

`ios/` is the Capacitor/Xcode project. This Linux machine has no Xcode, so it cannot compile the shell. `.github/workflows/ios-simulator.yml` uses the standard free `macos-latest` runner on this public repository to install CocoaPods and build an unsigned iOS Simulator `.app`. That file is not a signed iPhone app and cannot be installed on a phone.

Run [42198434197](https://github.com/g968800071-sudo/pricopbum-server/actions/runs/42198434197) completed on commit `8c739c6` (macOS 26.6.2 arm64, Xcode 26.6 build 17F113) and launched that older bundle as pid 9616. Run [42204446408](https://github.com/g968800071-sudo/pricopbum-server/actions/runs/42204446408) built the 1.2.1 sources, then `simctl bootstatus` hit a 120 second cap while CoreLocation migration was still running, so that attempt did not upload. Run [42205452912](https://github.com/g968800071-sudo/pricopbum-server/actions/runs/42205452912) on commit `4eebf74` is the 1.2.1 simulator app. The runner was macOS 26.7.2 arm64 with the same Xcode 26.6 (17F113). `codesign -dv` reported an ad-hoc linker signature, `TeamIdentifier=not set`, and no sealed resources. The binary is a universal simulator Mach-O (`x86_64` and `arm64`). The copied web bundle contains build `1.2.1`. `simctl launch` started `studio.pricop.pricopbum` as pid 5274 on iPhone 17 Pro simulator `2CC7A2C1-E1A7-4633-911A-DB60BDEB97F0`. This is not an installable iPhone build.

On a Mac, later:

```bash
cd ios/App
pod install
open App.xcworkspace
```

Then select your Apple Developer team, set a bundle id if you change `studio.pricop.pricopbum`, and archive. Signing certificates stay on that Mac. Do not commit them.
