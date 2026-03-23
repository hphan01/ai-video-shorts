'use client';

import { useEffect, useState } from 'react';
import type { VoiceOption } from '@/lib/types';

interface VoiceSelectorProps {
  value: string;
  onChange: (voice: string) => void;
}

export default function VoiceSelector({ value, onChange }: VoiceSelectorProps) {
  const [voices, setVoices] = useState<VoiceOption[]>([]);

  useEffect(() => {
    fetch('/api/voices')
      .then((r) => r.json())
      .then((data: VoiceOption[]) => setVoices(data))
      .catch(console.error);
  }, []);

  return (
    <div className="field">
      <label htmlFor="voice-select" className="field-label">
        Voice
      </label>
      <select
        id="voice-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
        aria-label="Select voice"
      >
        {voices.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </select>
    </div>
  );
}
