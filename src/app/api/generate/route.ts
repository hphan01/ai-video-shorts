import { type NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import {
  createJob,
  updateJob,
  scheduleCleanup,
} from '@/lib/jobManager';
import { generateScript } from '@/lib/scriptGenerator';
import { generateTTS } from '@/lib/ttsGenerator';
import { generateImages } from '@/lib/imageGenerator';
import { composeVideo } from '@/lib/videoComposer';
import { recordUsage } from '@/lib/usageTracker';
import type { GenerateRequest } from '@/lib/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, voice = 'en-US-AriaNeural', model = 'ollama::llama3.2:3b', referenceImageUrl } =
    body as GenerateRequest;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return NextResponse.json(
      { error: 'prompt is required and must be a non-empty string' },
      { status: 400 },
    );
  }

  const jobId = uuidv4();
  const jobDir = path.join(process.cwd(), 'temp', jobId);
  const outputDir = path.join(process.cwd(), 'output');
  const outputPath = path.join(outputDir, `${jobId}.mp4`);

  await fs.mkdir(jobDir, { recursive: true });
  await fs.mkdir(outputDir, { recursive: true });

  let referenceImageBase64: string | undefined;
  if (referenceImageUrl) {
    try {
      referenceImageBase64 = await loadReferenceImage(referenceImageUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  createJob(jobId);

  // Run pipeline asynchronously — do not await
  void runPipeline(jobId, jobDir, outputPath, prompt.trim(), voice, model, referenceImageBase64);

  return NextResponse.json({ jobId });
}

async function loadReferenceImage(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Failed to fetch reference image: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const base64 = Buffer.from(buf).toString('base64');
  return base64;
}

async function runPipeline(
  jobId: string,
  jobDir: string,
  outputPath: string,
  prompt: string,
  voice: string,
  model: string,
  referenceImageBase64?: string,
): Promise<void> {
  try {
    updateJob(jobId, {
      status: 'scripting',
      progress: 10,
      message: 'Generating script with AI…',
    });
    recordUsage(model);
    const script = await generateScript(prompt, model);

    updateJob(jobId, {
      status: 'tts',
      progress: 30,
      message: 'Generating voice narration…',
    });
    const audioPath = await generateTTS(script.narration, jobDir, voice);

    updateJob(jobId, {
      status: 'images',
      progress: 50,
      message: 'Generating scene images (5 of 5)…',
    });
    const imagePaths = await generateImages(
      script.scenes.map((s) => s.imagePrompt),
      jobDir,
      referenceImageBase64,
    );

    updateJob(jobId, {
      status: 'composing',
      progress: 75,
      message: 'Composing video with FFmpeg…',
    });
    await composeVideo(
      imagePaths,
      audioPath,
      jobDir,
      outputPath,
      script.scenes.map((s) => s.caption),
    );

    updateJob(jobId, {
      status: 'done',
      progress: 100,
      message: 'Video ready!',
      outputPath,
    });
    scheduleCleanup(jobId, jobDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    updateJob(jobId, {
      status: 'error',
      progress: 0,
      message: `Error: ${message}`,
    });
    scheduleCleanup(jobId, jobDir, 5 * 60 * 1000);
  }
}
