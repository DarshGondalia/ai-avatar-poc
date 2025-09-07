<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { 
		messages, 
		avatar, 
		capabilities, 
		appActions 
	} from '$lib/stores/appStore';
	import { getAIService } from '$lib/services/aiService';
	import { speechService } from '$lib/services/speechService';
	import { avatarService } from '$lib/services/avatarService';
	import type { AIServiceConfig } from '$lib/services/aiService';
	import type { Message } from '$lib/stores/appStore';
	
	let avatarContainer: HTMLElement;
	let messageInput = '';
	let isRecording = false;
	let aiService: ReturnType<typeof getAIService> | null = null;
	let isLoading = false;
	let errorMessage = '';
	let chatContainer: HTMLElement;
	let isSpeaking = false;
	let shouldAutoScroll = true;
	let speechEnabled = false; // Global speech toggle

	// API key state management for GitHub Pages deployment
	let apiKey = '';
	let showApiKeySetup = false;

	// Gemini API configuration with runtime key handling
	const getGeminiConfig = (): AIServiceConfig => ({
		apiKey: apiKey || import.meta.env.VITE_GEMINI_API_KEY || '',
		modelName: import.meta.env.VITE_AI_MODEL_NAME || "gemini-1.5-flash",
		rateLimitConfig: {
			maxRequests: 50,
			windowMs: 60000
		}
	});

	// Check for saved API key on load
	function loadApiKey() {
		if (typeof localStorage !== 'undefined') {
			const savedKey = localStorage.getItem('gemini-api-key');
			if (savedKey) {
				apiKey = savedKey;
				return true;
			}
		}
		return false;
	}

	// Save API key to localStorage
	function saveApiKey() {
		if (typeof localStorage !== 'undefined' && apiKey.trim()) {
			localStorage.setItem('gemini-api-key', apiKey.trim());
			showApiKeySetup = false;
			// Reinitialize AI service with new key
			initializeAIService();
		}
	}

	// Separate AI service initialization function
	function initializeAIService() {
		try {
			const config = getGeminiConfig();
			if (config.apiKey && config.apiKey !== "your-gemini-api-key") {
				aiService = getAIService(config);
				console.log('✅ AI Service initialized');
				errorMessage = '';
			} else {
				console.warn('⚠️ Gemini API key not set. AI features disabled.');
				showApiKeySetup = true;
			}
		} catch (error) {
			console.error('AI service initialization failed:', error);
			errorMessage = 'AI service unavailable. Please check your configuration.';
		}
	}

	onMount(async () => {
		// Load saved API key first
		const hasApiKey = loadApiKey();
		
		// Initialize avatar service
		if (avatarContainer) {
			try {
				await avatarService.initialize(avatarContainer, {
					avatarUrl: '/avatars/dominic_animated.glb',
					body: 'M',
					mood: 'professional',
					voice: 'en-US-Standard-B',
					language: 'en-US',
					readyPlayerMeUrl: '/avatars/dominic_animated.glb',
					use3D: true
				});

				appActions.updateAvatarState({ 
					isVisible: true, 
					status: 'idle',
					emotion: 'neutral'
				});

				console.log('✅ Avatar initialized');
			} catch (error) {
				console.error('Avatar initialization failed:', error);
				errorMessage = 'Avatar initialization failed. Using fallback mode.';
			}
		}

		// Initialize AI service
		initializeAIService();

		// Initialize speech recognition
		speechService.onRecognitionResult((result) => {
			if (result.isFinal && result.transcript.trim()) {
				messageInput = result.transcript.trim();
				sendMessage();
			}
		});

		// Add welcome message
		const welcomeMessage = "Hey there! I'm Dominic Toretto, your passionate Triumph motorcycle specialist. I've got over 20 years of experience working exclusively with Triumph bikes - from classic Bonnevilles to modern Speed Triples. What Triumph question can I help you with today?";
		
		appActions.addMessage({
			type: 'assistant',
			content: welcomeMessage,
			metadata: { avatarEmotion: 'happy' }
		});

		// Don't auto-speak welcome message, let user enable speech manually
	});

	onDestroy(() => {
		if (avatarService) {
			avatarService.destroy();
		}
		speechService.stopListening();
		speechService.stopSpeaking();
	});

	async function sendMessage() {
		if (!messageInput.trim()) return;

		const userMessage = messageInput.trim();
		messageInput = '';
		isLoading = true;

		// Add user message
		appActions.addMessage({
			type: 'user',
			content: userMessage
		});

		// Update avatar state
		appActions.updateAvatarState({ status: 'thinking', emotion: 'focused' });
		avatarService.setStatus('thinking');
		avatarService.setEmotion('focused');

		try {
			if (aiService) {
				// Get conversation history
				const history = $messages
					.slice(-10)
					.map(msg => ({
						role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
						content: msg.content
					}));

				// Generate AI response
				const response = await aiService.generateResponse(userMessage, history);
				
				// Add AI response
				appActions.addMessage({
					type: 'assistant',
					content: response.content,
					metadata: {
						confidence: response.confidence,
						processingTime: response.processingTime,
						avatarEmotion: response.emotion
					}
				});

				// Update avatar emotion
				if (response.emotion) {
					appActions.updateAvatarState({ emotion: response.emotion as any });
					avatarService.setEmotion(response.emotion as any);
				}

				// Skip fun animation during automatic speech - it interferes with speech animation
				// await avatarService.playFunAnimation();
				
				// Automatically enable speaker and start speaking the response
				if (!speechEnabled) {
					speechEnabled = true;
					console.log('🎭 Auto-enabled speaker for response');
				}
				
				// Small delay before speech starts
				await new Promise(resolve => setTimeout(resolve, 200));
				await speakResponse(response.content);
				
				// Note: Speaker will be auto-disabled in speakResponse finally block

			} else {
				// Fallback response
				const fallbackResponse = "Sorry, having some technical difficulties but I'm passionate about helping fellow Triumph riders! Tell me about your Triumph - model, year, and what's happening. My 20+ years with these beautiful machines will guide us through!";
				
				appActions.addMessage({
					type: 'assistant',
					content: fallbackResponse,
					metadata: { avatarEmotion: 'concerned' }
				});

				// Skip fun animation during automatic speech - it interferes with speech animation
				// await avatarService.playFunAnimation();
				
				// Automatically enable speaker and start speaking the response
				if (!speechEnabled) {
					speechEnabled = true;
					console.log('🎭 Auto-enabled speaker for fallback response');
				}
				
				await new Promise(resolve => setTimeout(resolve, 200));
				await speakResponse(fallbackResponse);
				
				// Note: Speaker will be auto-disabled in speakResponse finally block
			}

		} catch (error) {
			console.error('Error processing message:', error);
			
			const errorResponse = "Sorry mate, having some technical hiccups! But I'm still passionate about helping with your Triumph. What's happening with your bike? My years of Triumph experience are still here to guide you!";
			
			appActions.addMessage({
				type: 'assistant',
				content: errorResponse,
				metadata: { avatarEmotion: 'concerned' }
			});

			// Skip fun animation during automatic speech - it interferes with speech animation
			// await avatarService.playFunAnimation();
			
			// Automatically enable speaker and start speaking the response
			if (!speechEnabled) {
				speechEnabled = true;
				console.log('🎭 Auto-enabled speaker for error response');
			}
			
			await new Promise(resolve => setTimeout(resolve, 200));
			await speakResponse(errorResponse);
			
			// Note: Speaker will be auto-disabled in speakResponse finally block
		} finally {
			isLoading = false;
			appActions.updateAvatarState({ status: 'idle' });
			avatarService.setStatus('idle');
		}
	}

	async function speakResponse(text: string) {
		try {
			console.log('🗣️ Starting speech for:', text.substring(0, 50) + '...');
			isSpeaking = true;
			appActions.updateAvatarState({ status: 'speaking', currentText: text });
			avatarService.setStatus('speaking');
			
			// Start animation loop when speech begins
			avatarService.startAnimationLoop();
			console.log('🎭 Started animation for speech');
			
			// Always use speech service directly for more reliable speech
			await speechService.speak(text, {
				rate: 0.9,
				pitch: 0.8,
				volume: 1.0
			});
			
			console.log('✅ Speech completed');
		} catch (error) {
			console.error('❌ Speech error:', error);
		} finally {
			isSpeaking = false;
			appActions.updateAvatarState({ status: 'idle' });
			avatarService.setStatus('idle');
			
			// Stop animation after speech is completely finished
			avatarService.stopAnimationLoop();
			console.log('🎭 Stopped animation after speech completed');
			
			// Auto-disable speaker after speech is completely finished
			if (speechEnabled) {
				speechEnabled = false;
				console.log('🎭 Auto-disabled speaker after speech completed');
			}
		}
	}

	async function toggleSpeaking() {
		if (speechEnabled && isSpeaking) {
			// Stop current speech
			speechService.stopSpeaking();
			avatarService.stopSpeaking();
			isSpeaking = false;
			appActions.updateAvatarState({ status: 'idle' });
			avatarService.setStatus('idle');
		}
		
		// Toggle speech feature on/off
		speechEnabled = !speechEnabled;
		
		if (speechEnabled) {
			// Start animation loop
			avatarService.startAnimationLoop();
			
			// If turning speech on, speak the latest assistant message
			const lastAssistantMessage = $messages.filter(m => m.type === 'assistant').pop();
			if (lastAssistantMessage && !isSpeaking) {
				await speakResponse(lastAssistantMessage.content);
			}
		} else {
			// If turning speech off, stop any current speech and animation
			speechService.stopSpeaking();
			avatarService.stopSpeaking();
			avatarService.stopAnimationLoop();
			isSpeaking = false;
			appActions.updateAvatarState({ status: 'idle' });
			avatarService.setStatus('idle');
		}
	}

	async function startRecording() {
		if (!$capabilities.speechRecognition) {
			errorMessage = 'Speech recognition not supported in your browser.';
			return;
		}

		try {
			console.log('🎤 Starting recording...');
			appActions.updateAvatarState({ status: 'listening' });
			avatarService.setStatus('listening');
			await speechService.startListening();
			isRecording = true;
		} catch (error) {
			console.error('Recording error:', error);
			errorMessage = 'Failed to start voice recognition.';
			isRecording = false;
		}
	}

	function stopRecording() {
		try {
			console.log('🎤 Stopping recording...');
			speechService.stopListening();
			appActions.updateAvatarState({ status: 'idle' });
			avatarService.setStatus('idle');
			isRecording = false;
		} catch (error) {
			console.error('Stop recording error:', error);
		}
	}

	function clearChat() {
		appActions.clearMessages();
		appActions.addMessage({
			type: 'assistant',
			content: "Chat cleared! What Triumph question can I help you with now?",
			metadata: { avatarEmotion: 'happy' }
		});
	}

	async function fullReset() {
		try {
			console.log('🔄 FULL RESET: Stopping everything and resetting to initial state');
			
			// Stop any current speech immediately
			speechService.stopSpeaking();
			speechService.stopListening();
			
			// Stop avatar speaking and animation
			avatarService.stopSpeaking();
			avatarService.stopAnimationLoop();
			avatarService.fullReset();
			
			// Reset all state variables
			isSpeaking = false;
			isRecording = false;
			speechEnabled = false;
			isLoading = false;
			errorMessage = '';
			messageInput = '';
			
			// Reset avatar state
			appActions.updateAvatarState({ 
				status: 'idle',
				emotion: 'neutral',
				currentText: ''
			});
			avatarService.setStatus('idle');
			avatarService.setEmotion('neutral');
			
			// Clear all messages and add fresh welcome message
			appActions.clearMessages();
			const welcomeMessage = "Hey there! I'm Dominic Toretto, your passionate Triumph motorcycle specialist. I've got over 20 years of experience working exclusively with Triumph bikes - from classic Bonnevilles to modern Speed Triples. What Triumph question can I help you with today?";
			
			appActions.addMessage({
				type: 'assistant',
				content: welcomeMessage,
				metadata: { avatarEmotion: 'happy' }
			});
			
			console.log('✅ FULL RESET: Everything reset to initial state');
			
		} catch (error) {
			console.error('❌ Error during full reset:', error);
		}
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	// Smart auto-scroll - only scroll if user is already at bottom
	$: if (chatContainer && $messages.length > 0 && shouldAutoScroll) {
		// Use requestAnimationFrame for smoother scrolling
		requestAnimationFrame(() => {
			if (chatContainer && shouldAutoScroll) {
				chatContainer.scrollTo({
					top: chatContainer.scrollHeight,
					behavior: 'smooth'
				});
			}
		});
	}

	let scrollTimeout: number;
	function handleScroll() {
		if (chatContainer) {
			// Debounce scroll handler to reduce glitchiness
			clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(() => {
				const { scrollTop, scrollHeight, clientHeight } = chatContainer;
				// Check if user is near the bottom (within 30px)
				shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 30;
			}, 50);
		}
	}
</script>

<div class="container mx-auto px-4 py-8 max-w-7xl min-h-screen">
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 min-h-[calc(100vh-8rem)]">
		<!-- Avatar Section -->
		<div class="flex flex-col">
			<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 flex-1">
				<div class="flex items-center justify-between mb-6">
					<div>
						<h2 class="text-2xl font-bold text-gray-900 dark:text-white">Dominic Toretto</h2>
						<p class="text-gray-600 dark:text-gray-400">20+ years of experience</p>
					</div>
					<div class="flex items-center space-x-2">
						<div 
							class="w-3 h-3 rounded-full"
							class:bg-green-500={$avatar.status === 'idle'}
							class:bg-yellow-500={$avatar.status === 'listening'}
							class:bg-blue-500={$avatar.status === 'speaking'}
							class:bg-purple-500={$avatar.status === 'thinking'}
						></div>
						<span class="text-sm text-gray-500 dark:text-gray-400 capitalize">
							{$avatar.status}
						</span>
					</div>
				</div>

				<!-- Avatar Container -->
				<div 
					bind:this={avatarContainer}
					class="avatar-container flex-1 min-h-[400px] bg-white rounded-xl shadow-inner w-full"
					class:avatar-speaking={$avatar.status === 'speaking'}
					class:avatar-listening={$avatar.status === 'listening'}
					class:avatar-thinking={$avatar.status === 'thinking'}
					style="margin: 0; padding: 0;"
				>
					<!-- Avatar will be rendered here -->
				</div>

				<!-- Avatar Controls -->
				<div class="mt-6 flex justify-center space-x-4">
					<button
						on:mousedown={startRecording}
						on:mouseup={stopRecording}
						on:mouseleave={stopRecording}
						on:touchstart={startRecording}
						on:touchend={stopRecording}
						disabled={!$capabilities.speechRecognition}
						class="p-3 rounded-full transition-all duration-200 select-none"
						class:bg-red-500={isRecording}
						class:bg-primary-600={!isRecording && $capabilities.speechRecognition}
						class:bg-gray-400={!$capabilities.speechRecognition}
						class:text-white={$capabilities.speechRecognition}
						class:hover:bg-red-600={isRecording}
						class:hover:bg-primary-700={!isRecording && $capabilities.speechRecognition}
						class:cursor-not-allowed={!$capabilities.speechRecognition}
						class:ring-4={isRecording}
						class:ring-red-300={isRecording}
						class:animate-pulse={isRecording}
						title={isRecording ? 'Recording... Release to stop' : 'Hold to record voice input'}
					>
						{#if isRecording}
							🛑
						{:else}
							🎤
						{/if}
					</button>

					<button
						on:click={toggleSpeaking}
						class="p-3 rounded-full transition-colors"
						class:bg-green-600={speechEnabled}
						class:bg-gray-600={!speechEnabled}
						class:hover:bg-green-700={speechEnabled}
						class:hover:bg-gray-700={!speechEnabled}
						class:text-white={true}
						class:ring-2={speechEnabled && isSpeaking}
						class:ring-green-300={speechEnabled && isSpeaking}
						title={speechEnabled ? 'Speech On - Click to Disable' : 'Speech Off - Click to Enable'}
					>
						{#if speechEnabled}
							{#if isSpeaking}
								🔊
							{:else}
								🔊
							{/if}
						{:else}
							🔇
						{/if}
					</button>

					<button
						on:click={clearChat}
						class="p-3 rounded-full bg-gray-600 hover:bg-gray-700 text-white transition-colors"
						title="Clear Chat"
					>
						🗑️
					</button>

					<button
						on:click={fullReset}
						class="p-3 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
						title="Full Reset - Stop everything and reset to beginning"
					>
						🔄
					</button>
				</div>
			</div>
		</div>

		<!-- Chat Section -->
		<div class="flex flex-col">
			<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex-1 flex flex-col max-h-[calc(100vh-8rem)]">
				<!-- Chat Header -->
				<div class="p-6 border-b border-gray-200 dark:border-gray-700">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Chat with Dominic</h3>
					<p class="text-sm text-gray-600 dark:text-gray-400">Ask about Triumph motorcycle maintenance, repairs, and troubleshooting</p>
				</div>

				<!-- Messages -->
				<div 
					bind:this={chatContainer}
					on:scroll={handleScroll}
					class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar min-h-0"
				>
					{#each $messages as message (message.id)}
						<div class="flex" class:justify-end={message.type === 'user'}>
							<div 
								class="chat-bubble"
								class:user={message.type === 'user'}
								class:assistant={message.type === 'assistant'}
							>
								<div class="text-sm">
									{message.content}
								</div>
								{#if message.metadata?.processingTime}
									<div class="text-xs opacity-60 mt-1">
										{message.metadata.processingTime}ms
									</div>
								{/if}
							</div>
						</div>
					{/each}

					{#if isLoading}
						<div class="flex">
							<div class="chat-bubble assistant">
								<div class="loading-dots">
									<div style="--i: 0"></div>
									<div style="--i: 1"></div>
									<div style="--i: 2"></div>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Input Area -->
				<div class="p-6 border-t border-gray-200 dark:border-gray-700">
					{#if errorMessage}
						<div class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
							<p class="text-sm text-yellow-800 dark:text-yellow-200">{errorMessage}</p>
							<button 
								on:click={() => errorMessage = ''}
								class="text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 text-xs underline"
							>
								Dismiss
							</button>
						</div>
					{/if}

					<div class="flex space-x-4">
						<div class="flex-1">
							<textarea
								bind:value={messageInput}
								on:keydown={handleKeyDown}
								placeholder="Ask about Triumph issues, maintenance, or repairs..."
								class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
								rows="3"
								disabled={isLoading}
							></textarea>
						</div>
						<button
							on:click={sendMessage}
							disabled={isLoading || !messageInput.trim()}
							class="px-6 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
						>
							{#if isLoading}
								⏳
							{:else}
								Send
							{/if}
						</button>
					</div>

					<div class="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
						<span>Press Enter to send, Shift+Enter for new line</span>
						{#if $capabilities.speechRecognition}
							<span>🎤 Voice input available</span>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<!-- API Key Setup Modal for GitHub Pages -->
{#if showApiKeySetup}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
		<div class="bg-white dark:bg-gray-800 p-8 rounded-2xl max-w-md mx-4 shadow-2xl">
			<h2 class="text-2xl font-bold mb-4 text-gray-900 dark:text-white">🔑 API Key Setup</h2>
			<p class="mb-4 text-gray-600 dark:text-gray-400">
				To use AI features, please enter your Gemini API key. 
				<a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" class="text-blue-600 underline">
					Get your free API key here
				</a>
			</p>
			<input 
				bind:value={apiKey} 
				type="password" 
				placeholder="Enter your Gemini API key..."
				class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg mb-4 focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
				on:keydown={(e) => e.key === 'Enter' && saveApiKey()}
			/>
			<div class="flex space-x-3">
				<button 
					on:click={saveApiKey}
					disabled={!apiKey.trim()}
					class="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white p-3 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
				>
					Save & Continue
				</button>
				<button 
					on:click={() => showApiKeySetup = false}
					class="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
				>
					Skip
				</button>
			</div>
			<p class="text-xs text-gray-500 dark:text-gray-400 mt-3">
				Your API key is stored locally in your browser and never shared.
			</p>
		</div>
	</div>
{/if}