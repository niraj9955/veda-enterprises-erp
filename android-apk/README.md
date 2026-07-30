# Veda ERP — Android App

Native Android WebView app that wraps the Veda ERP web application
(https://veda-enterprises-erp.vercel.app/).

## Project Info

| Property        | Value                                       |
|-----------------|---------------------------------------------|
| Application ID  | `com.veda.enterprises`                      |
| Version         | 1.0.2 (versionCode 3)                       |
| Min SDK         | Android 7.0 (API 24)                        |
| Target SDK      | Android 14 (API 34)                         |
| Compile SDK     | 34                                          |
| Java            | 17                                          |
| Gradle Plugin   | 8.1.0                                       |
| Default URL     | https://veda-enterprises-erp.vercel.app/    |

## How to Open in Android Studio

1. Unzip this file to any folder, e.g. `D:\Projects\veda-erp-android\`.
2. Open **Android Studio** → `File` → `Open…` → select the unzipped folder.
3. Android Studio will:
   - Download Gradle 8.1+ if not present
   - Download Android SDK Platform 34 + Build Tools 34.0.0 if missing
   - Generate the Gradle wrapper automatically (if missing)
4. Wait for the initial Gradle sync to complete (~2–5 min first time).
5. Click the green ▶ Run button to build & install on a connected device/emulator.

## How to Build a Signed Release APK

### Option A — Use the existing keystore (already included)

A pre-made signing keystore is included (`veda-release.keystore`):

| Property        | Value           |
|-----------------|-----------------|
| Alias           | `veda-key`      |
| Password        | `veda1234`      |
| Validity        | 30 years        |

The `app/build.gradle` already has the signing config wired up.
To build the signed APK:

```bash
# Linux/Mac
./gradlew assembleRelease

# Windows
gradlew.bat assembleRelease
```

The signed APK will be at:
`app/build/outputs/apk/release/app-release.apk`

### Option B — Generate your own keystore (recommended for production)

```bash
keytool -genkey -v -keystore veda-release.keystore \
  -alias veda-key -keyalg RSA -keysize 2048 -validity 10000
```

Then update `app/build.gradle` → `signingConfigs.release` with the new
passwords.

## How to Change the Default URL

Two ways:

1. **At build time** — edit `app/src/main/res/values/strings.xml`:
   ```xml
   <string name="defaultUrl">https://your-new-url.com/</string>
   ```

2. **At runtime** — open the app → if it fails to load, tap
   "सर्वर URL सेटिंग्स" → enter new URL → save. App restarts automatically.

## App Features

- Splash screen with Veda logo (1.5s)
- Full-screen WebView with JavaScript, cookies, DOM storage
- File upload support (single + multi-file chooser)
- Geolocation auto-granted
- Camera / microphone permission handling
- External links open in browser (tel:, mailto:, wa:, sms:)
- Download listener (downloads open in browser)
- Back button navigates WebView history, then exits
- Hindi error screen with Retry + Settings buttons
- User-configurable server URL
- Adaptive icon (Android 8.0+) with Veda logo
- Emerald green theme (#10B981 / #047857)
- Portrait orientation lock
- Cleartext HTTP allowed (for local development)

## Project Structure

```
veda-erp-android/
├── build.gradle                    (root)
├── settings.gradle
├── gradle.properties
├── veda-release.keystore           (signing key)
├── README.md                       (this file)
└── app/
    ├── build.gradle                (app module config)
    ├── proguard-rules.pro
    └── src/main/
        ├── AndroidManifest.xml
        ├── java/com/veda/enterprises/
        │   ├── MainActivity.java   (WebView host)
        │   └── SettingsActivity.java (URL config screen)
        └── res/
            ├── drawable/
            │   ├── splash_background.xml
            │   ├── ic_launcher_background.xml  (adaptive icon bg)
            │   ├── ic_launcher_foreground.xml  (adaptive icon fg)
            │   └── ic_launcher_foreground.png  (Veda logo, 432x432)
            ├── layout/
            │   ├── activity_main.xml           (WebView + splash + error)
            │   └── activity_settings.xml       (URL edit form)
            ├── mipmap-anydpi-v26/
            │   ├── ic_launcher.xml             (adaptive icon)
            │   └── ic_launcher_round.xml
            ├── mipmap-mdpi/    (48x48 icons)
            ├── mipmap-hdpi/    (72x72 icons)
            ├── mipmap-xhdpi/   (96x96 icons)
            ├── mipmap-xxhdpi/  (144x144 icons)
            ├── mipmap-xxxhdpi/ (192x192 icons)
            ├── values/
            │   ├── strings.xml                 (app name + default URL)
            │   ├── colors.xml                  (emerald theme)
            │   └── styles.xml                  (Theme.VedaERP)
            └── xml/
                └── network_security_config.xml (allows HTTP+HTTPS)
```

## Signing Info (Existing Keystore)

⚠️ **For production**: Generate your own keystore before publishing to Play Store.
Using the bundled keystore publicly is a security risk — anyone can sign
updates to your app with it.

The bundled keystore is for **development/internal distribution only**.

---

© Veda Enterprises
