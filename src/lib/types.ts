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
}

export interface VoiceOption {
  id: string;
  label: string;
}
