# PRICOPBUM on phones

The owner asked for a landscape game with touch controls that can be installed on Android and iPhone. This repository does not contain that native packaging.

## What is in the repo

- `www/` is the game that runs in Safari and Chrome. `manifest.webmanifest` asks for fullscreen landscape. `index.html` ships iPhone splash images and an Apple touch icon so the site can be added to the Home Screen.
- `src/net/bluetooth.js` looks for `window.Capacitor.Plugins.PricopbumNearby`. That plugin's Java/Swift sources are not in this repo.
- Shop and purchase buttons are drawn for a phone screen (the dialog scrolls inside the safe area). Real-money buttons now say the purchase is unavailable and do not grant the item.

Adding the site to the Home Screen is still a browser shortcut. It is not an App Store app, not a Play Store app, and not an APK.

## Android

Not buildable from this checkout:

- no `android/` project
- no Gradle files
- no Capacitor or Cordova config
- no signing keystore
- no APK or AAB artifact

An APK would need those sources plus the Android SDK. This environment does not have them, and this change does not invent a replacement app.

## iOS

Not buildable from this checkout:

- no `ios/` project and no Xcode project
- no signing certificate, provisioning profile or App Store Connect setup
- no macOS toolchain here (Xcode only runs on macOS)

What would be required later, on a Mac, once a native project actually exists: open the Xcode project, set the bundle id, select a paid Apple Developer team, archive, and upload. None of that can be done from this Linux checkout, and there is no iOS source tree to archive.

Until that project exists, iPhone players use Safari in landscape. The page rotates a portrait browser into a landscape view. That is still the website.
