import { browser } from '$app/environment';

export interface SpeechCapabilities {
	synthesis: boolean;
	recognition: boolean;
	voices: SpeechSynthesisVoice[];
	preferredVoice: string | null;
}

export interface SpeechOptions {
	voice?: string;
	rate?: number;
	pitch?: number;
	volume?: number;
	lang?: string;
}

export interface RecognitionOptions {
	continuous?: boolean;
	interimResults?: boolean;
	lang?: string;
	maxAlternatives?: number;
}

export interface RecognitionResult {
	transcript: string;
	confidence: number;
	isFinal: boolean;
}

export class SpeechService {
	private synthesis: SpeechSynthesis | null = null;
	private recognition: any = null;
	private meSpeakLoaded = false;
	private isListening = false;
	private currentUtterance: SpeechSynthesisUtterance | null = null;
	private isSpeaking = false;
	private speechQueue: string[] = [];

	constructor() {
		if (browser) {
			this.initializeSpeechSynthesis();
			this.initializeSpeechRecognition();
			this.loadMeSpeak();
		}
	}

	private initializeSpeechSynthesis(): void {
		if ('speechSynthesis' in window) {
			this.synthesis = window.speechSynthesis;
		}
	}

	private initializeSpeechRecognition(): void {
		if ('SpeechRecognition' in window) {
			this.recognition = new (window as any).SpeechRecognition();
		} else if ('webkitSpeechRecognition' in window) {
			this.recognition = new (window as any).webkitSpeechRecognition();
		}

		if (this.recognition) {
			this.recognition.continuous = false;
			this.recognition.interimResults = true;
			this.recognition.lang = 'en-US';
			this.recognition.maxAlternatives = 1;
		}
	}

	private async loadMeSpeak(): Promise<void> {
		// meSpeak.js not available, will use native synthesis only
		console.log('📢 Using native speech synthesis only');
	}

	async getCapabilities(): Promise<SpeechCapabilities> {
		const capabilities: SpeechCapabilities = {
			synthesis: !!this.synthesis || this.meSpeakLoaded,
			recognition: !!this.recognition,
			voices: [],
			preferredVoice: null
		};

		if (this.synthesis) {
			// Wait for voices to load
			return new Promise((resolve) => {
				const checkVoices = () => {
					const voices = this.synthesis!.getVoices();
					if (voices.length > 0) {
						capabilities.voices = voices;
						capabilities.preferredVoice = this.findBestVoice(voices);
						resolve(capabilities);
					} else {
						setTimeout(checkVoices, 100);
					}
				};
				checkVoices();
			});
		}

		return capabilities;
	}

	private findBestVoice(voices: SpeechSynthesisVoice[]): string | null {
		console.log('🎤 ALL AVAILABLE VOICES:');
		voices.forEach((v, index) => {
			console.log(`${index + 1}. ${v.name} (${v.lang}) - Default: ${v.default}, Local: ${v.localService}`);
		});

		// ONLY use en-US voices - no fallbacks to other languages
		const enUSVoices = voices.filter(v => v.lang === 'en-US' || v.lang === 'en_US');
		
		console.log('🎤 EN-US VOICES ONLY:');
		enUSVoices.forEach((v, index) => {
			console.log(`${index + 1}. ${v.name} (${v.lang}) - Default: ${v.default}, Local: ${v.localService}`);
		});

		if (enUSVoices.length === 0) {
			console.log('❌ No en-US voices available!');
			return null;
		}

		// Use the first en-US voice available
		const selectedVoice = enUSVoices[0];
		console.log('🎤 SELECTED VOICE:', selectedVoice.name, '(' + selectedVoice.lang + ')');
		return selectedVoice.name;
	}

	async speak(text: string, options: SpeechOptions = {}): Promise<void> {
		return new Promise(async (resolve, reject) => {
			try {
				console.log('🔊 SpeechService.speak called with:', text.substring(0, 50));
				console.log('🔊 Synthesis available:', !!this.synthesis);
				
				// Stop any current speech
				this.stopSpeaking();

				if (this.synthesis) {
					console.log('🔊 Using Web Speech API');
					await this.speakWithWebAPI(text, options, resolve, reject);
				} else {
					console.error('❌ No speech synthesis available');
					reject(new Error('No speech synthesis available'));
				}
			} catch (error) {
				console.error('❌ Speech service error:', error);
				reject(error);
			}
		});
	}

	private async speakWithWebAPI(
		text: string,
		options: SpeechOptions,
		resolve: () => void,
		reject: (error: Error) => void
	): Promise<void> {
		if (!this.synthesis) {
			reject(new Error('Speech synthesis not available'));
			return;
		}

		console.log('🎤 Creating utterance for:', text.substring(0, 30));
		this.currentUtterance = new SpeechSynthesisUtterance(text);
		
		// Set voice using our en-US only logic
		const voices = this.synthesis.getVoices();
		
		if (options.voice) {
			const voice = voices.find(v => v.name === options.voice);
			if (voice) {
				this.currentUtterance.voice = voice;
				console.log('🎤 Using specified voice:', voice.name);
			}
		} else {
			// Use our findBestVoice method that only selects en-US voices
			const bestVoiceName = this.findBestVoice(voices);
			if (bestVoiceName) {
				const bestVoice = voices.find(v => v.name === bestVoiceName);
				if (bestVoice) {
					this.currentUtterance.voice = bestVoice;
				}
			}
		}

		// Set options
		this.currentUtterance.rate = options.rate || 0.9;
		this.currentUtterance.pitch = options.pitch || 0.8;
		this.currentUtterance.volume = options.volume || 1.0;
		this.currentUtterance.lang = options.lang || 'en-US';

		console.log('🎤 Utterance settings:', {
			rate: this.currentUtterance.rate,
			pitch: this.currentUtterance.pitch,
			volume: this.currentUtterance.volume,
			lang: this.currentUtterance.lang
		});

		// Set event handlers
		this.currentUtterance.onstart = () => {
			console.log('🎤 Speech started');
			this.isSpeaking = true;
		};

		this.currentUtterance.onend = () => {
			console.log('🎤 Speech ended');
			this.currentUtterance = null;
			this.isSpeaking = false;
			resolve();
		};

		this.currentUtterance.onerror = (event) => {
			console.error('🎤 Speech error:', event.error);
			this.currentUtterance = null;
			this.isSpeaking = false;
			reject(new Error(`Speech synthesis error: ${event.error}`));
		};

		console.log('🎤 Starting speech synthesis...');
		this.synthesis.speak(this.currentUtterance);
	}

	// meSpeak support removed for simplicity - using native Web Speech API only

	stopSpeaking(): void {
		if (this.synthesis) {
			this.synthesis.cancel();
		}
		this.currentUtterance = null;
		this.isSpeaking = false;
		this.speechQueue = [];
	}

	isSpeakingNow(): boolean {
		return this.isSpeaking || (this.synthesis?.speaking ?? false);
	}

	async speakContinuous(text: string, options: SpeechOptions = {}): Promise<void> {
		// Add to queue and start speaking immediately
		this.speechQueue.push(text);
		
		if (!this.isSpeaking) {
			await this.processSpechQueue(options);
		}
	}

	private async processSpechQueue(options: SpeechOptions): Promise<void> {
		while (this.speechQueue.length > 0) {
			const text = this.speechQueue.shift();
			if (text) {
				try {
					await this.speak(text, options);
				} catch (error) {
					console.error('Error in speech queue:', error);
					// Continue with next item even if current fails
				}
			}
		}
	}

	async startListening(options: RecognitionOptions = {}): Promise<void> {
		return new Promise((resolve, reject) => {
			if (!this.recognition) {
				reject(new Error('Speech recognition not available'));
				return;
			}

			if (this.isListening) {
				reject(new Error('Already listening'));
				return;
			}

			// Configure recognition
			this.recognition.continuous = options.continuous || false;
			this.recognition.interimResults = options.interimResults || true;
			this.recognition.lang = options.lang || 'en-US';
			this.recognition.maxAlternatives = options.maxAlternatives || 1;

			this.recognition.onstart = () => {
				this.isListening = true;
				resolve();
			};

			this.recognition.onerror = (event: any) => {
				this.isListening = false;
				reject(new Error(`Speech recognition error: ${event.error}`));
			};

			this.recognition.onend = () => {
				this.isListening = false;
			};

			this.recognition.start();
		});
	}

	stopListening(): void {
		if (this.recognition && this.isListening) {
			this.recognition.stop();
			this.isListening = false;
		}
	}

	onRecognitionResult(callback: (result: RecognitionResult) => void): void {
		if (!this.recognition) return;

		this.recognition.onresult = (event: any) => {
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				if (result.length > 0) {
					callback({
						transcript: result[0].transcript,
						confidence: result[0].confidence,
						isFinal: result.isFinal
					});
				}
			}
		};
	}

	getListeningStatus(): boolean {
		return this.isListening;
	}

	async testCapabilities(): Promise<{synthesis: boolean; recognition: boolean}> {
		const capabilities = await this.getCapabilities();
		
		return {
			synthesis: capabilities.synthesis,
			recognition: capabilities.recognition
		};
	}
}

// Export singleton instance
export const speechService = new SpeechService();