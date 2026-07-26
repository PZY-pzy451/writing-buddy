import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
	plugins: [react()],
	clearScreen: false,
	server: {
		port: 1420,
		strictPort: true,
		host: host ?? '127.0.0.1',
		hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
		watch: {
			ignored: ['**/src-tauri/**']
		}
	},
	build: {
		target: 'es2022',
		sourcemap: false,
		cssCodeSplit: true,
		chunkSizeWarningLimit: 3000,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes('monaco-editor')) {
						return 'monaco';
					}
					if (id.includes('react') || id.includes('zustand')) {
						return 'react';
					}
					return undefined;
				}
			}
		}
	}
});
