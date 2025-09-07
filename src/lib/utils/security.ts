// Security utilities for client-side protection

export interface SecurityConfig {
	allowedDomains: string[];
	rateLimitPerMinute: number;
	maxMessageLength: number;
	enableContentFilter: boolean;
}

class SecurityManager {
	private static instance: SecurityManager;
	private config: SecurityConfig;
	private requestHistory: Map<string, number[]> = new Map();

	private constructor(config: SecurityConfig) {
		this.config = config;
	}

	public static getInstance(config?: SecurityConfig): SecurityManager {
		if (!SecurityManager.instance && config) {
			SecurityManager.instance = new SecurityManager(config);
		}
		return SecurityManager.instance;
	}

	// Domain validation for API calls
	validateDomain(): boolean {
		if (typeof window === 'undefined') return true;
		
		const currentDomain = window.location.hostname;
		return this.config.allowedDomains.some(domain => 
			currentDomain === domain || currentDomain.endsWith(`.${domain}`)
		);
	}

	// Rate limiting check
	checkRateLimit(identifier: string = 'global'): boolean {
		const now = Date.now();
		const windowMs = 60000; // 1 minute
		
		if (!this.requestHistory.has(identifier)) {
			this.requestHistory.set(identifier, []);
		}
		
		const requests = this.requestHistory.get(identifier)!;
		
		// Clean old requests
		const recentRequests = requests.filter(time => now - time < windowMs);
		this.requestHistory.set(identifier, recentRequests);
		
		// Check if within limit
		if (recentRequests.length >= this.config.rateLimitPerMinute) {
			return false;
		}
		
		// Add current request
		recentRequests.push(now);
		return true;
	}

	// Input sanitization
	sanitizeInput(input: string): string {
		if (input.length > this.config.maxMessageLength) {
			throw new Error(`Message too long. Maximum ${this.config.maxMessageLength} characters allowed.`);
		}

		// Basic HTML sanitization
		return input
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#x27;')
			.replace(/\//g, '&#x2F;')
			.trim();
	}

	// Content filtering for inappropriate content
	filterContent(text: string): { filtered: string; flagged: boolean } {
		if (!this.config.enableContentFilter) {
			return { filtered: text, flagged: false };
		}

		const inappropriatePatterns = [
			/\b(hate|violence|illegal|harmful)\b/gi,
			// Add more patterns as needed
		];

		let filtered = text;
		let flagged = false;

		inappropriatePatterns.forEach(pattern => {
			if (pattern.test(filtered)) {
				flagged = true;
				filtered = filtered.replace(pattern, '[FILTERED]');
			}
		});

		return { filtered, flagged };
	}

	// API key validation (client-side check)
	validateApiKey(apiKey: string): boolean {
		// Basic format validation
		if (!apiKey || apiKey.length < 20) {
			return false;
		}

		// Check for test/placeholder keys
		const testKeyPatterns = [
			/^test/i,
			/^demo/i,
			/^your-/i,
			/^placeholder/i
		];

		return !testKeyPatterns.some(pattern => pattern.test(apiKey));
	}

	// Session token generation
	generateSessionToken(): string {
		const array = new Uint8Array(32);
		crypto.getRandomValues(array);
		return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
	}

	// Secure local storage wrapper
	secureStorage = {
		setItem: (key: string, value: string): void => {
			try {
				const encrypted = btoa(value); // Simple encoding (use proper encryption in production)
				localStorage.setItem(`secure_${key}`, encrypted);
			} catch (error) {
				console.error('Secure storage error:', error);
			}
		},

		getItem: (key: string): string | null => {
			try {
				const encrypted = localStorage.getItem(`secure_${key}`);
				return encrypted ? atob(encrypted) : null;
			} catch (error) {
				console.error('Secure storage retrieval error:', error);
				return null;
			}
		},

		removeItem: (key: string): void => {
			localStorage.removeItem(`secure_${key}`);
		}
	};

	// CSRF protection
	generateCSRFToken(): string {
		return this.generateSessionToken();
	}

	validateCSRFToken(token: string, storedToken: string): boolean {
		return token === storedToken && token.length === 64;
	}

	// Monitor for suspicious activity
	detectSuspiciousActivity(metrics: {
		requestsPerMinute: number;
		errorRate: number;
		averageResponseTime: number;
	}): boolean {
		// Simple heuristics for detecting abuse
		if (metrics.requestsPerMinute > this.config.rateLimitPerMinute * 2) {
			console.warn('Suspicious activity: High request rate detected');
			return true;
		}

		if (metrics.errorRate > 0.5) {
			console.warn('Suspicious activity: High error rate detected');
			return true;
		}

		return false;
	}
}

// Default security configuration
const defaultSecurityConfig: SecurityConfig = {
	allowedDomains: ['localhost', 'github.io', 'your-domain.com'],
	rateLimitPerMinute: 60,
	maxMessageLength: 2000,
	enableContentFilter: true
};

// Export singleton instance
export const security = SecurityManager.getInstance(defaultSecurityConfig);

// Utility functions
export function validateEnvironment(): {
	isSecure: boolean;
	warnings: string[];
} {
	const warnings: string[] = [];
	let isSecure = true;

	// Check if running over HTTPS (except localhost)
	if (typeof window !== 'undefined') {
		const isLocalhost = window.location.hostname === 'localhost' || 
						   window.location.hostname === '127.0.0.1';
		const isHTTPS = window.location.protocol === 'https:';

		if (!isLocalhost && !isHTTPS) {
			warnings.push('Application should run over HTTPS in production');
			isSecure = false;
		}

		// Check for development mode indicators
		if (window.location.search.includes('debug=true')) {
			warnings.push('Debug mode detected - should be disabled in production');
		}
	}

	return { isSecure, warnings };
}

export function logSecurityEvent(event: string, details?: any): void {
	console.warn(`[SECURITY] ${event}`, details);
	
	// In production, you might want to send this to a logging service
	// Example: analyticsService.track('security_event', { event, details });
}

// Input validation helpers
export function validateEmail(email: string): boolean {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
}

export function validateMotorcycleInfo(info: any): boolean {
	if (!info || typeof info !== 'object') return false;
	
	// Basic validation for motorcycle information
	const requiredFields = ['make', 'model', 'year'];
	return requiredFields.every(field => field in info && info[field]);
}