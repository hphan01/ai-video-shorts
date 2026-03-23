'use client';

import { useState, useEffect, useCallback } from 'react';
import type { JobStatus } from '@/lib/types';

interface VideoPreviewProps {
  jobId: string | null;
  status: JobStatus | null;
}

export default function VideoPreview({ jobId, status }: VideoPreviewProps) {
  // Derive open state: only truthy when explicitly opened AND job is done
  const [openJobId, setOpenJobId] = useState<string | null>(null);
  const open = openJobId !== null && openJobId === jobId && status === 'done';

  const close = useCallback(() => setOpenJobId(null), []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  if (!jobId || status === null) return null;

  if (status === 'done') {
    const videoSrc = `/api/download/${jobId}?inline=true`;
    const downloadHref = `/api/download/${jobId}`;
    const shortId = jobId.slice(0, 8);

    return (
      <>
        <button className="preview-btn" onClick={() => setOpenJobId(jobId)}>
          ▶ Preview Video
        </button>

        {open && (
          <div
            className="modal-backdrop"
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label="Video preview"
          >
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close" onClick={close} aria-label="Close">
                ✕
              </button>
              <video
                src={videoSrc}
                controls
                autoPlay
                className="modal-video"
                aria-label="Generated video"
              />
              <a
                href={downloadHref}
                download={`short-${shortId}.mp4`}
                className="download-btn"
              >
                ⬇ Download MP4
              </a>
            </div>
          </div>
        )}
      </>
    );
  }

  if (status === 'error') return null;

  return (
    <div className="video-loading" aria-label="loading">
      <div className="spinner" aria-hidden="true" />
      <p>Generating your video…</p>
    </div>
  );
}
