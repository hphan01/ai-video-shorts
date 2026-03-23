import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Prevent Next.js from bundling these packages — they rely on native Node.js
   * modules (child_process, fs streams, native addons) that must run in the
   * Node.js runtime, not in the Edge runtime or a Webpack bundle.
   */
  serverExternalPackages: ['fluent-ffmpeg', 'ffmpeg-static', 'ffprobe-static', 'msedge-tts', 'ollama'],
};

export default nextConfig;
