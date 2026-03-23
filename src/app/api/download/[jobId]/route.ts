import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import fs from 'fs';
import { Readable } from 'stream';
import { getJob } from '@/lib/jobManager';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const { jobId } = await params;
  const job = getJob(jobId);

  if (!job || !job.outputPath) {
    return NextResponse.json(
      { error: 'Video not found or not ready yet' },
      { status: 404 },
    );
  }

  if (job.status !== 'done') {
    return NextResponse.json(
      { error: `Job is not complete (status: ${job.status})` },
      { status: 409 },
    );
  }

  if (!fs.existsSync(job.outputPath)) {
    return NextResponse.json(
      { error: 'Video file not found on disk' },
      { status: 404 },
    );
  }

  const stat = fs.statSync(job.outputPath);
  const inline = request.nextUrl.searchParams.get('inline') === 'true';
  const shortId = jobId.slice(0, 8);

  const nodeStream = fs.createReadStream(job.outputPath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new Response(webStream, {
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(stat.size),
      'Content-Disposition': inline
        ? 'inline'
        : `attachment; filename="short-${shortId}.mp4"`,
      'Cache-Control': 'no-store',
    },
  });
}
