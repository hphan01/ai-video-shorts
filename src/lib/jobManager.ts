import fs from 'fs/promises';
import type { JobState, JobStatus } from './types';

const jobs = new Map<string, JobState>();
const subscribers = new Map<
  string,
  Set<ReadableStreamDefaultController<Uint8Array>>
>();

export function createJob(id: string): JobState {
  const job: JobState = {
    id,
    status: 'pending',
    progress: 0,
    message: 'Starting…',
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): JobState | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, updates: Partial<Omit<JobState, 'id'>>): void {
  const job = jobs.get(id);
  if (!job) return;

  Object.assign(job, updates);
  broadcastJob(job);
}

function broadcastJob(job: JobState): void {
  const subs = subscribers.get(job.id);
  if (!subs || subs.size === 0) return;

  const encoder = new TextEncoder();
  const eventData = encoder.encode(`data: ${JSON.stringify(job)}\n\n`);
  const isDone = job.status === 'done' || job.status === 'error';

  for (const controller of [...subs]) {
    try {
      controller.enqueue(eventData);
      if (isDone) {
        controller.close();
        subs.delete(controller);
      }
    } catch {
      subs.delete(controller);
    }
  }
}

export function subscribeToJob(id: string): ReadableStream<Uint8Array> {
  let myController: ReadableStreamDefaultController<Uint8Array>;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      myController = controller;

      if (!subscribers.has(id)) {
        subscribers.set(id, new Set());
      }
      subscribers.get(id)!.add(controller);

      // Send the current state immediately so the client isn't left waiting
      const job = jobs.get(id);
      if (job) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(job)}\n\n`));
        if (job.status === 'done' || job.status === 'error') {
          controller.close();
          subscribers.get(id)?.delete(controller);
        }
      }
    },
    cancel() {
      subscribers.get(id)?.delete(myController);
    },
  });
}

/**
 * Schedules deletion of the job's temp directory and removal from the in-memory
 * map. Default: 1 hour for completed jobs, 5 minutes for errored jobs.
 */
export function scheduleCleanup(
  id: string,
  jobDir: string,
  delayMs = 60 * 60 * 1000,
): void {
  setTimeout(async () => {
    jobs.delete(id);
    subscribers.delete(id);
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup — ignore errors
    }
  }, delayMs);
}

/** Exposed for testing only */
export function _getJobsMap(): Map<string, JobState> {
  return jobs;
}

/** Exposed for testing only */
export function _clearAll(): void {
  jobs.clear();
  subscribers.clear();
}

export type { JobStatus };
