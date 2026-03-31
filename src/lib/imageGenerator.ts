import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';

const HORDE_BASE = 'https://stablehorde.net/api/v2';
const HORDE_API_KEY = process.env.STABLE_HORDE_API_KEY ?? '0000000000';
const POLL_INTERVAL_MS = 5_000;
const GENERATION_TIMEOUT_MS = 300_000; // 5 minutes per image

interface HordeCheckResponse {
  done: boolean;
  faulted: boolean;
}

interface HordeGeneration {
  img: string;
  censored: boolean;
}

interface HordeStatusResponse {
  done: boolean;
  faulted: boolean;
  generations: HordeGeneration[];
}

const NEGATIVE_PROMPT =
  'blurry, low quality, low resolution, worst quality, bad anatomy, bad hands, ' +
  'extra fingers, missing fingers, deformed, ugly, duplicate, morbid, mutilated, ' +
  'out of frame, extra limbs, disfigured, gross proportions, watermark, signature, ' +
  'text, logo, generic, stock photo, cartoon, anime, 3d render, painting';

// Preferred models — Stable Horde will use the first available worker that has one of these.
// These models are known for accurate character/face detail and photorealism.
const PREFERRED_MODELS = [
  'Realistic Vision 5.1',
  'Deliberate 3',
  'Deliberate',
  'Dreamshaper',
];

async function submitJob(prompt: string, referenceImageBase64?: string, attempt = 0): Promise<string> {
  const enriched =
    `${prompt}, vertical portrait orientation, cinematic lighting, sharp focus, ` +
    `highly detailed, 8k uhd, professional photography, 9:16 aspect ratio`;

  const params: Record<string, unknown> = {
    width: 512,
    height: 768,
    steps: 30,
    cfg_scale: 7.5,
    sampler_name: 'k_dpmpp_2m',
    karras: true,
  };

  const body: Record<string, unknown> = {
    prompt: `${enriched} ### ${NEGATIVE_PROMPT}`,
    params,
    models: PREFERRED_MODELS,
    r2: true,
  };

  if (referenceImageBase64) {
    body.source_image = referenceImageBase64;
    body.source_processing = 'img2img';
    params.denoising_strength = 0.7;
  }

  try {
    const res = await axios.post<{ id: string }>(
      `${HORDE_BASE}/generate/async`,
      body,
      {
        headers: {
          apikey: HORDE_API_KEY,
          'Content-Type': 'application/json',
          'Client-Agent': 'ai-video-shorts:1.0:anon',
        },
        timeout: 30_000,
      },
    );
    return res.data.id;
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    const responseBody = axios.isAxiosError(err) ? err.response?.data : undefined;
    if (status === 400 && responseBody) {
      console.error('Stable Horde 400 response:', JSON.stringify(responseBody, null, 2));
    }
    if (status === 429 && attempt < 4) {
      // Exponential backoff: 2s, 4s, 8s, 16s
      const delay = 2_000 * Math.pow(2, attempt);
      await new Promise<void>((r) => setTimeout(r, delay));
      return submitJob(prompt, referenceImageBase64, attempt + 1);
    }
    throw err;
  }
}

async function waitForJob(jobId: string): Promise<string> {
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
    const check = await axios.get<HordeCheckResponse>(
      `${HORDE_BASE}/generate/check/${jobId}`,
      { timeout: 10_000 },
    );
    if (check.data.faulted) {
      throw new Error(`Stable Horde faulted on job ${jobId}`);
    }
    if (check.data.done) {
      const status = await axios.get<HordeStatusResponse>(
        `${HORDE_BASE}/generate/status/${jobId}`,
        { timeout: 10_000 },
      );
      const gen = status.data.generations[0];
      if (!gen) throw new Error('No image returned by Stable Horde');
      if (gen.censored) throw new Error('Stable Horde censored this image prompt');
      return gen.img;
    }
  }
  throw new Error('Image generation timed out after 5 minutes');
}

export async function generateImages(
  imagePrompts: string[],
  jobDir: string,
  referenceImageBase64?: string,
): Promise<string[]> {
  // With a real API key submit all jobs in parallel; anonymous key submits sequentially
  // to avoid 429 rate-limits (the retry backoff in submitJob handles any residual limits)
  const isAnon = HORDE_API_KEY === '0000000000';

  let jobIds: string[];
  try {
    if (isAnon) {
      jobIds = [];
      for (const p of imagePrompts) {
        jobIds.push(await submitJob(p, referenceImageBase64));
        await new Promise<void>((r) => setTimeout(r, 1_500));
      }
    } else {
      jobIds = await Promise.all(imagePrompts.map((p) => submitJob(p, referenceImageBase64)));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const resp = axios.isAxiosError(err) ? err.response?.data : undefined;
    if (resp) {
      console.error('Stable Horde submit error response:', JSON.stringify(resp, null, 2));
    }
    throw new Error(`Failed to submit image jobs to Stable Horde: ${msg}`);
  }

  const imagePaths: string[] = [];
  for (let i = 0; i < jobIds.length; i++) {
    try {
      const imageUrl = await waitForJob(jobIds[i]);
      const response = await axios.get<Buffer>(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 60_000,
      });
      const imagePath = path.join(jobDir, `image_${i}.webp`);
      await fs.writeFile(imagePath, response.data);
      imagePaths.push(imagePath);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Image generation failed for scene ${i + 1}: ${msg}`);
    }
  }

  return imagePaths;
}
