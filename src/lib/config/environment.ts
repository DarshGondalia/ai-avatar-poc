import { browser } from '$app/environment';
import { security, validateEnvironment } from '$lib/utils/security';

export interface EnvironmentConfig {
	gemini: {
		apiKey: string;
	};
	ai: {
		modelName: string;
		maxTokens: number;
		temperature: number;
	};
	avatar: {
		defaultAvatarUrl: string;
		fallbackEnabled: boolean;
	};
	speech: {
		defaultVoice: string;
		fallbackTTSEnabled: boolean;
	};
	security: {
		enableRateLimit: boolean;
		maxMessageLength: number;
		allowedDomains: string[];
	};
	features: {
		speechRecognition: boolean;
		speechSynthesis: boolean;
		avatarAnimations: boolean;
		offlineMode: boolean;
	};
}

class EnvironmentManager {
	private static instance: EnvironmentManager;
	private config: EnvironmentConfig | null = null;
	private isProduction = false;

	private constructor() {
		this.detectEnvironment();
	}

	public static getInstance(): EnvironmentManager {
		if (!EnvironmentManager.instance) {
			EnvironmentManager.instance = new EnvironmentManager();
		}
		return EnvironmentManager.instance;
	}

	private detectEnvironment(): void {
		if (browser) {
			this.isProduction = window.location.hostname !== 'localhost' && 
							   !window.location.hostname.startsWith('192.168.');
			
			// Validate security environment
			const { isSecure, warnings } = validateEnvironment();
			if (!isSecure && this.isProduction) {
				console.warn('⚠️ Security warnings detected:', warnings);
			}
		}
	}

	public loadConfig(): EnvironmentConfig {
		if (this.config) return this.config;

		// Load environment variables (these would come from your build process)
		const geminiApiKey = this.getEnvVar('VITE_GEMINI_API_KEY', '');

		this.config = {
			gemini: {
				apiKey: geminiApiKey
			},
			ai: {
				modelName: this.getEnvVar('VITE_AI_MODEL_NAME', 'gemini-1.5-flash'),
				maxTokens: parseInt(this.getEnvVar('VITE_AI_MAX_TOKENS', '1000')),
				temperature: parseFloat(this.getEnvVar('VITE_AI_TEMPERATURE', '0.7'))
			},
			avatar: {
				defaultAvatarUrl: this.getEnvVar('VITE_AVATAR_URL', '/avatars/motorcycle-mechanic.glb'),
				fallbackEnabled: this.getEnvVar('VITE_AVATAR_FALLBACK', 'true') === 'true'
			},
			speech: {
				defaultVoice: this.getEnvVar('VITE_SPEECH_VOICE', 'en-US-Standard-B'),
				fallbackTTSEnabled: this.getEnvVar('VITE_SPEECH_FALLBACK', 'true') === 'true'
			},
			security: {
				enableRateLimit: this.getEnvVar('VITE_RATE_LIMIT_ENABLED', 'true') === 'true',
				maxMessageLength: parseInt(this.getEnvVar('VITE_MAX_MESSAGE_LENGTH', '2000')),
				allowedDomains: this.getEnvVar('VITE_ALLOWED_DOMAINS', 'localhost,github.io').split(',')
			},
			features: {
				speechRecognition: this.getEnvVar('VITE_FEATURE_SPEECH_RECOGNITION', 'true') === 'true',
				speechSynthesis: this.getEnvVar('VITE_FEATURE_SPEECH_SYNTHESIS', 'true') === 'true',
				avatarAnimations: this.getEnvVar('VITE_FEATURE_AVATAR_ANIMATIONS', 'true') === 'true',
				offlineMode: this.getEnvVar('VITE_FEATURE_OFFLINE_MODE', 'false') === 'true'
			}
		};

		// Validate critical configuration
		this.validateConfig();

		return this.config;
	}

	private getEnvVar(key: string, defaultValue: string): string {
		if (browser && typeof window !== 'undefined') {
			// In browser, try to get from global config or use defaults
			return (window as any).__APP_CONFIG__?.[key] || defaultValue;
		}
		
		// During build time, use Vite environment variables
		return import.meta.env[key] || defaultValue;
	}

	private validateConfig(): void {
		if (!this.config) return;

		const issues: string[] = [];

		// Validate Gemini configuration
		if (!this.config.gemini.apiKey || this.config.gemini.apiKey.startsWith('your-')) {
			issues.push('Gemini API key not configured properly');
		}

		// Validate security settings
		if (!security.validateDomain()) {
			issues.push('Current domain not in allowed domains list');
		}

		// Validate API keys format
		if (this.config.gemini.apiKey && !security.validateApiKey(this.config.gemini.apiKey)) {
			issues.push('Gemini API key format appears invalid');
		}

		if (issues.length > 0) {
			console.warn('⚠️ Configuration issues detected:', issues);
			
			if (this.isProduction && issues.some(issue => issue.includes('not configured'))) {
				throw new Error('Critical configuration missing in production environment');
			}
		}
	}

	public getGeminiConfig() {
		const config = this.loadConfig();
		return config.gemini;
	}

	public getAIConfig() {
		const config = this.loadConfig();
		return config.ai;
	}

	public isConfigurationValid(): boolean {
		const config = this.loadConfig();
		
		// Check if essential services are configured
		const hasGemini = config.gemini.apiKey && 
						   !config.gemini.apiKey.startsWith('your-');

		return hasGemini;
	}

	public isDevelopment(): boolean {
		return !this.isProduction;
	}

	public isProduction_(): boolean {
		return this.isProduction;
	}

	public getFeatureFlags() {
		const config = this.loadConfig();
		return config.features;
	}

	// Runtime configuration updates
	public updateConfig(updates: Partial<EnvironmentConfig>): void {
		if (this.config) {
			this.config = { ...this.config, ...updates };
		}
	}

	// Get configuration status for debugging
	public getConfigStatus(): {
		isValid: boolean;
		environment: 'development' | 'production';
		gemini: boolean;
		security: boolean;
		features: string[];
	} {
		const config = this.loadConfig();
		const enabledFeatures = Object.entries(config.features)
			.filter(([_, enabled]) => enabled)
			.map(([feature, _]) => feature);

		return {
			isValid: this.isConfigurationValid(),
			environment: this.isProduction ? 'production' : 'development',
			gemini: !!(config.gemini.apiKey),
			security: security.validateDomain(),
			features: enabledFeatures
		};
	}
}

// Export singleton instance
export const environment = EnvironmentManager.getInstance();

// Convenience exports
export const getGeminiConfig = () => environment.getGeminiConfig();
export const getAIConfig = () => environment.getAIConfig();
export const isConfigValid = () => environment.isConfigurationValid();
export const getFeatureFlags = () => environment.getFeatureFlags();

// Environment configuration for different deployment targets
export const createEnvironmentConfig = (target: 'development' | 'github-pages' | 'custom'): Partial<EnvironmentConfig> => {
	switch (target) {
		case 'development':
			return {
				security: {
					enableRateLimit: false,
					maxMessageLength: 5000,
					allowedDomains: ['localhost', '127.0.0.1']
				},
				features: {
					speechRecognition: true,
					speechSynthesis: true,
					avatarAnimations: true,
					offlineMode: false
				}
			};

		case 'github-pages':
			return {
				security: {
					enableRateLimit: true,
					maxMessageLength: 2000,
					allowedDomains: ['github.io']
				},
				features: {
					speechRecognition: true,
					speechSynthesis: true,
					avatarAnimations: true,
					offlineMode: true
				}
			};

		case 'custom':
			return {
				security: {
					enableRateLimit: true,
					maxMessageLength: 2000,
					allowedDomains: [] // Configure per deployment
				},
				features: {
					speechRecognition: true,
					speechSynthesis: true,
					avatarAnimations: true,
					offlineMode: true
				}
			};

		default:
			return {};
	}
};