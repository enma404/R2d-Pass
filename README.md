# r2dpass

A clean Android password manager built with **React Native + Java**.

## Included
- Admin account / Master Password creation and unlock.
- Local encrypted vault.
- AES-256-GCM encryption.
- PBKDF2-HMAC-SHA256 with 600,000 iterations.
- Android Keystore wrapping key for the stored vault blob.
- App entries: Instagram, Facebook, TikTok, Telegram, Discord, Steam, WhatsApp, LinkedIn, GitHub and Other.
- Email-only entries.
- Password generator: uppercase, lowercase, numbers, symbols and 8–32 character slider.
- Search, show/hide passwords and clean cards.
- Light/Dark mode.
- English/Arabic UI with dynamic RTL-aware layouts.
- Instagram support link.
- Supplied r2dpass logo used for the Android icon and splash screen.

## Build locally

Requirements: Node 20, Java 17, Android SDK and Gradle 8.11.1.

```bash
npm install
cd android
gradle wrapper --gradle-version 8.11.1
./gradlew assembleDebug
```

APK:
`android/app/build/outputs/apk/debug/app-debug.apk`

## GitHub Actions

Push the project to GitHub. The included workflow installs Node 20 and Java 17, creates the Gradle wrapper, builds the debug APK and uploads it as an Actions artifact.

## Security note

The master password is never stored. The vault is encrypted with AES-256-GCM using a key derived from the master password. The encrypted vault blob is additionally wrapped by an Android Keystore AES key before being placed in SharedPreferences.
