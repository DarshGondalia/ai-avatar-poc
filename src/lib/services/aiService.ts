import { GoogleGenerativeAI } from '@google/generative-ai';

interface RateLimiter {
	canMakeRequest(): boolean;
	getTimeUntilNextRequest(): number;
}

class ClientRateLimiter implements RateLimiter {
	private requests: number[] = [];
	private maxRequests: number;
	private windowMs: number;

	constructor(maxRequests = 50, windowMs = 60000) {
		this.maxRequests = maxRequests;
		this.windowMs = windowMs;
	}

	canMakeRequest(): boolean {
		const now = Date.now();
		this.requests = this.requests.filter(time => now - time < this.windowMs);
		
		if (this.requests.length < this.maxRequests) {
			this.requests.push(now);
			return true;
		}
		return false;
	}

	getTimeUntilNextRequest(): number {
		if (this.requests.length === 0) return 0;
		
		const oldestRequest = Math.min(...this.requests);
		return Math.max(0, this.windowMs - (Date.now() - oldestRequest));
	}
}

export interface AIResponse {
	content: string;
	confidence?: number;
	processingTime: number;
	tokensUsed?: number;
	emotion?: string;
}

export interface AIServiceConfig {
	apiKey: string;
	modelName?: string;
	rateLimitConfig?: {
		maxRequests: number;
		windowMs: number;
	};
}

export class AIService {
	private genAI: GoogleGenerativeAI | null = null;
	private model: any = null;
	private rateLimiter: RateLimiter;
	private isInitialized = false;
	private systemPrompt = `You are Dominic Toretto, a passionate Triumph motorcycle specialist and enthusiast with over 20 years of experience working exclusively with Triumph motorcycles. You have deep expertise in:

- All Triumph motorcycle models (Street Twin, Bonneville, Tiger, Speed Triple, Rocket 3, etc.)
- Triumph engine systems (parallel twin, triple, and other configurations)
- Triumph-specific electrical and ECU systems
- Triumph maintenance schedules and service intervals
- Triumph performance modifications and accessories
- Classic and modern Triumph troubleshooting
- Triumph riding techniques and handling characteristics

Your communication style is:
- Enthusiastic and passionate about Triumph motorcycles
- Knowledgeable motorcycle enthusiast tone
- Uses motorcycle enthusiast language and terminology
- Shares specific Triumph knowledge and insider tips
- Emphasizes the Triumph riding experience and heritage
- Keep responses between 50-100 words unless absolutely necessary to elaborate more on complex technical questions

IMPORTANT: Always keep your responses concise (50-100 words) unless the question specifically requires detailed technical explanation that cannot be shortened without losing critical safety or technical information.

When users ask about Triumph motorcycles, provide:
- Specific Triumph model knowledge
- Triumph-specific maintenance tips
- Triumph performance characteristics
- Triumph community insights
- Triumph riding experience advice

Always prioritize safety and recommend authorized Triumph dealers for complex repairs.`;

	constructor(config: AIServiceConfig) {
		this.rateLimiter = new ClientRateLimiter(
			config.rateLimitConfig?.maxRequests || 50,
			config.rateLimitConfig?.windowMs || 60000
		);
		
		this.initializeGemini(config);
	}

	private async initializeGemini(config: AIServiceConfig): Promise<void> {
		try {
			this.genAI = new GoogleGenerativeAI(config.apiKey);
			this.model = this.genAI.getGenerativeModel({ 
				model: config.modelName || 'gemini-1.5-flash' 
			});
			
			this.isInitialized = true;
			console.log('✅ AI Service initialized successfully');
		} catch (error) {
			console.error('❌ Failed to initialize AI Service:', error);
			throw new Error(`AI Service initialization failed: ${error}`);
		}
	}

	async generateResponse(
		userMessage: string, 
		conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []
	): Promise<AIResponse> {
		if (!this.isInitialized || !this.model) {
			throw new Error('AI Service not initialized');
		}

		if (!this.rateLimiter.canMakeRequest()) {
			const waitTime = this.rateLimiter.getTimeUntilNextRequest();
			throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
		}

		const startTime = Date.now();

		try {
			// Build conversation context
			const contextMessages = conversationHistory
				.slice(-10) // Keep last 10 exchanges for context
				.map(msg => `${msg.role === 'user' ? 'User' : 'Dominic'}: ${msg.content}`)
				.join('\n\n');

			const prompt = `${this.systemPrompt}

Previous conversation:
${contextMessages}

Current user message: ${userMessage}

Please respond as Dominic Toretto, the Triumph motorcycle specialist (remember: 50-100 words unless technical detail requires more):`;

			const result = await this.model.generateContent(prompt);
			const response = await result.response;
			const text = response.text();

			const processingTime = Date.now() - startTime;

			// Determine emotion based on response content
			const emotion = this.determineAvatarEmotion(text, userMessage);

			return {
				content: text,
				processingTime,
				emotion,
				confidence: 0.85 // Static confidence for now
			};

		} catch (error) {
			console.error('AI Response Error:', error);
			
			// Provide fallback response
			return {
				content: this.getFallbackResponse(userMessage),
				processingTime: Date.now() - startTime,
				emotion: 'concerned'
			};
		}
	}

	private determineAvatarEmotion(responseText: string, userMessage: string): string {
		const text = (responseText + ' ' + userMessage).toLowerCase();
		
		if (text.includes('great') || text.includes('excellent') || text.includes('perfect')) {
			return 'happy';
		}
		
		if (text.includes('problem') || text.includes('issue') || text.includes('trouble') || text.includes('broken')) {
			return 'concerned';
		}
		
		if (text.includes('check') || text.includes('inspect') || text.includes('look at') || text.includes('examine')) {
			return 'focused';
		}
		
		if (text.includes('don\'t worry') || text.includes('no problem') || text.includes('easy fix')) {
			return 'encouraging';
		}
		
		return 'neutral';
	}

	private getFallbackResponse(userMessage: string): string {
		const message = userMessage.toLowerCase();
		
		if (message.includes('engine') || message.includes('motor')) {
			return "Love helping with Triumph engine questions! I'm having a brief connection issue, but let's talk about your Triumph's engine. What model are you riding and what symptoms are you experiencing? Parallel twin or triple configuration?";
		}
		
		if (message.includes('brake')) {
			return "Triumph braking systems are fantastic when properly maintained! While my diagnostic system is temporarily down, tell me about your Triumph model and the brake issue. Is it the Brembo or Nissin setup?";
		}
		
		if (message.includes('electrical') || message.includes('battery')) {
			return "Triumph's modern electronics are impressive! Having a connectivity hiccup here, but I'd love to help with your electrical question. Which Triumph model and what electrical symptoms are you seeing?";
		}
		
		return "Sorry, having some technical difficulties but I'm passionate about helping fellow Triumph riders! Tell me about your Triumph - model, year, and what's happening. My 20+ years with these beautiful machines will guide us through!";
	}

	async testConnection(): Promise<boolean> {
		try {
			if (!this.isInitialized || !this.model) {
				return false;
			}

			const result = await this.model.generateContent('Test connection');
			return !!result.response.text();
		} catch (error) {
			console.error('AI Service connection test failed:', error);
			return false;
		}
	}

	getRateLimitStatus(): { canMakeRequest: boolean; timeUntilNext: number } {
		return {
			canMakeRequest: this.rateLimiter.canMakeRequest(),
			timeUntilNext: this.rateLimiter.getTimeUntilNextRequest()
		};
	}

	getStatus(): { initialized: boolean; connected: boolean } {
		return {
			initialized: this.isInitialized,
			connected: this.model !== null
		};
	}
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

export function getAIService(config?: AIServiceConfig): AIService {
	if (!aiServiceInstance && config) {
		aiServiceInstance = new AIService(config);
	}
	
	if (!aiServiceInstance) {
		throw new Error('AI Service not initialized. Please provide configuration.');
	}
	
	return aiServiceInstance;
}