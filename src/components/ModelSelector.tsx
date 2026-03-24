'use client';

import { useEffect, useState } from 'react';
import type { ModelOption } from '@/lib/types';

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

const PROVIDER_LABELS: Record<string, string> = {
  ollama: 'Ollama (Local)',
  groq: 'Groq',
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
};

export default function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/models')
      .then((r) => r.json())
      .then((data: ModelOption[]) => {
        setModels(data);
        // If the current value is no longer present (e.g. Ollama offline),
        // auto-select the first available model to avoid a blank selection
        const selected = data.find((m) => m.id === value);
        if (!selected) {
          const firstAvailable = data.find((m) => m.available);
          if (firstAvailable) onChange(firstAvailable.id);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group models by provider for <optgroup> rendering
  const grouped: Record<string, ModelOption[]> = {};
  for (const m of models) {
    (grouped[m.provider] ??= []).push(m);
  }

  const selectedModel = models.find((m) => m.id === value);

  return (
    <div className="field">
      <label htmlFor="model-select" className="field-label">
        AI Model
      </label>
      <select
        id="model-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-input"
        aria-label="Select AI model"
        disabled={loading}
      >
        {loading && <option value="">Loading models…</option>}
        {Object.entries(grouped).map(([provider, providerModels]) => (
          <optgroup key={provider} label={PROVIDER_LABELS[provider] ?? provider}>
            {providerModels.map((m) => (
              <option
                key={m.id}
                value={m.id}
                disabled={!m.available}
                title={m.available ? undefined : m.unavailableReason}
              >
                {m.available ? m.label : `${m.label} — ${m.unavailableReason ?? 'unavailable'}`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {selectedModel?.limit && selectedModel.usage !== undefined && (
        <div className="model-usage">
          <span className="model-usage__item">
            <span className="model-usage__key">Today</span>
            <span className="model-usage__bar-wrap">
              <span
                className="model-usage__bar-fill"
                style={{
                  width: `${Math.min(100, (selectedModel.usage.today / selectedModel.limit.requestsPerDay) * 100)}%`,
                }}
              />
            </span>
            <span className="model-usage__value">
              {selectedModel.usage.today.toLocaleString()}&nbsp;/&nbsp;
              {selectedModel.limit.requestsPerDay.toLocaleString()}
            </span>
          </span>
          <span className="model-usage__sep">·</span>
          <span className="model-usage__item">
            <span className="model-usage__key">This min</span>
            <span className="model-usage__bar-wrap">
              <span
                className="model-usage__bar-fill"
                style={{
                  width: `${Math.min(100, (selectedModel.usage.thisMinute / selectedModel.limit.requestsPerMinute) * 100)}%`,
                }}
              />
            </span>
            <span className="model-usage__value">
              {selectedModel.usage.thisMinute}&nbsp;/&nbsp;
              {selectedModel.limit.requestsPerMinute}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
