import { browser } from '$app/environment';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface AvatarConfig {
	avatarUrl?: string;
	body?: 'M' | 'F';
	mood?: string;
	voice?: string;
	language?: string;
	readyPlayerMeUrl?: string;
	use3D?: boolean;
}

export interface EmotionMapping {
	neutral: string;
	happy: string;
	concerned: string;
	focused: string;
	encouraging: string;
}

export class AvatarService {
	private isInitialized = false;
	private currentEmotion = 'neutral';
	private isWebGLSupported = false;
	private fallbackMode = true;
	private use3D = false;
	
	// Three.js components for 3D avatar
	private scene?: THREE.Scene;
	private camera?: THREE.PerspectiveCamera;
	private renderer?: THREE.WebGLRenderer;
	private avatarModel?: THREE.Group;
	private mixer?: THREE.AnimationMixer;
	private animationActions: { [key: string]: THREE.AnimationAction } = {};
	private currentAnimation?: THREE.AnimationAction;
	private morphTargets: { [key: string]: THREE.Mesh } = {};
	private clock = new THREE.Clock();
	private container?: HTMLElement;

	private emotionMappings: EmotionMapping = {
		neutral: 'neutral',
		happy: 'happy',
		concerned: 'sad',
		focused: 'focused', 
		encouraging: 'excited'
	};

	constructor() {
		if (browser) {
			this.checkWebGLSupport();
		}
	}

	private checkWebGLSupport(): void {
		try {
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
			this.isWebGLSupported = !!gl;
			
			if (!this.isWebGLSupported) {
				console.warn('⚠️ WebGL not supported. Avatar will use fallback mode.');
				this.fallbackMode = true;
			}
		} catch (e) {
			this.isWebGLSupported = false;
			this.fallbackMode = true;
		}
	}

	async initialize(container: HTMLElement, config: AvatarConfig = {}): Promise<void> {
		if (!browser) {
			throw new Error('Avatar service can only be initialized in browser environment');
		}

		this.container = container;
		this.use3D = (config.use3D ?? false) && this.isWebGLSupported;

		try {
			if (this.use3D && config.readyPlayerMeUrl) {
				await this.initialize3DAvatar(container, config);
				console.log('✅ Avatar service initialized with 3D Ready Player Me avatar');
			} else {
				await this.initializeFallback(container, config);
				console.log('✅ Avatar service initialized in fallback mode');
			}
		} catch (error) {
			console.error('❌ Avatar initialization failed:', error);
			// Fallback to 2D avatar on 3D initialization failure
			if (this.use3D) {
				this.use3D = false;
				this.fallbackMode = true;
				await this.initializeFallback(container, config);
				console.log('✅ Fallen back to 2D avatar');
			} else {
				throw error;
			}
		}
	}

	private async initialize3DAvatar(container: HTMLElement, config: AvatarConfig): Promise<void> {
		// Clear container
		container.innerHTML = '';
		
		// Create Three.js scene
		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
		
		// Create WebGL renderer
		this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		this.renderer.setSize(container.clientWidth, container.clientHeight);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		this.renderer.setClearColor(0x000000, 0); // Transparent background
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		
		container.appendChild(this.renderer.domElement);
		
		// Enhanced lighting setup to make avatar the focal point
		
		// Soft ambient lighting for overall illumination
		const ambientLight = new THREE.AmbientLight(0x404040, 0.4); // Reduced intensity for more dramatic lighting
		this.scene.add(ambientLight);
		
		// Main key light - positioned to highlight the avatar's face
		const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
		keyLight.position.set(2, 3, 3);
		keyLight.castShadow = true;
		keyLight.shadow.mapSize.width = 2048;
		keyLight.shadow.mapSize.height = 2048;
		keyLight.shadow.camera.near = 0.5;
		keyLight.shadow.camera.far = 10;
		keyLight.shadow.camera.left = -2;
		keyLight.shadow.camera.right = 2;
		keyLight.shadow.camera.top = 2;
		keyLight.shadow.camera.bottom = -2;
		this.scene.add(keyLight);
		
		// Fill light - softer light from the opposite side to reduce harsh shadows
		const fillLight = new THREE.DirectionalLight(0x87ceeb, 0.4); // Slight blue tint
		fillLight.position.set(-2, 2, 2);
		this.scene.add(fillLight);
		
		// Rim light - backlight to create separation from background
		const rimLight = new THREE.DirectionalLight(0xffd700, 0.6); // Golden rim light
		rimLight.position.set(0, 2, -3);
		this.scene.add(rimLight);
		
		// Point light for additional face illumination
		const pointLight = new THREE.PointLight(0xffffff, 0.8, 4);
		pointLight.position.set(0, 2, 2);
		this.scene.add(pointLight);
		
		// Remove background plane - avatar will be on transparent background
		
		// Position camera with 30% zoom in from previous position
		this.camera.position.set(0, 0.8, 1.54); // 30% closer: 2.2 * 0.7 = 1.54
		this.camera.lookAt(0, 0.8, 0); // Look at torso level for better framing
		
		// Load Ready Player Me avatar
		if (config.readyPlayerMeUrl) {
			await this.loadReadyPlayerMeAvatar(config.readyPlayerMeUrl);
		}
		
		// Setup animation loop
		this.animate();
		
		// Handle window resize (only in browser)
		if (browser && typeof window !== 'undefined') {
			window.addEventListener('resize', this.onWindowResize.bind(this));
		}
		
		this.isInitialized = true;
		this.fallbackMode = false;
	}

	private async loadReadyPlayerMeAvatar(avatarUrl: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const loader = new GLTFLoader();
			
			loader.load(
				avatarUrl,
				(gltf) => {
					this.avatarModel = gltf.scene;
					this.scene?.add(this.avatarModel);
					
					// Enhanced animation detection and logging
					console.log('🎭 =================================');
					console.log('🎭 DOMINIC ANIMATED GLB LOADED');
					console.log('🎭 =================================');
					console.log(`🎭 GLB file structure:`);
					console.log(`🎭 - Scene objects: ${gltf.scene.children.length}`);
					console.log(`🎭 - Animations array length: ${gltf.animations.length}`);
					console.log(`🎭 - Available animations:`, gltf.animations);
					
					if (gltf.animations.length > 0) {
						this.mixer = new THREE.AnimationMixer(this.avatarModel);
						console.log(`🎭 Total animations found: ${gltf.animations.length}`);
						console.log('🎭 All available animations:');
						
						// Enhanced animation analysis
						gltf.animations.forEach((clip, index) => {
							const action = this.mixer!.clipAction(clip);
							this.animationActions[clip.name] = action;
							
							console.log(`🎭 ${index + 1}. "${clip.name}"`);
							console.log(`   - Duration: ${clip.duration.toFixed(2)}s`);
							console.log(`   - Tracks: ${clip.tracks.length}`);
							
							// Analyze track types
							const trackTypes = new Set(clip.tracks.map(track => {
								const parts = track.name.split('.');
								return parts[parts.length - 1];
							}));
							console.log(`   - Track types: ${Array.from(trackTypes).join(', ')}`);
						});
						
						console.log('🎭 =================================');
						
						// Set avatar to beginning of animation and freeze it there
						if (gltf.animations.length > 0) {
							const firstAnimation = Object.keys(this.animationActions)[0];
							console.log('🎭 Setting avatar to beginning of animation and freezing:', firstAnimation);
							
							// Start animation at frame 0 and immediately pause
							this.playAnimation(firstAnimation, false);
							if (this.currentAnimation) {
								this.currentAnimation.time = 0;
								this.currentAnimation.paused = true;
								console.log('🎭 Avatar loaded at animation start pose (frame 0, paused)');
							}
						} else {
							console.log('🎭 Avatar loaded with default static pose (no animations available)');
						}
					} else {
						console.log('🎭 ❌ NO ANIMATIONS FOUND in GLB file - avatar will be static');
					}
					
					// Setup morph targets for facial expressions
					this.avatarModel.traverse((child) => {
						if (child instanceof THREE.Mesh && child.morphTargetInfluences) {
							this.morphTargets[child.name] = child;
						}
					});
					
					// Scale and position avatar
					this.avatarModel.scale.set(1, 1, 1);
					// Position avatar slightly up so feet are visible
					this.avatarModel.position.set(0, -0.2, 0);
					
					console.log('✅ Ready Player Me avatar loaded successfully');
					resolve();
				},
				(progress) => {
					console.log('Loading avatar...', (progress.loaded / progress.total * 100) + '%');
				},
				(error) => {
					console.error('❌ Error loading Ready Player Me avatar:', error);
					reject(error);
				}
			);
		});
	}

	private animate(): void {
		if (!this.renderer || !this.scene || !this.camera) return;
		
		requestAnimationFrame(this.animate.bind(this));
		
		const deltaTime = this.clock.getDelta();
		
		// Update animation mixer
		if (this.mixer) {
			this.mixer.update(deltaTime);
		}
		
		// Render scene
		this.renderer.render(this.scene, this.camera);
	}

	private onWindowResize(): void {
		if (!this.camera || !this.renderer || !this.container) return;
		
		const width = this.container.clientWidth;
		const height = this.container.clientHeight;
		
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.renderer.setSize(width, height);
	}

	private playAnimation(animationName: string, loop = true, blendTime = 0.5): void {
		if (!this.mixer || !this.animationActions[animationName]) {
			console.log(`🎭 Animation "${animationName}" not found in loaded actions:`, Object.keys(this.animationActions));
			return;
		}
		
		console.log(`🎭 Playing animation: ${animationName} (loop: ${loop})`);
		
		// Stop current animation with smooth transition
		if (this.currentAnimation && this.currentAnimation !== this.animationActions[animationName]) {
			this.currentAnimation.fadeOut(blendTime);
		}
		
		// Play new animation with smooth transition
		const action = this.animationActions[animationName];
		action.reset();
		action.fadeIn(blendTime);
		action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
		
		// Set animation properties for smoother playback
		action.clampWhenFinished = !loop;
		action.timeScale = 1; // Normal speed
		
		// Add easing for more natural movement
		action.setEffectiveWeight(1);
		
		action.play();
		
		this.currentAnimation = action;
	}

	private setMorphTarget(meshName: string, targetName: string, influence: number): void {
		const mesh = this.morphTargets[meshName];
		if (!mesh || !mesh.morphTargetDictionary) return;
		
		const targetIndex = mesh.morphTargetDictionary[targetName];
		if (targetIndex !== undefined && mesh.morphTargetInfluences) {
			mesh.morphTargetInfluences[targetIndex] = influence;
		}
	}


	private breathingInterval: number | null = null;

	private startManualBreathingLoop(): void {
		if (this.breathingInterval) return; // Already running
		
		console.log('🎭 Starting manual breathing animation as fallback');
		
		this.breathingInterval = setInterval(() => {
			if (this.avatarModel) {
				// Subtle breathing animation
				const time = Date.now() * 0.002;
				const breathScale = 1 + Math.sin(time) * 0.02; // 2% scale variation
				const headBob = Math.sin(time * 0.8) * 0.01; // Subtle head movement
				
				this.avatarModel.scale.setScalar(breathScale);
				this.avatarModel.position.y = headBob;
			}
		}, 16); // ~60fps
	}

	private stopManualBreathingLoop(): void {
		if (this.breathingInterval) {
			clearInterval(this.breathingInterval);
			this.breathingInterval = null;
			console.log('🎭 Manual breathing animation stopped');
			
			// Reset to default position
			if (this.avatarModel) {
				this.avatarModel.scale.setScalar(1);
				this.avatarModel.position.y = -0.2; // Maintain consistent positioning
			}
		}
	}

	startAnimationLoop(): void {
		console.log('🎭 Starting animation loop');
		
		if (!this.use3D || this.fallbackMode) {
			const character = document.querySelector('.avatar-character');
			if (character) {
				character.classList.add('speaking-active');
			}
			return;
		}

		const availableAnimations = Object.keys(this.animationActions);
		if (availableAnimations.length > 0) {
			const singleAnimation = availableAnimations[0];
			console.log('🎭 Starting loop:', singleAnimation);
			this.playAnimation(singleAnimation, true); // true = loop continuously
		} else {
			this.startManualBreathingLoop();
		}
	}

	stopAnimationLoop(): void {
		console.log('🎭 Stopping animation loop');
		
		if (!this.use3D || this.fallbackMode) {
			const character = document.querySelector('.avatar-character');
			if (character) {
				character.classList.remove('speaking-active');
			}
			return;
		}

		// Reset to beginning pose
		const availableAnimations = Object.keys(this.animationActions);
		if (availableAnimations.length > 0) {
			const singleAnimation = availableAnimations[0];
			console.log('🎭 Resetting to start pose:', singleAnimation);
			
			this.playAnimation(singleAnimation, false);
			if (this.currentAnimation) {
				this.currentAnimation.time = 0;
				this.currentAnimation.paused = true;
				console.log('🎭 Animation reset to frame 0 and paused');
			}
		} else {
			this.stopManualBreathingLoop();
		}
	}



	async playFunAnimation(): Promise<void> {
		console.log('🎭 Fun animation requested - using single GLB animation instead');
		
		if (!this.use3D || this.fallbackMode) {
			// For 2D fallback, just use simple bounce animation
			const character = document.querySelector('.avatar-character');
			if (character) {
				character.classList.add('bounce-animation');
				setTimeout(() => {
					character.classList.remove('bounce-animation');
				}, 1500);
			}
			return;
		}

		// Use the single animation from GLB file instead of random animations
		const availableAnimations = Object.keys(this.animationActions);
		if (availableAnimations.length > 0) {
			const singleAnimation = availableAnimations[0];
			console.log('🎭 Playing single GLB animation for fun interaction:', singleAnimation);
			
			// Play the animation once, then return to start pose
			this.playAnimation(singleAnimation, false); // false = play once
			
			// Get actual duration and return to start pose after completion
			const animationClip = Object.values(this.animationActions)[0]?.getClip();
			const actualDuration = animationClip ? animationClip.duration * 1000 : 2000;
			
			setTimeout(() => {
				// Reset to beginning of animation and freeze
				this.playAnimation(singleAnimation, false);
				if (this.currentAnimation) {
					this.currentAnimation.time = 0;
					this.currentAnimation.paused = true;
					console.log('🎭 Fun animation completed - reset to start pose');
				}
			}, actualDuration + 100);
		} else {
			console.log('🎭 No GLB animations available for fun interaction');
		}
	}



	/**
	 * Available Built-in Ready Player Me Animations (if available in the GLB file):
	 * - "Idle" - Default standing pose
	 * - "Talking" - Gesture animations while speaking  
	 * - "Wave" - Greeting wave animation
	 * - "Nod" - Head nodding
	 * - "ThumbsUp" - Approval gesture
	 * - "Dance" - Dancing animation
	 * - "Walk" - Walking cycle
	 * - "Run" - Running cycle
	 * - "Jump" - Jumping animation
	 * - "Clap" - Clapping hands
	 * - "Point" - Pointing gesture
	 * 
	 * Note: Only built-in animations from the GLB file are used.
	 * No custom animations are implemented.
	 */

	private async initializeFallback(container: HTMLElement, _config: AvatarConfig): Promise<void> {
		// Create fallback avatar using CSS animations and images
		container.innerHTML = `
			<div class="fallback-avatar-container">
				<div class="avatar-character" data-emotion="neutral">
					<div class="avatar-head">
						<div class="avatar-face">
							<div class="avatar-eyes">
								<div class="eye left-eye"></div>
								<div class="eye right-eye"></div>
							</div>
							<div class="avatar-mouth" data-state="idle"></div>
						</div>
					</div>
					<div class="avatar-body">
						<div class="mechanic-shirt"></div>
						<div class="name-tag">Dominic</div>
					</div>
				</div>
				<div class="avatar-status-indicator" data-status="idle">
					<span class="status-dot"></span>
					<span class="status-text">Ready to help</span>
				</div>
			</div>
		`;

		// Add fallback styles
		this.addFallbackStyles(container);
		this.fallbackMode = true;
		this.isInitialized = true;

		console.log('✅ Avatar service initialized in fallback mode');
	}

	private addFallbackStyles(container: HTMLElement): void {
		const style = document.createElement('style');
		style.textContent = `
			.fallback-avatar-container {
				display: flex;
				flex-direction: column;
				align-items: center;
				justify-content: center;
				height: 100%;
				background: transparent; /* Transparent background */
				border-radius: 16px;
				padding: 2rem;
				position: relative;
				overflow: hidden;
			}

			.avatar-character {
				position: relative;
				transition: all 0.3s ease;
			}

			.avatar-head {
				width: 120px;
				height: 120px;
				border-radius: 50%;
				background: linear-gradient(135deg, #D2B48C, #DEB887);
				position: relative;
				margin-bottom: 1rem;
				box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
			}

			.avatar-face {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
			}

			.avatar-eyes {
				display: flex;
				gap: 20px;
				margin-bottom: 15px;
			}

			.eye {
				width: 12px;
				height: 12px;
				background: #2c3e50;
				border-radius: 50%;
				position: relative;
				animation: blink 4s infinite;
			}

			.eye::after {
				content: '';
				position: absolute;
				top: 2px;
				left: 2px;
				width: 4px;
				height: 4px;
				background: white;
				border-radius: 50%;
			}

			.avatar-mouth {
				width: 24px;
				height: 12px;
				border: 2px solid #2c3e50;
				border-top: none;
				border-radius: 0 0 24px 24px;
				margin: 0 auto;
				transition: all 0.2s ease;
			}

			.avatar-mouth[data-state="speaking"] {
				animation: speaking 0.3s ease-in-out infinite alternate;
			}

			.avatar-body {
				position: relative;
				width: 80px;
				height: 100px;
				background: #4a90e2;
				border-radius: 8px 8px 0 0;
				display: flex;
				flex-direction: column;
				align-items: center;
				padding-top: 10px;
			}

			.mechanic-shirt {
				width: 100%;
				height: 60px;
				background: linear-gradient(180deg, #4a90e2, #357abd);
				position: relative;
			}

			.mechanic-shirt::after {
				content: '🔧';
				position: absolute;
				top: 5px;
				right: 8px;
				font-size: 16px;
			}

			.name-tag {
				background: white;
				color: #333;
				padding: 2px 8px;
				border-radius: 4px;
				font-size: 10px;
				font-weight: bold;
				margin-top: 5px;
				border: 1px solid #ddd;
			}

			.avatar-status-indicator {
				position: absolute;
				bottom: 20px;
				left: 50%;
				transform: translateX(-50%);
				display: flex;
				align-items: center;
				gap: 8px;
				background: rgba(255, 255, 255, 0.1);
				backdrop-filter: blur(10px);
				padding: 8px 16px;
				border-radius: 20px;
				color: white;
				font-size: 14px;
			}

			.status-dot {
				width: 8px;
				height: 8px;
				border-radius: 50%;
				background: #4ade80;
				animation: pulse 2s ease-in-out infinite;
			}

			.avatar-character[data-emotion="happy"] .avatar-mouth {
				border-radius: 12px 12px 0 0;
				border-top: 2px solid #2c3e50;
				border-bottom: none;
			}

			.avatar-character[data-emotion="concerned"] .eye {
				transform: rotate(15deg);
			}

			.avatar-character[data-emotion="concerned"] .eye:last-child {
				transform: rotate(-15deg);
			}

			.avatar-character[data-emotion="focused"] .eye {
				width: 16px;
				height: 8px;
				border-radius: 50%;
			}

			@keyframes blink {
				0%, 90%, 100% { transform: scaleY(1); }
				95% { transform: scaleY(0.1); }
			}

			@keyframes speaking {
				0% { transform: scaleY(1); }
				100% { transform: scaleY(1.5) scaleX(0.8); }
			}

			@keyframes pulse {
				0%, 100% { opacity: 1; }
				50% { opacity: 0.3; }
			}

			.avatar-character[data-status="speaking"] {
				animation: speaking-bounce 0.6s ease-in-out infinite alternate;
			}

			.avatar-character[data-status="listening"] .status-dot {
				background: #f59e0b;
				animation: pulse 1s ease-in-out infinite;
			}

			.avatar-character[data-status="thinking"] {
				animation: thinking-sway 2s ease-in-out infinite alternate;
			}

			@keyframes speaking-bounce {
				0% { transform: translateY(0px) scale(1); }
				100% { transform: translateY(-5px) scale(1.02); }
			}

			@keyframes thinking-sway {
				0% { transform: rotate(-2deg); }
				100% { transform: rotate(2deg); }
			}

			@keyframes bounce-fun {
				0%, 100% { transform: translateY(0px) scale(1) rotate(0deg); }
				25% { transform: translateY(-20px) scale(1.1) rotate(-5deg); }
				50% { transform: translateY(-10px) scale(1.05) rotate(5deg); }
				75% { transform: translateY(-15px) scale(1.08) rotate(-3deg); }
			}

			.avatar-character.bounce-animation {
				animation: bounce-fun 1s ease-in-out;
			}


			@keyframes speech-active {
				0%, 100% { transform: scale(1) rotate(0deg); }
				25% { transform: scale(1.02) rotate(-1deg); }
				50% { transform: scale(1.03) rotate(1deg); }
				75% { transform: scale(1.02) rotate(-0.5deg); }
			}

			.avatar-character.speaking-active {
				animation: speech-active 2s ease-in-out infinite;
				border: 2px solid #22c55e;
				border-radius: 50%;
				box-shadow: 0 0 20px rgba(34, 197, 94, 0.4);
			}
		`;
		
		container.appendChild(style);
	}

	async speak(text: string): Promise<void> {
		if (!this.isInitialized) {
			throw new Error('Avatar not initialized');
		}

		try {
			if (this.use3D && !this.fallbackMode) {
				await this.speak3D(text);
			} else {
				await this.speakFallback(text);
			}
		} catch (error) {
			console.error('Avatar speak error:', error);
			throw error;
		}
	}

	private async speak3D(text: string): Promise<void> {
		console.log('🗣️ Starting 3D speech - starting animation loop');
		
		// Start animation loop for speech
		this.startAnimationLoop();
		
		// Animation will loop during speech, only mouth movement and morphing will be applied on top
		
		// Animate mouth and add head movement for dynamic speech
		const duration = Math.max(text.length * 60, 2000);
		let startTime = Date.now();
		
		const animateSpeaking = () => {
			const elapsed = Date.now() - startTime;
			const progress = elapsed / duration;
			
			if (progress < 1 && this.use3D && this.avatarModel) {
				// Mouth animation with more variation
				const timeVar = elapsed * 0.008; // Speed of mouth movement
				const mouthOpen = 0.2 + Math.sin(timeVar * 3) * 0.3 + Math.sin(timeVar * 7) * 0.15;
				const jawOpen = 0.15 + Math.sin(timeVar * 2.5) * 0.2;
				
				// Head movement for natural speaking motion
				const originalHeadY = this.avatarModel.rotation.y;
				const headSway = Math.sin(timeVar * 1.5) * 0.1; // Gentle head sway
				const headNod = Math.sin(timeVar * 2) * 0.05; // Subtle nodding
				
				this.avatarModel.rotation.y = originalHeadY + headSway;
				this.avatarModel.rotation.x = headNod;
				
				// Body animation - slight shoulder movement
				const shoulderMove = Math.sin(timeVar * 1.2) * 0.03;
				this.avatarModel.rotation.z = shoulderMove;
				
				// Apply mouth morph targets
				Object.values(this.morphTargets).forEach((mesh) => {
					if (mesh.morphTargetDictionary) {
						// Try various mouth morph target names
						const mouthTargets = ['mouthOpen', 'jawOpen', 'mouth_open', 'viseme_O', 'viseme_U'];
						const jawTargets = ['jawOpen', 'jaw_open', 'mouthOpen'];
						
						mouthTargets.forEach((targetName) => {
							if (mesh.morphTargetDictionary![targetName] !== undefined) {
								this.setMorphTarget(mesh.name, targetName, mouthOpen);
							}
						});
						
						jawTargets.forEach((targetName) => {
							if (mesh.morphTargetDictionary![targetName] !== undefined) {
								this.setMorphTarget(mesh.name, targetName, jawOpen);
							}
						});
					}
				});
				
				requestAnimationFrame(animateSpeaking);
			} else {
				console.log('🗣️ Stopping 3D speech animation');
				
				// Reset avatar position and mouth
				if (this.avatarModel) {
					this.avatarModel.rotation.x = 0;
					this.avatarModel.rotation.y = 0;
					this.avatarModel.rotation.z = 0;
				}
				
				// Stop mouth animation
				Object.values(this.morphTargets).forEach((mesh) => {
					if (mesh.morphTargetDictionary) {
						Object.keys(mesh.morphTargetDictionary).forEach((targetName) => {
							if (targetName.includes('mouth') || targetName.includes('jaw') || targetName.includes('viseme')) {
								this.setMorphTarget(mesh.name, targetName, 0);
							}
						});
					}
				});
				
				// Reset avatar position after speech, but don't stop speaker yet
				// (speaker will be stopped by the main speech function when it's completely done)
				if (this.avatarModel) {
					this.avatarModel.rotation.x = 0;
					this.avatarModel.rotation.y = 0;
					this.avatarModel.rotation.z = 0;
				}
				console.log('🗣️ Speech mouth animation finished - avatar position reset');
			}
		};
		
		animateSpeaking();
	}

	// Manual speaker toggle
	startSpeechAnimation(): void {
		console.log('🎭 MANUAL: Speaker manually turned ON');
		this.startAnimationLoop();
	}

	stopSpeechAnimation(): void {
		console.log('🎭 MANUAL: Speaker manually turned OFF');
		this.stopAnimationLoop();
	}

	private async speakFallback(text: string): Promise<void> {
		// Animate mouth for speaking in fallback mode
		const mouth = document.querySelector('.avatar-mouth');
		const character = document.querySelector('.avatar-character');
		const statusIndicator = document.querySelector('.avatar-status-indicator .status-text');
		
		if (mouth && character && statusIndicator) {
			mouth.setAttribute('data-state', 'speaking');
			character.setAttribute('data-status', 'speaking');
			(statusIndicator as HTMLElement).textContent = 'Speaking...';
			
			// Estimate speaking duration
			const duration = Math.max(text.length * 60, 1000);
			
			setTimeout(() => {
				mouth.setAttribute('data-state', 'idle');
				character.setAttribute('data-status', 'idle');
				(statusIndicator as HTMLElement).textContent = 'Ready to help';
			}, duration);
		}
	}

	setEmotion(emotion: keyof EmotionMapping): void {
		if (!this.isInitialized || !browser) return;

		this.currentEmotion = emotion;

		try {
			if (this.use3D && !this.fallbackMode) {
				this.setEmotion3D(emotion);
			} else {
				// Update fallback avatar emotion
				const character = document.querySelector('.avatar-character');
				if (character) {
					character.setAttribute('data-emotion', emotion);
				}
			}
		} catch (error) {
			console.error('Avatar emotion error:', error);
		}
	}

	private setEmotion3D(emotion: keyof EmotionMapping): void {
		// Apply facial expressions using morph targets
		const emotionMorphs: { [key: string]: { [target: string]: number } } = {
			happy: { 'mouthSmile': 0.8, 'eyeSquint': 0.3 },
			concerned: { 'browDown': 0.6, 'mouthFrown': 0.5 },
			focused: { 'browDown': 0.3, 'eyeSquint': 0.5 },
			encouraging: { 'mouthSmile': 0.6, 'browUp': 0.4 },
			neutral: {}
		};

		// Reset all morph targets first
		Object.values(this.morphTargets).forEach((mesh) => {
			if (mesh.morphTargetInfluences && mesh.morphTargetDictionary) {
				Object.keys(mesh.morphTargetDictionary).forEach((targetName) => {
					this.setMorphTarget(mesh.name, targetName, 0);
				});
			}
		});

		// Apply emotion-specific morph targets
		const targets = emotionMorphs[emotion] || {};
		Object.entries(targets).forEach(([targetName, influence]) => {
			Object.values(this.morphTargets).forEach((mesh) => {
				if (mesh.morphTargetDictionary && mesh.morphTargetDictionary[targetName] !== undefined) {
					this.setMorphTarget(mesh.name, targetName, influence);
				}
			});
		});
	}

	setStatus(status: 'idle' | 'listening' | 'speaking' | 'thinking'): void {
		if (!this.isInitialized || !browser) return;

		const character = document.querySelector('.avatar-character');
		const statusIndicator = document.querySelector('.avatar-status-indicator .status-text');
		const statusDot = document.querySelector('.status-dot');

		if (character && statusIndicator && statusDot) {
			character.setAttribute('data-status', status);

			switch (status) {
				case 'idle':
					(statusIndicator as HTMLElement).textContent = 'Ready to help';
					(statusDot as HTMLElement).style.background = '#4ade80';
					break;
				case 'listening':
					(statusIndicator as HTMLElement).textContent = 'Listening...';
					(statusDot as HTMLElement).style.background = '#f59e0b';
					break;
				case 'speaking':
					(statusIndicator as HTMLElement).textContent = 'Speaking...';
					(statusDot as HTMLElement).style.background = '#3b82f6';
					break;
				case 'thinking':
					(statusIndicator as HTMLElement).textContent = 'Thinking...';
					(statusDot as HTMLElement).style.background = '#8b5cf6';
					break;
			}
		}
	}

	stopSpeaking(): void {
		// Reset fallback animation (only in browser)
		if (browser) {
			const mouth = document.querySelector('.avatar-mouth');
			const character = document.querySelector('.avatar-character');
			
			if (mouth && character) {
				mouth.setAttribute('data-state', 'idle');
				character.setAttribute('data-status', 'idle');
			}
		}
	}

	getCapabilities(): { webgl: boolean; talkingHead: boolean; fallbackMode: boolean } {
		return {
			webgl: this.isWebGLSupported,
			talkingHead: false, // Not implemented yet
			fallbackMode: this.fallbackMode
		};
	}

	getCurrentEmotion(): string {
		return this.currentEmotion;
	}

	isReady(): boolean {
		return this.isInitialized;
	}

	async triggerFunAnimation(): Promise<void> {
		return this.playFunAnimation();
	}

	fullReset(): void {
		console.log('🔄 Avatar Service: Full reset initiated');
		
		try {
			// Stop any ongoing animations
			this.stopManualBreathingLoop();
			
			if (this.mixer) {
				// Stop all animations
				Object.values(this.animationActions).forEach(action => {
					action.stop();
					action.reset();
				});
			}
			
			// Reset to beginning pose if animations are available
			const availableAnimations = Object.keys(this.animationActions);
			if (availableAnimations.length > 0) {
				const firstAnimation = availableAnimations[0];
				console.log('🎭 Resetting avatar to beginning pose:', firstAnimation);
				
				// Set to animation start and pause
				this.playAnimation(firstAnimation, false);
				if (this.currentAnimation) {
					this.currentAnimation.time = 0;
					this.currentAnimation.paused = true;
					console.log('🎭 Avatar reset to frame 0 and paused');
				}
			}
			
			// Reset avatar position and rotations
			if (this.avatarModel) {
				this.avatarModel.rotation.x = 0;
				this.avatarModel.rotation.y = 0;
				this.avatarModel.rotation.z = 0;
				this.avatarModel.position.x = 0;
				this.avatarModel.position.y = -0.2; // Maintain consistent positioning
				this.avatarModel.position.z = 0;
				this.avatarModel.scale.setScalar(1);
			}
			
			// Reset morph targets to neutral
			Object.values(this.morphTargets).forEach((mesh) => {
				if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
					Object.keys(mesh.morphTargetDictionary).forEach((targetName) => {
						this.setMorphTarget(mesh.name, targetName, 0);
					});
				}
			});
			
			this.currentAnimation = undefined;
			console.log('✅ Avatar Service: Full reset completed - avatar in initial state');
			
		} catch (error) {
			console.error('❌ Avatar Service: Error during full reset:', error);
		}
	}

	destroy(): void {
		this.stopSpeaking();
		this.stopManualBreathingLoop(); // Clean up breathing animation
		
		// Clean up 3D resources
		if (this.renderer) {
			this.renderer.dispose();
			this.renderer = undefined;
		}
		
		if (this.scene) {
			this.scene.clear();
			this.scene = undefined;
		}
		
		if (this.mixer) {
			this.mixer.stopAllAction();
			this.mixer = undefined;
		}
		
		// Remove event listeners (only in browser environment)
		if (browser && typeof window !== 'undefined') {
			window.removeEventListener('resize', this.onWindowResize.bind(this));
		}
		
		this.animationActions = {};
		this.morphTargets = {};
		this.avatarModel = undefined;
		this.currentAnimation = undefined;
		
		this.isInitialized = false;
	}
}

export const avatarService = new AvatarService();