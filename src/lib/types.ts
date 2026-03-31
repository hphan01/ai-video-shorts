export type JobStatus =
  | 'pending'
  | 'scripting'
  | 'tts'
  | 'images'
  | 'composing'
  | 'done'
  | 'error';

export interface Scene {
  imagePrompt: string;
  caption: string;
}

export interface VideoScript {
  narration: string;
  scenes: Scene[];
}

export interface JobState {
  id: string;
  status: JobStatus;
  progress: number;
  message: string;
  outputPath?: string;
}

export interface GenerateRequest {
  prompt: string;
  voice?: string;
  model?: string;
  referenceImageUrl?: string;
}

export interface VoiceOption {
  id: string;
  label: string;
}

export interface ModelRateLimit {
  requestsPerDay: number;
  requestsPerMinute: number;
}

export interface ModelUsage {
  today: number;
  thisMinute: number;
}

export interface ModelOption {
  /** Format: "provider::modelName", e.g. "groq::llama-3.3-70b-versatile" */
  id: string;
  label: string;
  provider: 'ollama' | 'openrouter';
  available: boolean;
  /** Reason for unavailability, e.g. "Add GROQ_API_KEY to .env.local" */
  unavailableReason?: string;
  limit?: ModelRateLimit;
  usage?: ModelUsage;
}
