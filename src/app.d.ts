// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// TalkingHead module declaration
	declare module 'talkinghead' {
		export interface TalkingHeadOptions {
			ttsEndpoint?: string;
			lipsyncModules?: string[];
		}

		export interface AvatarOptions {
			url: string;
			body?: string;
			avatarMood?: string;
			ttsLang?: string;
			ttsVoice?: string;
			lipsyncLang?: string;
		}

		export class TalkingHead {
			constructor(element: HTMLElement, options?: TalkingHeadOptions);
			showAvatar(options: AvatarOptions): Promise<void>;
			speakText(text: string): Promise<void>;
			setMood(mood: string): void;
			stopSpeaking(): void;
		}
	}

	// meSpeak module declaration
	declare module 'mespeak' {
		export interface MeSpeakOptions {
			amplitude?: number;
			pitch?: number;
			speed?: number;
			variant?: string;
		}

		export function loadConfig(configUrl: string): void;
		export function loadVoice(voiceUrl: string): void;
		export function speak(text: string, options?: MeSpeakOptions): void;
		export function canPlay(): boolean;
	}

	// Web Speech API extensions
	interface Window {
		SpeechRecognition: typeof SpeechRecognition;
		webkitSpeechRecognition: typeof SpeechRecognition;
	}
}

export {};