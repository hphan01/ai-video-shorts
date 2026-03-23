'use client';

import { useEffect, useState } from 'react';

interface HealthData {
  ollama: { running: boolean; models: string[]; error?: string };
  ffmpeg: boolean;
}

export default function StatusBanner() {
  const [health, setHealth] = useState<HealthData | null>(null);

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch('/api/health');
        const data = (await res.json()) as HealthData;
        setHealth(data);
      } catch {
        setHealth({ ollama: { running: false, models: [], error: 'Could not reach server' }, ffmpeg: false });
      }
    }
    void check();
  }, []);

  if (!health) return null;

  const ollamaOk = health.ollama.running;
  const ffmpegOk = health.ffmpeg;
  const allOk = ollamaOk && ffmpegOk;

  if (allOk) {
    const modelList = health.ollama.models.join(', ') || '(none)';
    return (
      <div className="banner banner--ok">
        ✓ Ready — Ollama ({modelList}) · FFmpeg
      </div>
    );
  }

  return (
    <div className="banner banner--warn">
      <strong>Setup required:</strong>
      <ul className="banner-list">
        {!ollamaOk && (
          <li>
            Ollama not running.{' '}
            <a
              href="https://ollama.com/download"
              target="_blank"
              rel="noopener noreferrer"
            >
              Install Ollama
            </a>{' '}
            then run{' '}
            <code>ollama serve</code> and{' '}
            <code>ollama pull llama3.2:3b</code>
            {health.ollama.error && (
              <span className="banner-detail"> ({health.ollama.error})</span>
            )}
          </li>
        )}
        {ollamaOk && health.ollama.models.length === 0 && (
          <li>
            No models found. Run: <code>ollama pull llama3.2:3b</code>
          </li>
        )}
        {!ffmpegOk && (
          <li>
            FFmpeg not found in PATH.{' '}
            <a
              href="https://ffmpeg.org/download.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Install FFmpeg
            </a>{' '}
            and ensure it is in your system PATH.
          </li>
        )}
      </ul>
    </div>
  );
}
