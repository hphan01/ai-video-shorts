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

async function submitJob(prompt: string, attempt = 0): Promise<string> {
  const enriched = `${prompt}, vertical portrait orientation, cinematic, high quality, 9:16 aspect ratio`;
  try {
    const res = await axios.post<{ id: string }>(
      `${HORDE_BASE}/generate/async`,
      {
        prompt: enriched,
        params: { width: 512, height: 768, steps: 20, cfg_scale: 7 },
        r2: true,
      },
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
    if (status === 429 && attempt < 4) {
      // Exponential backoff: 2s, 4s, 8s, 16s
      const delay = 2_000 * Math.pow(2, attempt);
      await new Promise<void>((r) => setTimeout(r, delay));
      return submitJob(prompt, attempt + 1);
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
): Promise<string[]> {
  // With a real API key submit all jobs in parallel; anonymous key submits sequentially
  // to avoid 429 rate-limits (the retry backoff in submitJob handles any residual limits)
  const isAnon = HORDE_API_KEY === '0000000000';

  let jobIds: string[];
  try {
    if (isAnon) {
      jobIds = [];
      for (const p of imagePrompts) {
        jobIds.push(await submitJob(p));
        await new Promise<void>((r) => setTimeout(r, 1_500));
      }
    } else {
      jobIds = await Promise.all(imagePrompts.map((p) => submitJob(p)));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
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
