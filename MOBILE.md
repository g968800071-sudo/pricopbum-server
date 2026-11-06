# PRICOPBUM phone packages

The Android and iOS projects are a **Capacitor WebView shell** around the same `www/` game. They are not a native renderer, not a native physics port, and not a store submission. The tank game still runs as the existing JavaScript and canvas/WebGL client inside the system web view.

No signing secrets, keystores, or provisioning profiles are in this repository. `android/local.properties` and `*.keystore` are gitignored.

## Android debug APK

Built on this machine with the public Android command-line SDK (platform 35, build-tools 34/35) and JDK 21. Gradle signed it with the **debug** keystore that the Android Gradle plugin creates outside the repo (`~/.android/debug.keystore`). That file is not committed.

- Project: `android/`
- Package: `studio.pricop.pricopbum`, versionName `1.2.0`, versionCode `3`, minSdk 22, targetSdk 35
- This is a later test than `1.1.0` (SHA256 `9efecc88c152cadcb33ef1075f6cc63b0f7e881af2b12687ffd2efe324eee0fb`) and the limited `1.0` APK (SHA256 `4572a4edddad394a032f3d6731df5d403d09c955c050bda5a28be0f251221764`). The screen shows `PRICOPBUM 1.2.0 test`.
- Gradle output: `android/app/build/outputs/apk/debug/app-debug.apk`
- SHA256: `359ed2e8944b3d86783e66887ffa3b6d68460783a4fe47001758adefac47ce66`
- Copy: `/opt/cursor/artifacts/pricopbum-1.2.0-debug.apk`

Rebuild:

```bash
# Android SDK required. sdk.dir goes in android/local.properties (not committed).
cd android && ./gradlew assembleDebug
```

Install the debug APK with `adb install -r app-debug.apk` on a device that allows debug installs. This is not a Play Store package. It does not enable Google Play Billing. Real-money buttons inside the WebView still refuse the purchase.

The WebView loads the files shipped inside the APK. It does not contain a game server. A cold launch does not open a socket and does not call `/api`. The page origin is `http://localhost` (the asset host). `www/server-endpoint.js` picks one game server for both the socket and the account API. Until the player enters another address, that server is `wss://pricopbum-server.onrender.com/ws` with API `https://pricopbum-server.onrender.com`. The public host is the old build. A welcome without `features` shows that new accounts, 30-player rooms, and 150-player battle royale are not available, and device coins are not sent.

Installed on a local emulator (Pixel 6, Android 15, KVM). `am start -W` reported `LaunchState: COLD` for versionName `1.1.0`. Before connect, the page resolved the production address and had not called it. Connect was then pointed at a throwaway server on this machine (`ws://10.0.2.2:8765/ws`, not the public host). Logcat:

`[pb-boot] href=http://localhost/ api=http://10.0.2.2:8765/api/capabilities ws=ws://10.0.2.2:8765/ws native=true legacy=false`

`[pb-acct] linked coins=0 credited=false`

The device wallet stayed at 20 coins. The ledger row was coins 0, rank 0, no mods. A second throwaway socket that answered like the old server (welcome with no `features`) set the session unauthenticated and showed the limited-compatibility banner. No production user data was written. This was one emulator, not a physical phone.

## iOS

`ios/` is the Capacitor/Xcode project. This Linux machine has no Xcode, so it cannot compile the shell. `.github/workflows/ios-simulator.yml` uses the standard free `macos-latest` runner on this public repository to install CocoaPods and build an unsigned iOS Simulator `.app`. That file is not a signed iPhone app and cannot be installed on a phone.

On a Mac, later:

```bash
cd ios/App
pod install
open App.xcworkspace
```

Then select your Apple Developer team, set a bundle id if you change `studio.pricop.pricopbum`, and archive. Signing certificates stay on that Mac. Do not commit them.
