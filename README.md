# AI Avatar PoC - Project Workflow Documentation

## Overview
This is an interactive AI Avatar application featuring a 3D Ready Player Me character named "Dominic Toretto" - a Triumph motorcycle specialist. The app combines real-time voice interaction, AI-powered responses, and synchronized 3D avatar animations.

## Technologies Used

### Frontend Framework
- **SvelteKit** - Modern web framework with TypeScript support
- **Vite** - Fast build tool and development server
- **TypeScript** - Type-safe JavaScript development

### 3D Graphics & Avatar
- **Three.js** - WebGL-based 3D graphics library
- **GLTFLoader** - Loading Ready Player Me avatar models
- **AnimationMixer** - Managing avatar animations and morph targets
- **Ready Player Me** - 3D avatar creation and hosting platform

### AI & Speech
- **Google Gemini AI** - AI conversation and response generation
- **Web Speech API** - Browser-native text-to-speech and speech recognition
- **SpeechSynthesis** - Converting AI responses to spoken audio
- **SpeechRecognition** - Voice input from user

### Styling & UI
- **Tailwind CSS** - Utility-first CSS framework
- **PostCSS** - CSS processing and optimization
- **Custom CSS** - Avatar-specific animations and styling

### State Management
- **Svelte Stores** - Reactive state management for messages, avatar status, and capabilities

## Component Architecture & Workflow

### 1. Main Application (`+page.svelte`)
**Role**: Primary UI controller and orchestration hub
- Initializes all services on component mount
- Manages chat interface and user interactions
- Coordinates between AI responses, speech, and avatar animations
- Handles user input (text and voice) and displays conversation

**Key Interactions**:
- User input → AI Service → Speech Service → Avatar Service
- Manages global state (isSpeaking, speechEnabled, isLoading)
- Auto-enables speech for AI responses
- Triggers animation loops during speech

### 2. AI Service (`aiService.ts`)
**Role**: Handles AI conversation logic and response generation
- **Technology**: Google Gemini AI API integration
- **Features**: Rate limiting, conversation context, emotion detection
- **Character**: Configured as "Dominic Toretto" motorcycle specialist
- **Output**: AI responses with processing time and detected emotions

**Workflow**:
```
User Message → AI Service → Gemini API → Response Processing → Emotion Detection → Return to UI
```

### 3. Avatar Service (`avatarService.ts`)
**Role**: 3D avatar rendering, animation, and visual state management
- **Technology**: Three.js WebGL rendering
- **Features**: 
  - Ready Player Me GLB model loading
  - Facial expression morphing (happy, concerned, focused, neutral)
  - Body animation loops (idle, talking, listening, thinking)
  - Automatic fallback to 2D avatar if WebGL unavailable

**Animation Workflow**:
```
Status Change → Find Available Animations → Play Animation Loop → Sync with Speech Duration
```

**Key Methods**:
- `startAnimationLoop()` - Begins continuous animation during speech
- `stopAnimationLoop()` - Stops animation and resets to idle pose
- `setEmotion()` - Updates facial expressions via morph targets

### 4. Speech Service (`speechService.ts`)
**Role**: Voice input/output and audio processing
- **Technology**: Browser Web Speech API
- **Features**:
  - Text-to-speech with voice selection (en-US only)
  - Speech recognition for voice input
  - Speech capability detection
  - Audio settings (rate, pitch, volume)

**Speech Workflow**:
```
AI Response → Speech Service → Browser TTS → Audio Output → Animation Sync
Voice Input → Speech Recognition → Text Conversion → AI Processing
```

### 5. App Store (`appStore.ts`)
**Role**: Centralized state management
- **Technology**: Svelte reactive stores
- **State Management**:
  - Message history with metadata
  - Avatar status (idle, speaking, listening, thinking)
  - Browser capabilities detection
  - Current avatar emotion and text

## Data Flow Architecture

### User Text Input Flow
```
1. User types message → +page.svelte
2. Message added to store → appStore.ts
3. AI request initiated → aiService.ts  
4. Gemini API call → Response processing
5. AI response added to store → appStore.ts
6. Speech automatically triggered → speechService.ts
7. Animation loop starts → avatarService.ts
8. Speech plays while animation loops
9. Speech ends → Animation stops → Return to idle
```

### Voice Input Flow
```
1. User holds microphone button → +page.svelte
2. Speech recognition starts → speechService.ts
3. Voice converted to text → Web Speech API
4. Text processed as regular input → Continue with text flow above
```

### Avatar Animation Flow
```
1. Status change (speaking/listening) → +page.svelte
2. Animation method called → avatarService.ts
3. Available animations detected → Three.js AnimationMixer
4. Animation loop starts → Continuous playback
5. Speech ends → Animation stops → Reset to idle pose
```

### AI Response Processing Flow
```
1. User message + conversation history → aiService.ts
2. Gemini API processing → Response generation
3. Emotion detection → Text analysis keywords
4. Response returned with metadata → +page.svelte
5. Emotion applied to avatar → avatarService.ts (morph targets)
6. Automatic speech triggered → speechService.ts
```

## Key Integration Points

### Avatar-Speech Synchronization
- Speech start triggers `avatarService.startAnimationLoop()`
- Speech end triggers `avatarService.stopAnimationLoop()`
- Animation loops continuously during entire speech duration
- No animation interruption or premature stopping

### AI-Avatar Emotion Mapping
- AI responses analyzed for emotional keywords
- Emotions mapped to avatar facial expressions:
  - Happy → smile + eye squint
  - Concerned → brow down + mouth frown  
  - Focused → subtle brow down + eye squint
  - Encouraging → smile + raised eyebrows

### State Synchronization
- App store maintains single source of truth
- All services update and read from centralized state
- Real-time UI updates via Svelte reactivity
- Status changes propagated across all components

### Error Handling & Fallbacks
- WebGL failure → Automatic 2D avatar fallback
- AI service failure → Fallback responses with Triumph expertise
- Speech synthesis failure → Silent operation, chat continues
- Animation missing → Graceful handling without breaking

## Performance Optimizations

### 3D Rendering
- Efficient morph target updates
- Shadow mapping optimization
- Proper Three.js resource cleanup
- Animation mixer disposal

### Memory Management
- Service cleanup on component unmount
- Proper event listener removal
- Animation frame cleanup
- Speech synthesis cancellation

### Rate Limiting
- AI API calls rate limited (50 requests/minute)
- Client-side request throttling
- Graceful degradation when limits exceeded