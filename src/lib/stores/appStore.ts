import { writable, derived } from 'svelte/store';

export interface Message {
	id: string;
	type: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
	metadata?: {
		confidence?: number;
		processingTime?: number;
		avatarEmotion?: string;
	};
}

export interface Client {
	id: string;
	name: string;
	email?: string;
	motorcycleInfo?: {
		make: string;
		model: string;
		year: number;
		issues?: string[];
	};
	sessionHistory: string[];
	preferences: {
		avatarVoice: string;
		speechEnabled: boolean;
		theme: 'light' | 'dark' | 'auto';
	};
}

export interface AvatarState {
	status: 'idle' | 'listening' | 'speaking' | 'thinking' | 'error';
	emotion: 'neutral' | 'happy' | 'concerned' | 'focused' | 'encouraging';
	currentText: string;
	isVisible: boolean;
}

// Individual stores
export const currentUser = writable<Client | null>(null);
export const userRole = writable<'client' | 'coach' | 'admin'>('client');
export const isAuthenticated = writable<boolean>(false);

export const avatar = writable<AvatarState>({
	status: 'idle',
	emotion: 'neutral',
	currentText: '',
	isVisible: true
});

export const messages = writable<Message[]>([]);
export const currentSessionId = writable<string | null>(null);
export const isTyping = writable<boolean>(false);

export const sidebarOpen = writable<boolean>(false);
export const darkMode = writable<boolean>(false);

export const capabilities = writable({
	webgl: false,
	speechSynthesis: false,
	speechRecognition: false,
	indexedDB: false,
	serviceWorker: false
});

export const settings = writable({
	apiRateLimit: 50,
	maxMessagesPerSession: 100,
	avatarAnimationEnabled: true,
	soundEffectsEnabled: true
});

// Derived stores
export const avatarStatus = derived(avatar, $avatar => $avatar.status);
export const avatarEmotion = derived(avatar, $avatar => $avatar.emotion);
export const messageCount = derived(messages, $messages => $messages.length);

// Store actions/helpers
export const appActions = {
	// Message actions
	addMessage(message: Omit<Message, 'id' | 'timestamp'>) {
		const newMessage: Message = {
			...message,
			id: crypto.randomUUID(),
			timestamp: new Date()
		};
		
		messages.update(msgs => [...msgs, newMessage]);
	},

	clearMessages() {
		messages.set([]);
	},

	// Avatar actions
	updateAvatarState(updates: Partial<AvatarState>) {
		avatar.update(current => ({ ...current, ...updates }));
	},

	setAvatarEmotion(emotion: AvatarState['emotion']) {
		avatar.update(current => ({ ...current, emotion }));
	},

	setAvatarStatus(status: AvatarState['status']) {
		avatar.update(current => ({ ...current, status }));
	},

	// Session actions
	startNewSession() {
		const sessionId = crypto.randomUUID();
		currentSessionId.set(sessionId);
		messages.set([]);
		avatar.set({
			status: 'idle',
			emotion: 'neutral',
			currentText: '',
			isVisible: true
		});
	},

	endCurrentSession() {
		currentSessionId.set(null);
		messages.set([]);
		avatar.set({
			status: 'idle',
			emotion: 'neutral',
			currentText: '',
			isVisible: true
		});
	},

	// UI actions
	toggleSidebar() {
		sidebarOpen.update(open => !open);
	},

	toggleDarkMode() {
		darkMode.update(dark => !dark);
	},

	// Settings actions
	updateSettings(newSettings: Partial<typeof settings>) {
		settings.update(current => ({ ...current, ...newSettings }));
	},

	// Capabilities actions
	setCapabilities(newCapabilities: Partial<typeof capabilities>) {
		capabilities.update(current => ({ ...current, ...newCapabilities }));
	}
};

// Persistence helper
export function initializePersistence() {
	if (typeof localStorage !== 'undefined') {
		// Load persisted data
		try {
			const persistedUser = localStorage.getItem('ai-avatar-current-user');
			if (persistedUser) {
				currentUser.set(JSON.parse(persistedUser));
			}

			const persistedRole = localStorage.getItem('ai-avatar-user-role');
			if (persistedRole) {
				userRole.set(persistedRole as 'client' | 'coach' | 'admin');
			}

			const persistedDarkMode = localStorage.getItem('ai-avatar-dark-mode');
			if (persistedDarkMode) {
				darkMode.set(JSON.parse(persistedDarkMode));
			}

			const persistedSettings = localStorage.getItem('ai-avatar-settings');
			if (persistedSettings) {
				settings.set(JSON.parse(persistedSettings));
			}
		} catch (error) {
			console.warn('Failed to load persisted data:', error);
		}

		// Subscribe to changes for persistence
		currentUser.subscribe(user => {
			if (user) {
				localStorage.setItem('ai-avatar-current-user', JSON.stringify(user));
			} else {
				localStorage.removeItem('ai-avatar-current-user');
			}
		});

		userRole.subscribe(role => {
			localStorage.setItem('ai-avatar-user-role', role);
		});

		darkMode.subscribe(dark => {
			localStorage.setItem('ai-avatar-dark-mode', JSON.stringify(dark));
		});

		settings.subscribe(settingsData => {
			localStorage.setItem('ai-avatar-settings', JSON.stringify(settingsData));
		});
	}
}