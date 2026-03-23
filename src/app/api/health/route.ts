import { NextResponse } from 'next/server';
import { Ollama } from 'ollama';

export const runtime = 'nodejs';

interface HealthResponse {
  ollama: {
    running: boolean;
    models: string[];
    error?: string;
  };
  ffmpeg: boolean;
}

export async function GET(): Promise<NextResponse> {
  const health: HealthResponse = {
    ollama: { running: false, models: [] },
    ffmpeg: false,
  };

  // Check Ollama
  try {
    const ollama = new Ollama({ host: 'http://localhost:11434' });
    const { models } = await ollama.list();
    health.ollama.running = true;
    health.ollama.models = models.map((m) => m.name);
  } catch (err) {
    health.ollama.running = false;
    const msg = err instanceof Error ? err.message : String(err);
    health.ollama.error = msg.includes('ECONNREFUSED') || msg.includes('fetch failed')
      ? 'Ollama is not running. Start with: ollama serve'
      : msg;
  }

  // Check FFmpeg — prefer bundled ffmpeg-static, fall back to system PATH
  try {
    const ffmpegStatic = (await import('ffmpeg-static')).default;
    if (ffmpegStatic) {
      health.ffmpeg = true;
    } else {
      const { execSync } = await import('child_process');
      execSync('ffmpeg -version', { stdio: 'ignore' });
      health.ffmpeg = true;
    }
  } catch {
    health.ffmpeg = false;
  }

  const allHealthy = health.ollama.running && health.ffmpeg;
  return NextResponse.json(health, { status: allHealthy ? 200 : 503 });
}
