import { Ollama } from 'ollama';
import type { Scene, VideoScript } from './types';

function isScene(obj: unknown): obj is Scene {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).imagePrompt === 'string' &&
    typeof (obj as Record<string, unknown>).caption === 'string'
  );
}

function isVideoScript(obj: unknown): obj is VideoScript {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as Record<string, unknown>).narration === 'string' &&
    Array.isArray((obj as Record<string, unknown>).scenes) &&
    ((obj as Record<string, unknown>).scenes as unknown[]).every(isScene)
  );
}

/** Return true if the error is a connection-refused / Ollama-not-running error */
function isConnectionRefused(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  if (msg.includes('econnrefused') || msg.includes('fetch failed')) return true;
  // Check the aggregated cause for ECONNREFUSED
  const cause = (err as NodeJS.ErrnoException & { errors?: Error[] }).cause;
  if (cause instanceof Error && cause.message.toLowerCase().includes('econnrefused')) return true;
  const errors = (err as { errors?: Error[] }).errors;
  if (Array.isArray(errors) && errors.some((e) => e.message?.toLowerCase().includes('econnrefused'))) return true;
  return false;
}

const SYSTEM_PROMPT = `You are a creative video script writer for short-form social media (TikTok, YouTube Shorts).
Generate a script for a 30-second vertical video based on the user's topic.
You MUST respond with valid JSON only — no markdown, no explanation, no code blocks.

Required JSON structure:
{
  "narration": "Full narration text to be read aloud. Target 60-80 words for ~30 seconds.",
  "scenes": [
    { "imagePrompt": "Detailed visual description for AI image generation in portrait orientation", "caption": "Short punchy on-screen text (2-8 words)" },
    { "imagePrompt": "...", "caption": "..." },
    { "imagePrompt": "...", "caption": "..." },
    { "imagePrompt": "...", "caption": "..." },
    { "imagePrompt": "...", "caption": "..." }
  ]
}

Rules:
- Exactly 5 scenes required
- Each imagePrompt must be a vivid, detailed description suitable for AI image generation
- Each caption must be 2-8 words, punchy and engaging
- The narration should flow naturally and cover all 5 scene topics`;

export async function generateScript(
  prompt: string,
  model = 'llama3.2:3b',
): Promise<VideoScript> {
  const ollama = new Ollama({ host: 'http://localhost:11434' });

  let response: Awaited<ReturnType<typeof ollama.chat>>;
  try {
    response = await ollama.chat({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Create a video short about: ${prompt}` },
      ],
      format: 'json',
      stream: false,
    });
  } catch (err) {
    if (isConnectionRefused(err)) {
      throw new Error(
        'Cannot connect to Ollama on localhost:11434. ' +
        'Make sure Ollama is installed and running. ' +
        'Start it with: ollama serve',
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    // Surface model-not-found errors clearly
    if (msg.toLowerCase().includes('model') && msg.toLowerCase().includes('not found')) {
      throw new Error(
        `Model "${model}" is not pulled. Run: ollama pull ${model}`,
      );
    }
    throw new Error(`Ollama error: ${msg}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.message.content);
  } catch {
    throw new Error(
      `Ollama returned invalid JSON: ${response.message.content.slice(0, 200)}`,
    );
  }

  if (!isVideoScript(parsed)) {
    throw new Error(
      `Ollama response missing required fields. Got: ${JSON.stringify(parsed).slice(0, 200)}`,
    );
  }

  if (parsed.scenes.length !== 5) {
    // Try to recover by padding or slicing
    while (parsed.scenes.length < 5) {
      parsed.scenes.push({ imagePrompt: prompt, caption: 'More details' });
    }
    parsed.scenes = parsed.scenes.slice(0, 5);
  }

  return parsed;
}
