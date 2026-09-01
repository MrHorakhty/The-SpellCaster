import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const host = process.env.TAURI_DEV_HOST;
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()], //[cite: 3]
    // Inject the app version into the bundle so the About modal never drifts
    define: {
        __APP_VERSION__: JSON.stringify(pkg.version),
    },
    // Prevent vite from freezing on rust build files
    server: {
        port: 5173,
        strictPort: true,
        host: '0.0.0.0', // Bind all interfaces so the Android emulator can reach the dev server
        hmr: host
            ? {
                protocol: "ws",
                host,
                port: 5183,
            }
            : undefined,
        watch: {
            ignored: ["**/src-tauri/**"], //[cite: 3]
        },
    },
})