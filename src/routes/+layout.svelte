<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { 
		capabilities, 
		darkMode, 
		sidebarOpen, 
		settings,
		appActions,
		initializePersistence 
	} from '$lib/stores/appStore';
	import { page } from '$app/stores';

	onMount(() => {
		// Initialize persistence
		initializePersistence();

		// Detect browser capabilities
		const detectedCapabilities = {
			webgl: checkWebGLSupport(),
			speechSynthesis: 'speechSynthesis' in window,
			speechRecognition: 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window,
			indexedDB: 'indexedDB' in window,
			serviceWorker: 'serviceWorker' in navigator
		};

		appActions.setCapabilities(detectedCapabilities);

		console.log('🚀 AI Avatar PoC initialized');
		console.log('📊 Browser capabilities:', detectedCapabilities);
	});

	function checkWebGLSupport(): boolean {
		try {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
			return !!gl;
		} catch (e) {
			return false;
		}
	}

	// Reactive dark mode application
	$: if (typeof document !== 'undefined') {
		if ($darkMode) {
			document.documentElement.classList.add('dark');
		} else {
			document.documentElement.classList.remove('dark');
		}
	}
</script>

<svelte:head>
	<title>AI Avatar PoC - {$page.route?.id === '/' ? 'Motorcycle Coach' : 'Client Portal'}</title>
	<meta name="description" content="Interactive AI Avatar for Client-Coach Portal with Motorcycle Expertise" />
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
	<!-- Navigation Header -->
	<header class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center h-16">
				<!-- Logo and Title -->
				<div class="flex items-center space-x-4">
					<div class="flex-shrink-0">
						<div class="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
							<span class="text-white font-bold text-lg">🤖</span>
						</div>
					</div>
					<div>
						<h1 class="text-xl font-semibold text-gray-900 dark:text-white">
							AI Avatar PoC
						</h1>
						<p class="text-sm text-gray-500 dark:text-gray-400">
							Motorcycle Expert Assistant
						</p>
					</div>
				</div>

				<!-- Status and Controls -->
				<div class="flex items-center space-x-4">
					<!-- Capability Indicators -->
					<div class="hidden sm:flex items-center space-x-2 text-xs">
						<span class="flex items-center space-x-1" class:text-green-600={$capabilities.webgl} class:text-gray-400={!$capabilities.webgl}>
							<div class="w-2 h-2 rounded-full" class:bg-green-500={$capabilities.webgl} class:bg-gray-400={!$capabilities.webgl}></div>
							<span>3D</span>
						</span>
						<span class="flex items-center space-x-1" class:text-green-600={$capabilities.speechSynthesis} class:text-gray-400={!$capabilities.speechSynthesis}>
							<div class="w-2 h-2 rounded-full" class:bg-green-500={$capabilities.speechSynthesis} class:bg-gray-400={!$capabilities.speechSynthesis}></div>
							<span>TTS</span>
						</span>
						<span class="flex items-center space-x-1" class:text-green-600={$capabilities.speechRecognition} class:text-gray-400={!$capabilities.speechRecognition}>
							<div class="w-2 h-2 rounded-full" class:bg-green-500={$capabilities.speechRecognition} class:bg-gray-400={!$capabilities.speechRecognition}></div>
							<span>STT</span>
						</span>
					</div>

					<!-- Dark Mode Toggle -->
					<button 
						on:click={appActions.toggleDarkMode}
						class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
						aria-label="Toggle dark mode"
					>
						{#if $darkMode}
							<span class="text-yellow-500">☀️</span>
						{:else}
							<span class="text-gray-600">🌙</span>
						{/if}
					</button>

					<!-- Settings Menu -->
					<div class="relative">
						<button 
							on:click={appActions.toggleSidebar}
							class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
							aria-label="Toggle settings"
						>
							<span class="text-gray-600 dark:text-gray-300">⚙️</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content -->
	<main class="flex-1">
		<slot />
	</main>

	<!-- Settings Sidebar -->
	{#if $sidebarOpen}
		<div class="fixed inset-0 z-50 lg:hidden">
			<div class="fixed inset-0 bg-black/50" on:click={appActions.toggleSidebar} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && appActions.toggleSidebar()}></div>
			<div class="fixed right-0 top-0 h-full w-80 bg-white dark:bg-gray-800 shadow-xl transform transition-transform">
				<div class="p-6">
					<div class="flex items-center justify-between mb-6">
						<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
						<button on:click={appActions.toggleSidebar} class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
							✕
						</button>
					</div>
					
					<div class="space-y-4">
						<!-- Avatar Settings -->
						<div>
							<h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Avatar</h3>
							<div class="space-y-2">
								<label class="flex items-center">
									<input 
										type="checkbox" 
										bind:checked={$settings.avatarAnimationEnabled}
										class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
									/>
									<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Enable animations</span>
								</label>
								<label class="flex items-center">
									<input 
										type="checkbox" 
										bind:checked={$settings.soundEffectsEnabled}
										class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
									/>
									<span class="ml-2 text-sm text-gray-700 dark:text-gray-300">Sound effects</span>
								</label>
							</div>
						</div>

						<!-- API Settings -->
						<div>
							<h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">API</h3>
							<div class="space-y-2">
								<div>
									<label for="rate-limit-input" class="block text-xs text-gray-500 dark:text-gray-400">Rate limit (requests/min)</label>
									<input 
										id="rate-limit-input"
										type="number" 
										bind:value={$settings.apiRateLimit}
										min="10" 
										max="100" 
										class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
									/>
								</div>
							</div>
						</div>

						<!-- Capabilities Status -->
						<div>
							<h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Browser Support</h3>
							<div class="space-y-1 text-xs">
								<div class="flex justify-between">
									<span class="text-gray-600 dark:text-gray-400">WebGL:</span>
									<span class:text-green-600={$capabilities.webgl} class:text-red-600={!$capabilities.webgl}>
										{$capabilities.webgl ? 'Supported' : 'Not supported'}
									</span>
								</div>
								<div class="flex justify-between">
									<span class="text-gray-600 dark:text-gray-400">Speech Synthesis:</span>
									<span class:text-green-600={$capabilities.speechSynthesis} class:text-red-600={!$capabilities.speechSynthesis}>
										{$capabilities.speechSynthesis ? 'Supported' : 'Not supported'}
									</span>
								</div>
								<div class="flex justify-between">
									<span class="text-gray-600 dark:text-gray-400">Speech Recognition:</span>
									<span class:text-green-600={$capabilities.speechRecognition} class:text-red-600={!$capabilities.speechRecognition}>
										{$capabilities.speechRecognition ? 'Supported' : 'Not supported'}
									</span>
								</div>
								<div class="flex justify-between">
									<span class="text-gray-600 dark:text-gray-400">IndexedDB:</span>
									<span class:text-green-600={$capabilities.indexedDB} class:text-red-600={!$capabilities.indexedDB}>
										{$capabilities.indexedDB ? 'Supported' : 'Not supported'}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	:global(html) {
		scroll-behavior: smooth;
	}
</style>