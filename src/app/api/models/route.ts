import { NextResponse } from 'next/server';
import { getUsage } from '@/lib/usageTracker';
import type { ModelOption } from '@/lib/types';

export const runtime = 'nodejs';
// Revalidate every 30 seconds so usage numbers stay fresh without hammering Ollama
export const revalidate = 30;

// OpenRouter models are fetched dynamically — see getOpenRouterModels()

// ─── OpenRouter helpers ────────────────────────────────────────────────────

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
  context_length?: number;
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

// Models to exclude even if they appear as free (poor instruction-following)
const OPENROUTER_BLOCKLIST = new Set(['openrouter/auto']);

// Cap how many free models we show to keep the dropdown manageable
const OPENROUTER_MAX_FREE = 8;

async function getOpenRouterModels(apiKey: string): Promise<ModelOption[]> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
      // Bypass Next.js data cache so we always get fresh model list
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as OpenRouterModelsResponse;

    const freeModels = data.data
      .filter(
        (m) =>
          m.id.endsWith(':free') &&
          !OPENROUTER_BLOCKLIST.has(m.id) &&
          m.pricing.prompt === '0' &&
          m.pricing.completion === '0',
      )
      .slice(0, OPENROUTER_MAX_FREE);

    return freeModels.map((m) => ({
      id: `openrouter::${m.id}`,
      label: `${m.name}`,
      provider: 'openrouter' as const,
      available: true,
      limit: { requestsPerDay: 200, requestsPerMinute: 20 },
      usage: getUsage(`openrouter::${m.id}`),
    }));
  } catch {
    // API unreachable — return a placeholder so the group still appears
    return [
      {
        id: 'openrouter::unavailable',
        label: 'Could not load models',
        provider: 'openrouter' as const,
        available: false,
        unavailableReason: 'Failed to fetch OpenRouter model list',
        usage: { today: 0, thisMinute: 0 },
      },
    ];
  }
}

// ─── Ollama helpers ────────────────────────────────────────────────────────

interface OllamaTagsResponse {
  models: { name: string }[];
}

const OLLAMA_FALLBACKS = ['llama3.2:3b', 'llama3.2:1b', 'llama3:8b', 'mistral:7b', 'gemma2:2b'];

async function getOllamaModels(): Promise<ModelOption[]> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as OllamaTagsResponse;
    const installedNames: string[] = (data.models ?? []).map((m) => m.name);

    if (installedNames.length === 0) {
      // Ollama running but no models pulled
      return OLLAMA_FALLBACKS.map((name) => ({
        id: `ollama::${name}`,
        label: name,
        provider: 'ollama' as const,
        available: false,
        unavailableReason: `Not pulled — run: ollama pull ${name}`,
        usage: getUsage(`ollama::${name}`),
      }));
    }

    return installedNames.map((name) => ({
      id: `ollama::${name}`,
      label: name,
      provider: 'ollama' as const,
      available: true,
      usage: getUsage(`ollama::${name}`),
    }));
  } catch {
    // Ollama not running — return greyed-out fallbacks
    return OLLAMA_FALLBACKS.map((name) => ({
      id: `ollama::${name}`,
      label: name,
      provider: 'ollama' as const,
      available: false,
      unavailableReason: 'Ollama not running — start it with: ollama serve',
      usage: getUsage(`ollama::${name}`),
    }));
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const ollamaModels = await getOllamaModels();

  const openRouterKey = process.env.OPENROUTER_API_KEY;

  const openrouterModels: ModelOption[] = openRouterKey
    ? await getOpenRouterModels(openRouterKey)
    : [
        {
          id: 'openrouter::placeholder',
          label: 'Free models (key not configured)',
          provider: 'openrouter' as const,
          available: false,
          unavailableReason: 'Add OPENROUTER_API_KEY to .env.local',
          usage: { today: 0, thisMinute: 0 },
        },
      ];

  const models: ModelOption[] = [
    ...ollamaModels,
    ...openrouterModels,
  ];

  return NextResponse.json(models);
}
