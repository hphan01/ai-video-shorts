import { Ollama } from 'ollama';
import type { Scene, VideoScript } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OpenAIChatResponse {
  choices: { message: { content: string } }[];
}

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
    { "imagePrompt": "<see rules below>", "caption": "Short punchy on-screen text (2-8 words)" },
    { "imagePrompt": "...", "caption": "..." },
    { "imagePrompt": "...", "caption": "..." },
    { "imagePrompt": "...", "caption": "..." },
    { "imagePrompt": "...", "caption": "..." }
  ]
}

Rules:
- Exactly 5 scenes required
- Each caption must be 2-8 words, punchy and engaging
- The narration should flow naturally and cover all 5 scene topics

CRITICAL imagePrompt rules — this feeds directly into a Stable Diffusion image generator:
1. PHYSICAL APPEARANCE FIRST: Always start with the subject's specific appearance.
   Bad: "A scientist in a lab"
   Good: "Dr. Elena, a 35-year-old woman with curly red hair in a loose bun, wearing a white lab coat over a teal blouse, round glasses, focused expression"
2. CHARACTER CONSISTENCY: If the same character appears in multiple scenes, repeat their
   EXACT same physical description (hair color, clothing, face features) word-for-word in every scene they appear in.
3. THEN describe: action, environment, lighting, camera angle, time of day.
4. END with style/quality tags: photorealistic, cinematic lighting, sharp focus, 8k, detailed, portrait orientation 9:16
5. Include dominant colors and mood: warm golden lighting, dramatic shadows, vibrant colors, etc.
6. Be SPECIFIC about setting: "cozy coffee shop with exposed brick walls and fairy lights" not just "coffee shop"
7. Aim for 40-60 words per imagePrompt — more detail = more accurate image

Example of a GOOD imagePrompt:
"Marcus, a tall 28-year-old Black man with short natural hair and a well-trimmed beard, wearing a fitted grey hoodie and dark jeans, sitting cross-legged on a wooden floor surrounded by scattered notebooks and open textbooks, warm afternoon sunlight streaming through large windows behind him, determined focused expression, photorealistic, cinematic lighting, sharp focus, portrait orientation 9:16"`;

// ─── Provider implementations ─────────────────────────────────────────────────

async function generateWithOllama(prompt: string, modelName: string): Promise<VideoScript> {
  const ollama = new Ollama({ host: 'http://localhost:11434' });

  let response: Awaited<ReturnType<typeof ollama.chat>>;
  try {
    response = await ollama.chat({
      model: modelName,
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
    if (msg.toLowerCase().includes('model') && msg.toLowerCase().includes('not found')) {
      throw new Error(
        `Model "${modelName}" is not pulled. Run: ollama pull ${modelName}`,
      );
    }
    throw new Error(`Ollama error: ${msg}`);
  }

  return parseAndValidate(response.message.content, 'Ollama', prompt);
}

async function generateWithOpenAICompat(
  prompt: string,
  modelName: string,
  baseUrl: string,
  apiKey: string,
  providerName: string,
): Promise<VideoScript> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Create a video short about: ${prompt}` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`${providerName} API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as OpenAIChatResponse;
  const content = data.choices?.[0]?.message?.content ?? '';
  return parseAndValidate(content, providerName, prompt);
}

// ─── Shared parse + validate ───────────────────────────────────────────────────

function parseAndValidate(raw: string, providerName: string, prompt: string): VideoScript {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${providerName} returned invalid JSON: ${raw.slice(0, 200)}`);
  }

  if (!isVideoScript(parsed)) {
    throw new Error(
      `${providerName} response missing required fields. Got: ${JSON.stringify(parsed).slice(0, 200)}`,
    );
  }

  if (parsed.scenes.length !== 5) {
    while (parsed.scenes.length < 5) {
      parsed.scenes.push({ imagePrompt: prompt, caption: 'More details' });
    }
    parsed.scenes = parsed.scenes.slice(0, 5);
  }

  return parsed;
}

// ─── Public entry point ────────────────────────────────────────────────────────

/**
 * Generate a video script using the specified AI model.
 *
 * @param prompt  The topic the video is about.
 * @param model   Full model ID in "provider::modelName" format, e.g.
 *                "ollama::llama3.2:3b", "groq::llama-3.3-70b-versatile".
 *                For backwards-compat, bare names like "llama3.2:3b" are
 *                treated as Ollama models.
 */
export async function generateScript(
  prompt: string,
  model = 'ollama::llama3.2:3b',
): Promise<VideoScript> {
  const separatorIdx = model.indexOf('::');
  const provider = separatorIdx === -1 ? 'ollama' : model.slice(0, separatorIdx);
  const modelName = separatorIdx === -1 ? model : model.slice(separatorIdx + 2);

  switch (provider) {
    case 'ollama':
      return generateWithOllama(prompt, modelName);

    case 'openrouter': {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
      return generateWithOpenAICompat(
        prompt,
        modelName,
        'https://openrouter.ai/api/v1',
        apiKey,
        'OpenRouter',
      );
    }

    default:
      throw new Error(`Unknown AI provider: "${provider}". Supported: ollama, openrouter`);
  }
}
