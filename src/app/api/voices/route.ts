import { NextResponse } from 'next/server';
import type { VoiceOption } from '@/lib/types';

export const runtime = 'nodejs';

const VOICES: VoiceOption[] = [
  { id: 'en-US-AriaNeural', label: 'Aria (US, Female)' },
  { id: 'en-US-GuyNeural', label: 'Guy (US, Male)' },
  { id: 'en-US-JennyNeural', label: 'Jenny (US, Female)' },
  { id: 'en-US-EricNeural', label: 'Eric (US, Male)' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (GB, Female)' },
  { id: 'en-GB-RyanNeural', label: 'Ryan (GB, Male)' },
  { id: 'en-AU-NatashaNeural', label: 'Natasha (AU, Female)' },
  { id: 'en-AU-WilliamNeural', label: 'William (AU, Male)' },
  { id: 'en-CA-ClaraNeural', label: 'Clara (CA, Female)' },
];

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(VOICES);
}
