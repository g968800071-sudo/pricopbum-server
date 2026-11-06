# PRICOPBUM phone packages

The Android and iOS projects are a **Capacitor WebView shell** around the same `www/` game. They are not a native renderer, not a native physics port, and not a store submission. The tank game still runs as the existing JavaScript and canvas/WebGL client inside the system web view.

No signing secrets, keystores, or provisioning profiles are in this repository. `android/local.properties` and `*.keystore` are gitignored.

## Android debug APK

Built on this machine with the public Android command-line SDK (platform 35, build-tools 34/35) and JDK 21. Gradle signed it with the **debug** keystore that the Android Gradle plugin creates outside the repo (`~/.android/debug.keystore`). That file is not committed.

- Project: `android/`
- Package: `studio.pricop.pricopbum`, versionName `1.0`, versionCode `1`, minSdk 22, targetSdk 35
- Gradle output: `android/app/build/outputs/apk/debug/app-debug.apk` (9.0 MB)
- SHA256: `4572a4edddad394a032f3d6731df5d403d09c955c050bda5a28be0f251221764`
- Copy: `/opt/cursor/artifacts/pricopbum-debug.apk`

Rebuild:

```bash
# Android SDK required. sdk.dir goes in android/local.properties (not committed).
cd android && ./gradlew assembleDebug
```

Install the debug APK with `adb install -r app-debug.apk` on a device that allows debug installs. This is not a Play Store package. It does not enable Google Play Billing. Real-money buttons inside the WebView still refuse the purchase.

The WebView loads the files shipped inside the APK. It does not contain a game server. Until the player taps online, no socket is opened. The default online address, used only after that tap, is `wss://pricopbum-server.onrender.com/ws` (the existing production host). That host was not updated by this branch, so the APK does not get the new account ledger, 30-player Trenches, or a 150-player battle from it. Account linking calls `/api/capabilities` on the page origin. Inside the APK that origin is the WebView (`https://localhost`), which has no such API, so linking does not run and device coins stay on the device.

Installed and cold-launched on a local Android emulator (Pixel 6 AVD, `system-images;android-35;google_apis;x86_64`, KVM, no window). `am start -W` reported `LaunchState: COLD` for `studio.pricop.pricopbum/.MainActivity`. The activity rotated to landscape (2400×1080). Logcat from the WebView:

`[pb-boot] href=https://localhost/ origin=https://localhost native=true`

Capacitor then handled `https://localhost/api/capabilities` as a local asset request. During that launch the emulator had no TCP connection to the production addresses `216.24.57.16` or `216.24.57.18`. After Skip, the menu showed a device profile (Private, 20 coins). That balance is the on-device save, not a server account. The mode card still says “100 tanks”; the server in this branch admits 24 humans to battle royale. This was one emulator, not a physical phone, and online was not tapped, so the production socket was not opened.

## iOS

`ios/` is the Capacitor/Xcode project. CocoaPods is not installed in this Linux environment, and Xcode is not available, so **no iPhone executable and no IPA was produced**.

On a Mac, later:

```bash
cd ios/App
pod install
open App.xcworkspace
```

Then select your Apple Developer team, set a bundle id if you change `studio.pricop.pricopbum`, and archive. Signing certificates stay on that Mac. Do not commit them.
