/**
 * Disk-backed usage tracker for rate-limited AI model APIs.
 *
 * Each model is tracked by its full ID (e.g. "groq::llama-3.3-70b-versatile").
 * Counts reset automatically when the UTC date or current minute changes.
 * Data is persisted to temp/usage.json after every update.
 */
import fs from 'fs';
import path from 'path';
import type { ModelUsage } from './types';

interface UsageEntry {
  date: string;         // "YYYY-MM-DD"
  todayCount: number;
  minuteKey: string;    // "YYYY-MM-DDTHH:MM"
  minuteCount: number;
}

type UsageStore = Record<string, UsageEntry>;

const USAGE_FILE = path.join(process.cwd(), 'temp', 'usage.json');

// In-memory cache — loaded lazily on first access
let cache: UsageStore | null = null;

function utcDate(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function utcMinuteKey(): string {
  return new Date().toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
}

function loadCache(): UsageStore {
  if (cache !== null) return cache;
  try {
    const raw = fs.readFileSync(USAGE_FILE, 'utf8');
    cache = JSON.parse(raw) as UsageStore;
  } catch {
    // File doesn't exist yet or is corrupt — start fresh
    cache = {};
  }
  return cache;
}

function persistAsync(): void {
  if (cache === null) return;
  const json = JSON.stringify(cache, null, 2);
  fs.writeFile(USAGE_FILE, json, 'utf8', (err) => {
    if (err) console.error('[usageTracker] Failed to persist usage.json:', err);
  });
}

function getEntry(modelId: string): UsageEntry {
  const store = loadCache();
  const today = utcDate();
  const minuteKey = utcMinuteKey();

  const existing = store[modelId];
  if (!existing) {
    const entry: UsageEntry = { date: today, todayCount: 0, minuteKey, minuteCount: 0 };
    store[modelId] = entry;
    return entry;
  }

  // Reset daily counter on UTC date rollover
  if (existing.date !== today) {
    existing.date = today;
    existing.todayCount = 0;
  }

  // Reset per-minute counter when minute changes
  if (existing.minuteKey !== minuteKey) {
    existing.minuteKey = minuteKey;
    existing.minuteCount = 0;
  }

  return existing;
}

export function recordUsage(modelId: string): void {
  const entry = getEntry(modelId);
  entry.todayCount += 1;
  entry.minuteCount += 1;
  persistAsync();
}

export function getUsage(modelId: string): ModelUsage {
  const entry = getEntry(modelId);
  return { today: entry.todayCount, thisMinute: entry.minuteCount };
}
