# PRICOPBUM phone packages

The Android and iOS projects are a **Capacitor WebView shell** around the same `www/` game. They are not a native renderer, not a native physics port, and not a store submission. The tank game still runs as the existing JavaScript and canvas/WebGL client inside the system web view.

No signing secrets, keystores, or provisioning profiles are in this repository. `android/local.properties` and `*.keystore` are gitignored.

## Android debug APK

Built on this machine with the public Android command-line SDK (platform 35, build-tools 34/35) and JDK 21. Gradle signed it with the **debug** keystore that the Android Gradle plugin creates outside the repo (`~/.android/debug.keystore`). That file is not committed.

- Project: `android/`
- Gradle output: `android/app/build/outputs/apk/debug/app-debug.apk`
- Copy used for this run: `/opt/cursor/artifacts/pricopbum-debug.apk` (about 8.6 MB)

Rebuild:

```bash
# Android SDK required. sdk.dir goes in android/local.properties (not committed).
cd android && ./gradlew assembleDebug
```

Install the debug APK with `adb install -r app-debug.apk` on a device that allows debug installs. This is not a Play Store package. It does not enable Google Play Billing. Real-money buttons inside the WebView still refuse the purchase.

The WebView loads the bundled site. Online play uses the server address already in the game (the public host, or the page host when you open the site in a browser). Offline battles use the simulation shipped in `www/game.js`.

## iOS

`ios/` is the Capacitor/Xcode project. CocoaPods is not installed in this Linux environment, and Xcode is not available, so **no iPhone executable and no IPA was produced**.

On a Mac, later:

```bash
cd ios/App
pod install
open App.xcworkspace
```

Then select your Apple Developer team, set a bundle id if you change `studio.pricop.pricopbum`, and archive. Signing certificates stay on that Mac. Do not commit them.
