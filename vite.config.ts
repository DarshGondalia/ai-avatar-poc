import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['three', '@google/generative-ai']
	},
	build: {
		target: 'es2020'
	},
	ssr: {
		noExternal: ['three']
	}
});