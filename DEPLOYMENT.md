# GitHub Pages Deployment Guide

## Prerequisites

Before deploying to GitHub Pages, ensure you have:
- A GitHub account
- Git installed locally
- Node.js and npm installed
- Your Gemini API key ready

## Step 1: Prepare Your Repository

### 1.1 Create GitHub Repository
```bash
# If you haven't already, create a new repository on GitHub
# Example: https://github.com/yourusername/ai-avatar-poc
```

### 1.2 Initialize Git (if not already done)
```bash
cd "/Users/darshgondalia/Desktop/SIC-- Ethan Becker -- PoC - AI avatar"
git init
git add .
git commit -m "Initial commit - AI Avatar PoC"
git branch -M main
git remote add origin https://github.com/yourusername/ai-avatar-poc.git
git push -u origin main
```

## Step 2: Configure SvelteKit for Static Deployment

### 2.1 Install SvelteKit Static Adapter
```bash
npm install -D @sveltejs/adapter-static
```

### 2.2 Update svelte.config.js
Create or update `svelte.config.js` in your project root:

```javascript
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/kit/vite';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		paths: {
			base: process.env.NODE_ENV === 'production' ? '/ai-avatar-poc' : ''
		}
	}
};

export default config;
```

**Note**: Replace `/ai-avatar-poc` with your actual repository name.

### 2.3 Update app.html (if needed)
In `src/app.html`, ensure paths work with the base path:
```html
<link rel="icon" href="%sveltekit.assets%/favicon.ico" />
```

### 2.4 Create +layout.ts for Prerendering
Create `src/routes/+layout.ts`:
```typescript
export const prerender = true;
export const ssr = false;
```

## Step 3: Configure Environment Variables

### 3.1 Update Environment Configuration
GitHub Pages doesn't support server-side environment variables. Update your code to handle this:

In `src/routes/+page.svelte`, update the Gemini configuration:
```typescript
// Update the gemini config to handle production deployment
const geminiConfig: AIServiceConfig = {
	apiKey: import.meta.env.VITE_GEMINI_API_KEY || 
	        // For GitHub Pages, you can embed the key or prompt user
	        prompt('Please enter your Gemini API key:') || 
	        'demo-mode',
	modelName: import.meta.env.VITE_AI_MODEL_NAME || "gemini-1.5-flash",
	rateLimitConfig: {
		maxRequests: 50,
		windowMs: 60000
	}
};
```

### 3.2 Alternative: Runtime Environment Setup
Create a configuration component that prompts for API key on first load:

```typescript
// src/lib/components/ApiKeySetup.svelte
<script lang="ts">
	import { onMount } from 'svelte';
	
	let apiKey = '';
	let isConfigured = false;
	
	onMount(() => {
		const savedKey = localStorage.getItem('gemini-api-key');
		if (savedKey) {
			apiKey = savedKey;
			isConfigured = true;
		}
	});
	
	function saveApiKey() {
		localStorage.setItem('gemini-api-key', apiKey);
		isConfigured = true;
	}
</script>

{#if !isConfigured}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white p-6 rounded-lg max-w-md">
			<h2 class="text-xl font-bold mb-4">Setup Required</h2>
			<p class="mb-4">Please enter your Gemini API key to continue:</p>
			<input 
				bind:value={apiKey} 
				type="password" 
				placeholder="Your Gemini API key..."
				class="w-full p-2 border rounded mb-4"
			/>
			<button 
				on:click={saveApiKey}
				disabled={!apiKey.trim()}
				class="w-full bg-blue-600 text-white p-2 rounded disabled:bg-gray-400"
			>
				Continue
			</button>
		</div>
	</div>
{/if}
```

## Step 4: Create GitHub Actions Workflow

### 4.1 Create Workflow Directory
```bash
mkdir -p .github/workflows
```

### 4.2 Create Deployment Workflow
Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ['main']
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build
        env:
          NODE_ENV: production

      - name: Setup Pages
        uses: actions/configure-pages@v3

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v2
        with:
          path: './build'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```

## Step 5: Update Package.json Scripts

Add or update build scripts in `package.json`:

```json
{
  "scripts": {
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "check:watch": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json --watch"
  }
}
```

## Step 6: Deploy to GitHub Pages

### 6.1 Enable GitHub Pages
1. Go to your repository on GitHub
2. Click on "Settings" tab
3. Scroll down to "Pages" in the left sidebar
4. Under "Source", select "GitHub Actions"
5. Save the settings

### 6.2 Commit and Push
```bash
git add .
git commit -m "Configure for GitHub Pages deployment"
git push origin main
```

### 6.3 Monitor Deployment
1. Go to the "Actions" tab in your GitHub repository
2. Watch the deployment workflow run
3. Once complete, your site will be available at:
   `https://yourusername.github.io/ai-avatar-poc/`

## Step 7: Handle HTTPS and CORS Issues

### 7.1 Update Avatar URLs
Ensure all asset URLs use HTTPS:
```typescript
await avatarService.initialize(avatarContainer, {
    avatarUrl: '/avatars/dominic_animated.glb', // Relative path
    readyPlayerMeUrl: 'https://models.readyplayer.me/your-avatar.glb', // HTTPS
    use3D: true
});
```

### 7.2 Handle Mixed Content
If you encounter mixed content issues, ensure all external resources use HTTPS:
- Ready Player Me avatar URLs
- Any external API calls
- Font and asset references

## Step 8: Verify Deployment

### 8.1 Test Core Features
1. **3D Avatar Loading**: Verify avatar renders correctly
2. **AI Responses**: Test with API key configuration
3. **Speech Synthesis**: Check browser compatibility
4. **Voice Recognition**: Test microphone permissions
5. **Responsive Design**: Test on different screen sizes

### 8.2 Debug Common Issues
- **404 on refresh**: Ensure fallback routing is configured
- **Assets not loading**: Check base path configuration
- **API key issues**: Implement proper key management
- **WebGL errors**: Verify browser WebGL support

## Security Considerations

### 8.1 API Key Management
- Never commit API keys to repository
- Use runtime configuration or user input
- Consider implementing server-side proxy for production

### 8.2 HTTPS Requirements
- GitHub Pages enforces HTTPS
- Ensure all resources use secure connections
- Update any HTTP links to HTTPS

## Troubleshooting

### Build Failures
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Asset Loading Issues
```bash
# Verify build output
ls -la build/
# Check for missing assets
```

### GitHub Actions Failures
1. Check the Actions tab for error details
2. Verify Node.js version compatibility
3. Ensure all dependencies are in package.json
4. Check for TypeScript errors

## Custom Domain (Optional)

If you want to use a custom domain:

1. Add a `CNAME` file to `static/` folder:
```
yourdomain.com
```

2. Configure DNS with your domain provider
3. Enable custom domain in GitHub Pages settings

## Deployment Checklist

- [ ] Repository created and code pushed
- [ ] Static adapter installed and configured  
- [ ] Environment variables handled
- [ ] GitHub Actions workflow created
- [ ] GitHub Pages enabled in repository settings
- [ ] Build successful in Actions tab
- [ ] Site accessible at GitHub Pages URL
- [ ] All features tested and working
- [ ] API key configuration implemented
- [ ] HTTPS and security considerations addressed

Your AI Avatar PoC should now be successfully deployed to GitHub Pages!