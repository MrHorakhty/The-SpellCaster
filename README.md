# TTRPG Soundboard

A local, offline-first TTRPG soundboard desktop application built with React, Vite, and Tailwind CSS.

## Features

- **🎵 Audio Playback**: Full audio support with Howler.js for low-latency, multi-channel playback
- **🌲 Environmental Sounds**: Background music and ambience with looping functionality
- **⏱️ Advanced Audio Controls**: Timer-based playback, fade in/out effects, and looping options
- **📂 Category Management**: Add and manage environment sound categories
- **👥 Character Management**: Add, delete, and switch between character sound sets
- **🔊 Sound Management**: Add, edit, and delete sounds with custom audio files and icons
- **🎚️ Volume Control**: Master volume slider with mute/unmute functionality
- **🌙 Dark Theme**: Distraction-free interface optimized for tabletop gaming sessions
- **📱 Responsive Grid**: Flexible layout that adapts to different screen sizes
- **🔄 Dynamic Content**: Real-time preview and management without page reloads
- **🔮 Future-Proof**: CSS architecture ready for circular "Wheel" layout implementation

## Tech Stack

- **Frontend**: React 19, Vite
- **Styling**: Tailwind CSS v3 with custom dark theme
- **Icons**: Lucide React
- **Audio**: Howler.js (fully implemented)
- **State Management**: React Hooks with dynamic content updates
- **File Handling**: HTML5 File API with URL.createObjectURL()
- **Desktop**: Web-first build (Electron/Tauri ready)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:5175/`

## Project Structure

```
src/
├── data.json          # Sound configuration
├── App.jsx            # Main application component
├── main.jsx           # React entry point
└── index.css          # Tailwind imports + custom styles

public/
└── assets/            # Custom SVG icons and audio files
```

## Customization

### Adding New Sounds

1. Add your audio file to `public/assets/`
2. Add your SVG icon to `public/assets/`
3. Update `src/data.json` with your new sound configuration

### JSON Structure

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
          "icon": "icon.svg",
          "file": "sound.mp3",
          "color": "#hexcolor",
          "duration": 0,        // 0 = play full file, >0 = timer in seconds
          "loop": false,        // Default: false for character sounds
          "fadeIn": 0,          // Fade in duration in seconds
          "fadeOut": 0          // Fade out duration in seconds
        }
      ]
    }
  ],
  "environmentSounds": [
    {
      "category": "Background Music",
      "sounds": [
        {
          "id": "env_1",
          "name": "Forest Ambience",
          "type": "Nature",
          "icon": "forest.svg",
          "file": "forest.wav",
          "color": "#10b981",
          "duration": 0,
          "loop": true,         // Default: true for environmental sounds
          "fadeIn": 2.5,
          "fadeOut": 3.0
        }
      ]
    }
  ]
}
```

## Future Enhancements

- **Circular "Wheel" Layout**: Alternative radial arrangement for ambient sounds
- **Keyboard Shortcuts**: Quick access to frequently used sounds
- **Sound Categories**: Advanced filtering and organization
- **Preset Management**: Save and load character/sound configurations
- **Audio Effects**: Reverb, pitch shifting, and other audio processing
- **Desktop App**: Electron/Tauri packaging for standalone desktop application
- **Cloud Sync**: Optional cloud backup for sound configurations
- **Import/Export**: Share sound sets with other users

## License

MIT License
