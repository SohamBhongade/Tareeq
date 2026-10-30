# Tareeq — Android app (website container)

This is a thin Android app. It opens the Tareeq website full-screen, so it looks and
behaves like an app, while all the real content still comes from the website. When you
update the website, the app updates too. You don't need to rebuild it.

What works inside the app:
- The full website, with logins/cookies remembered
- **Taking a photo** with the camera, or picking one from the gallery, when the site asks for an image
- **GPS location** (the phone asks permission the first time)
- Android back button goes back through website pages
- A friendly "No internet" screen with a *Try again* button (English + Arabic)
- Phone, email, WhatsApp and Google Maps links open in their own apps
- Right-to-left layout support

---

## Step 1 — Put in your website address (required)

The address is set in `app/src/main/res/values/strings.xml`:

```xml
<string name="start_url" translatable="false">https://tareeq-rak.vercel.app</string>
```

If the website ends up at a different address, change this one line (keep the `https://`).

## Step 2 — Get the APK (pick ONE way)

### Way A: GitHub builds it for you (no software to install)
This folder is part of the Tareeq repository, which has a builder in
`.github/workflows/build-apk.yml` at the top level. Every time something inside
`website-android/` is pushed to GitHub:
1. Open the repository's **Actions** tab. The *Build Tareeq APK* job takes about 3–5 minutes.
2. When it shows a green tick, open the run and download **Tareeq-apk** under *Artifacts*.
   Unzip it and you have `Tareeq.apk`.

You can also start it by hand: Actions → *Build Tareeq APK* → **Run workflow**.

### Way B: Android Studio
1. Install Android Studio, then **File → Open** this folder.
2. Wait for the "Gradle sync" to finish.
3. **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
4. Click *locate* in the popup. The APK is in `app/build/outputs/apk/`.

## Step 3 — Install on a phone
Send `Tareeq.apk` to the phone (WhatsApp, Drive, USB, etc.) and tap it. Android will ask
you to allow installing from that source. Allow it, then tap **Install**.

---

## Optional changes

| Want to change | Where |
|---|---|
| App name under the icon | `app/src/main/res/values/strings.xml` → `app_name` |
| Brand / status-bar colour | `app/src/main/res/values/colors.xml` → `brand` |
| App icon | Android Studio: right-click `res` → **New → Image Asset**, then pick your logo. (The current icon is a simple placeholder road.) |
| Package ID (needed before any Play Store upload) | `app/build.gradle` → `applicationId` |
| Version number | `app/build.gradle` → `versionCode` / `versionName` |

## Good to know
- The website must use **https**.
- **Google Sign-In** (and some other "Sign in with…" pop-ups) won't work inside an
  in-app web view, because Google blocks it. Email/password login is fine.
- The APK is signed with a standard test key. That's fine for the hackathon and for
  installing on phones directly. A Google Play upload needs a proper signing key.
- Minimum Android version: 8.0.
