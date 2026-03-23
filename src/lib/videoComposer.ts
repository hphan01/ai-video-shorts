import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import fs from 'fs/promises';
import path from 'path';

// Use bundled binaries so no system-level install is required
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}
ffmpeg.setFfprobePath(ffprobeStatic.path);

function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) return reject(err);
      const duration = metadata.format.duration;
      if (duration === undefined || duration === null) {
        return reject(new Error('Could not determine audio duration from ffprobe'));
      }
      resolve(duration);
    });
  });
}

/**
 * Sanitises a caption string so it is safe to embed in an FFmpeg drawtext filter.
 * Special characters that have meaning in the FFmpeg filter graph are removed/escaped.
 */
function sanitiseCaption(text: string): string {
  return text
    .replace(/\\/g, '\\\\') // escape backslashes first
    .replace(/'/g, '')       // remove single quotes (used as option delimiters)
    .replace(/:/g, '\\:')    // escape colons (option separator in drawtext)
    .replace(/[{}[\]]/g, '') // remove filter-graph special chars
    .replace(/[^\x20-\x7E]/g, '') // keep printable ASCII only
    .trim();
}

/**
 * Word-wraps text to at most maxChars per line, joining with FFmpeg's \n escape.
 * For a 1080px video at fontsize=60 (Arial Bold ~33px/char), ~28 chars fits safely.
 */
function wrapCaption(text: string, maxChars = 28): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
    } else if (current.length + 1 + word.length <= maxChars) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join('\\n');
}

export async function composeVideo(
  imagePaths: string[],
  audioPath: string,
  jobDir: string,
  outputPath: string,
  captions: string[],
): Promise<string> {
  const audioDuration = await getAudioDuration(audioPath);
  const sceneCount = imagePaths.length;
  const sceneDuration = audioDuration / sceneCount;

  // Build ffmpeg concat demuxer input file
  // Each entry: "file '<path>'\nduration <seconds>"
  // The last entry must be repeated without a duration (concat demuxer requirement)
  const concatLines = imagePaths
    .map(
      (p) =>
        `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'\nduration ${sceneDuration.toFixed(4)}`,
    )
    .join('\n');
  const lastImage = imagePaths[imagePaths.length - 1];
  const concatContent = `${concatLines}\nfile '${lastImage.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`;

  const concatFile = path.join(jobDir, 'concat.txt');
  await fs.writeFile(concatFile, concatContent, 'utf8');

  // Build the -vf filter string:
  // 1. Scale to fit within 1080×1920, preserving aspect ratio
  // 2. Pad to exactly 1080×1920 with black bars
  // 3. One drawtext overlay per scene, enabled only during its time window
  const drawtextFilters = captions.map((caption, i) => {
    const startTime = (i * sceneDuration).toFixed(4);
    const endTime = ((i + 1) * sceneDuration).toFixed(4);
    const safeCaption = wrapCaption(sanitiseCaption(caption));
    return (
      `drawtext=text='${safeCaption}':` +
      `fontfile='C\\:/Windows/Fonts/arialbd.ttf':` +
      `fontsize=60:fontcolor=white:` +
      `borderw=3:bordercolor=black:` +
      `shadowx=2:shadowy=2:shadowcolor=black@0.6:` +
      `x=(w-text_w)/2:y=h*0.75:` +
      `line_spacing=8:` +
      `enable='between(t,${startTime},${endTime})'`
    );
  });

  const vfFilter = [
    'scale=1080:1920:force_original_aspect_ratio=decrease',
    'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black',
    ...drawtextFilters,
  ].join(',');

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatFile)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .input(audioPath)
      .outputOptions([
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-vf', vfFilter,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-shortest',
      ])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err: Error) => reject(new Error(`FFmpeg error: ${err.message}`)));
  });
}
