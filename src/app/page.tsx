'use client';

import { useState, useCallback, useRef } from 'react';
import PromptForm from '@/components/PromptForm';
import VoiceSelector from '@/components/VoiceSelector';
import ModelSelector from '@/components/ModelSelector';
import ReferenceImageInput from '@/components/ReferenceImageInput';
import ProgressBar from '@/components/ProgressBar';
import VideoPreview from '@/components/VideoPreview';
import StatusBanner from '@/components/StatusBanner';
import RobotLogo from '@/components/RobotLogo';
import type { JobStatus } from '@/lib/types';

interface SSEPayload {
  id: string;
  status: JobStatus;
  progress: number;
  message: string;
  outputPath?: string;
}

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [voice, setVoice] = useState('en-US-AriaNeural');
  const [model, setModel] = useState('ollama::llama3.2:3b');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const esRef = useRef<EventSource | null>(null);

  const handleGenerate = useCallback(
    async (prompt: string) => {
      esRef.current?.close();
      setProgress(0);
      setMessage('Starting…');
      setStatus('pending');
      setJobId(null);

      let res: Response;
      try {
        res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, voice, model, referenceImageUrl }),
        });
      } catch {
        setStatus('error');
        setMessage('Network error — could not reach the server.');
        return;
      }

      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        setStatus('error');
        setMessage(`Failed to start: ${err.error}`);
        return;
      }

      const { jobId: newJobId } = (await res.json()) as { jobId: string };
      setJobId(newJobId);

      const es = new EventSource(`/api/progress/${newJobId}`);
      esRef.current = es;

      es.onmessage = (e) => {
        const data = JSON.parse(e.data as string) as SSEPayload;
        setStatus(data.status);
        setProgress(data.progress);
        setMessage(data.message);
        if (data.status === 'done' || data.status === 'error') {
          es.close();
        }
      };

      es.onerror = () => {
        setStatus('error');
        setMessage('Connection lost. Reload the page.');
        es.close();
      };
    },
    [voice, model, referenceImageUrl],
  );

  const isLoading =
    status !== null && status !== 'done' && status !== 'error';

  return (
    <main className="main">
      <header className="hero">
        <RobotLogo />
        <h1 className="title">AI Video Shorts</h1>
        <p className="subtitle">
          Generate TikTok &amp; YouTube Shorts from a text prompt — 100% free
        </p>
      </header>

      <StatusBanner />

      <section className="controls-row">
        <VoiceSelector value={voice} onChange={setVoice} />
        <ModelSelector value={model} onChange={setModel} />
        <ReferenceImageInput value={referenceImageUrl} onChange={setReferenceImageUrl} disabled={isLoading} />
      </section>

      <PromptForm onSubmit={handleGenerate} isLoading={isLoading} />

      {status && <ProgressBar progress={progress} message={message} />}

      <VideoPreview jobId={jobId} status={status} />
    </main>
  );
}

