# r2dpass

A local-first Android password manager built with React Native 0.79.2 and native Java security code.

## Features
- Master-password protected local vault.
- Android Keystore wrapping key.
- PBKDF2-HMAC-SHA256 with 600,000 iterations.
- AES-256-GCM encrypted vault data.
- Cryptographically secure native password generator.
- App-password and email entries.
- English and Arabic RTL interface.
- Light and dark themes.
- Bundled r2dpass icon and splash screen.
- No cloud sync and no network permission required by the app.

## Build

Requirements: Node 20, JDK 17, Android SDK 35.

```bash
npm install
cd android
./gradlew assembleDebug
```

The debug APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

The repository includes a self-contained Gradle wrapper bootstrap that downloads Gradle 8.13 when required.

## Security note
The master password is never stored. Vault contents are encrypted with AES-GCM, while the local encrypted vault blob is additionally wrapped with an Android Keystore AES key. This is a local password manager, not a cloud synchronization service.
