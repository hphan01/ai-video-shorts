// msedge-tts does not ship type declarations — declare the module shape we use
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts') as {
  MsEdgeTTS: new () => {
    setMetadata(voice: string, format: string): Promise<void>;
    toFile(
      folder: string,
      text: string,
    ): Promise<{ audioFilePath: string }>;
  };
  OUTPUT_FORMAT: Record<string, string>;
};

export async function generateTTS(
  text: string,
  jobDir: string,
  voice = 'en-US-AriaNeural',
): Promise<string> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(
    voice,
    OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
  );
  const { audioFilePath } = await tts.toFile(jobDir, text);
  return audioFilePath;
}
