<div align="center">
  <img src="https://github.com/user-attachments/assets/ac37422e-70b0-49d4-af8b-f3c7b879ef2c" alt="The SpellCaster Logo" width="200"/>
  <h1>The SpellCaster</h1>
  <p><b>Windows</b> · <b>Android</b> · <b>Web</b></p>
</div>

A powerful soundboard application built for TTRPG (Tabletop Role-Playing Game) sessions, featuring character-specific sound sets and environmental audio management. Built with React, Tauri, and Tailwind CSS, and available as a desktop app, an Android app, and a web app.

This project was first intended to be for personal use. I looked at a lot of soundboards and they either didn’t have the features I wanted or were subscription based, so I decided to create The SpellCaster. After it was finished, I though I’d share it in case other players find it usefull for their campaigns.

Please note that because it was made for personal use and I prefer to splice and create my own audio, it does not feature a built in sound library or a sound search feature. This tool is best if you are planning on sourcing or generating your own custom spell effects and ambient tracks. *(Note: The custom "Vaelor" spells and icons shown in the screenshots are for demonstration purposes and are not included in the download, except for the default placeholder assets.)*

NOTICE: This project is done via vibe coding and features AI made content (both code and assets) alongside stock images and audio.

---

## 📸 Interface Preview

<img width="1920" height="1080" alt="Main Split View" src="https://github.com/user-attachments/assets/cece12e7-501b-45b0-bff5-9baa74889267" />

*The SpellCaster features a Split View mode to manage both character abilities and environmental ambiance simultaneously.*

### Complete Theming & Backgrounds
![Background Settings](https://github.com/user-attachments/assets/854c071d-53e5-4ec4-8d03-b69c114bd676)
*Tailor the look and feel of your soundboard with custom color themes or your own background images.*

### Custom Character Boards
![Custom Character Board](https://github.com/user-attachments/assets/af23a964-a2b9-4249-b303-5a61cb8e2b34)
*Build dedicated boards for specific characters and classes, bringing in your own custom artwork and sound effects. (The Vaelor Trueflame board shown here is just an example of what you can build!)*

<details>
<summary><b>View More Screenshots (Click to expand)</b></summary>
<br>

![Wood Elf Ranger](https://github.com/user-attachments/assets/b651e4cd-b60e-40ec-aa6d-1d347bf451e1)

![Human Paladin](https://github.com/user-attachments/assets/e7182786-f31f-4a98-aa8f-63eefea5544c)

</details>

---
## Features

- **Advanced Audio Playback**: Full audio support with HTML5 Audio API for reliable, low-latency playback
- **Environmental Sound Management**: Background music and ambience with looping, fade effects, and category organization
- **Character Sound Sets**: Create and manage multiple character profiles with custom sound configurations
- **Split View Interface**: Simultaneous access to character sounds and environmental audio *(Windows desktop only)*
- **Android App**: Touch-optimized layout with a slide-out drawer and a bottom navigation rail, including edit mode with delete badges
- **Timer-Based Playback**: Set custom durations for timed sound effects
- **Advanced Audio Controls**: Fade in/out effects, looping options, and master volume control
- **File Management**: Sophisticated file handling with Tauri FS plugin and localStorage fallback
- **Customizable Interface**: Background image support, dark theme optimized for gaming sessions
- **Multiple Sound Files**: Support for multiple audio files per sound with random playback options
- **Icon Support**: PNG, JPG, and GIF icon formats for sound customization
- **Persistent Storage**: Automatic saving of configurations and file management
- **Visible Save Failures**: Storage errors (for example a full browser quota) surface in-app instead of failing silently

## Platform Support

| | Windows | Android | Web |
|---|---|---|---|
| Sound playback, characters, environment, groups | ✅ | ✅ | ✅ |
| Persistent storage | Filesystem + localStorage | Filesystem + localStorage | localStorage only |
| Split View | ✅ | — (single column) | ✅ |
| Custom backgrounds & themes | ✅ | ✅ | ✅ |
| Minimum version | — | Android 7.0 (API 24) | Any modern browser |

Audio files uploaded on desktop/web are stored through the Tauri filesystem plugin where available, and fall back to `localStorage` in the browser. On Android they are written to the app's private data directory.

## Tech Stack

- **Frontend**: React 19, Vite
- **Desktop Framework**: Tauri 2.x with Rust backend
- **Mobile Framework**: Tauri 2.x Android target (Kotlin, Gradle, Android SDK 36)
- **Styling**: Tailwind CSS v3 with custom dark theme
- **Icons**: Lucide React
- **Audio**: HTML5 Audio API with advanced playback controls
- **File Management**: Tauri FS plugin + localStorage fallback for web compatibility
- **State Management**: React Hooks with real-time updates
- **Build System**: Vite with Tauri integration
- **Platform Detection**: `@tauri-apps/plugin-os` (`isMobile` gates mobile-only UI in the shared frontend)

## Quick Start

### Web Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5173/`

### Desktop App Development

1. Install Tauri prerequisites (Rust toolchain):
   ```bash
   # Install Rust if not already installed
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs/ | sh
   ```

2. Start Tauri development:
   ```bash
   npm run tauri dev
   ```

### Android App Development

Requires Android Studio with the Android SDK, NDK, and a JDK, plus a running emulator or a connected device with USB debugging enabled.

1. Add the Android Rust targets and install the Tauri CLI:
   ```bash
   rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
   npm install -g @tauri-apps/cli@latest
   ```

2. Confirm the device is visible:
   ```bash
   adb devices
   ```

3. Run on the connected device or emulator:
   ```bash
   npm run tauri android dev
   ```

4. Open the native project directly when you need Android Studio (Gradle, manifest, SDK config):
   ```bash
   npm run tauri android init   # only needed if src-tauri/gen/android is missing
   ```
   The generated project lives in `src-tauri/gen/android/`. Launch it from Android Studio with the **Run App** configuration, or double-click `src-tauri/gen/android/Run App.bat` on Windows.

   > If the dev server fails with `Port 5173 is already in use`, a previous Vite process is still running. Free it with the bundled helper from the project root: `kill-ports.bat` (add `/all` to also clear app processes and adb forwards, `/emu` to shut the emulator down).

**Device notes**
- Application ID: `com.mrhorakhty.thespellcaster` (debug builds get the `.debug` suffix).
- Minimum supported Android version is 7.0 (API 24); it is compiled and targeted against SDK 36.
- Only the `INTERNET` permission is requested, plus leanback/TV launcher support (optional, not required).
- The Android manifest and Gradle project are regenerated by Tauri. Keep mobile-specific changes inside `src-tauri/gen/android/`, and keep shared-frontend mobile changes gated behind `isMobile` so desktop and web are unaffected.

### Building for Production

**Web Build:**
```bash
npm run build
```

**Desktop Build:**
```bash
npm run tauri build
```

**Android Build (APK):**
```bash
npm run tauri android build
```
The APK is written to `src-tauri/gen/android/app/build/outputs/apk/`. Add `--apk` to produce a directly installable APK, or use `--aab` for a Play Store bundle.

## Project Structure

```
├── src/
│   ├── App.jsx              # Main application component (shared desktop/web/Android UI)
│   ├── main.jsx             # React entry point
│   ├── index.css            # Tailwind imports + custom styles
│   ├── data.json            # Default sound configuration
│   └── assets/
│       └── fonts/           # Custom fonts
├── public/
│   └── assets/              # Audio files and icons
├── src-tauri/
│   ├── src/                 # Rust backend source
│   ├── tauri.conf.json      # Tauri configuration
│   ├── capabilities/        # Tauri permissions (filesystem, window, os)
│   ├── Cargo.toml           # Rust dependencies
│   ├── icons/               # Application icons
│   └── gen/android/         # Generated Android project (Gradle, manifest, Run App.bat)
├── e2e/                     # Test suites and runners
│   ├── e2e-mobile.mjs       # Android UI suite
│   ├── e2e-full.ps1         # Windows/web runner
│   ├── e2e-android.ps1      # Android runner
│   ├── e2e-snapshot.mjs     # localStorage backup/restore used by the Android runner
│   └── kill-ports.bat       # Frees dev/E2E ports (repo root copy: ../kill-ports.bat)
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── package.json             # Node.js dependencies
```

## Customization

### Adding New Sounds

1. **Add Audio Files**: Place your audio files in `public/assets/` (supports .wav, .mp3, etc.)
2. **Add Icons**: Add SVG, PNG, JPG, or GIF icons to `public/assets/`
3. **Update Configuration**: Modify `src/data.json` with your new sound setup

### Sound Configuration Structure

```json
{
  "characters": [
    {
      "id": "char_1",
      "name": "Character Name",
      "sounds": [
        {
          "id": "s_1",
          "name": "Sound Name",
          "type": "Sound Type",
          "icon": "icon.svg",           // Icon filename
          "file": "sound.wav",           // Single audio file
          "files": [                     // Multiple audio files (optional)
            { "name": "sound1.wav", "url": "sound1.wav" },
            { "name": "sound2.wav", "url": "sound2.wav" }
          ],
          "randomPlay": true,           // Random selection from files array
          "color": "#hexcolor",         // Theme color
          "duration": 0,                // 0 = full file, >0 = timer in seconds
          "loop": false,                // Loop playback
          "fadeIn": 0,                  // Fade in duration (seconds)
          "fadeOut": 0,                 // Fade out duration (seconds)
          "glowEnabled": true,          // Enable glow effect
          "glowProminence": 0.5         // Glow intensity (0-1)
        }
      ]
    }
  ],
  "environmentSounds": [
    {
      "category": "Category Name",
      "sounds": [
        {
          "id": "env_1",
          "name": "Sound Name",
          "type": "Environment Type",
          "icon": "icon.svg",
          "file": "sound.wav",
          "color": "#10b981",
          "duration": 0,
          "loop": true,                 // Typically true for environmental sounds
          "fadeIn": 2.5,
          "fadeOut": 3.0,
          "isEnvironmental": true       // Mark as environmental sound
        }
      ]
    }
  ]
}
```

### Advanced Features

**Multiple Sound Files**: Add multiple audio files to a single sound button for random playback:
```json
{
  "files": [
    { "name": "spell1.wav", "url": "spell1.wav" },
    { "name": "spell2.wav", "url": "spell2.wav" },
    { "name": "spell3.wav", "url": "spell3.wav" }
  ],
  "randomPlay": true
}
```

**Custom Backgrounds**: The app supports custom background images through the settings interface.

**File Management**: Files are automatically managed with Tauri's file system plugin for desktop apps and localStorage for web compatibility.

## Development

### Available Scripts

- `npm run dev` - Start web development server
- `npm run tauri dev` - Start Tauri desktop development
- `npm run tauri android dev` - Run on a connected Android device or emulator
- `npm run tauri android build` - Build the Android APK
- `npm run build` - Build web version
- `npm run tauri build` - Build desktop application
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Testing

End-to-end suites drive the real app over the Chrome DevTools Protocol and are run through PowerShell:

- `e2e/e2e-full.ps1` - Desktop and web phases
- `e2e/e2e-android.ps1` - Android emulator/device phase
- `kill-ports.bat` - Frees the ports and stray processes the suites use (run it first if a run fails to start)

The Android runner snapshots `localStorage` before the suite and restores it afterwards, even if the app or the run crashes, so test data never overwrites your real characters and sounds.

### Git Backup Scripts

- `npm run backup` - Manual backup commit
- `npm run backup-feature` - Feature backup commit
- `npm run status` - Check git status
- `npm run log` - View recent git log
- `npm run restore-last` - Restore last commit

## License

MIT License
