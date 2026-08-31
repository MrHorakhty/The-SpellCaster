import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()], //[cite: 3]
    // Prevent vite from freezing on rust build files
    server: {
        port: 5173,
        strictPort: true,
        host: host || true, //[cite: 3]
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