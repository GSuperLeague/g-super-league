import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath, URL} from 'node:url';
export default defineConfig({plugins:[react()],base:process.env.VITE_BASE_PATH||'/g-super-league/',resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}}});
