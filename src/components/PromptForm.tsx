'use client';

import { useState } from 'react';

interface PromptFormProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

export default function PromptForm({ onSubmit, isLoading }: PromptFormProps) {
  const [prompt, setPrompt] = useState('');

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (trimmed && !isLoading) {
      onSubmit(trimmed);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="prompt-form">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe your video short topic, e.g. 'The history of the internet'"
        disabled={isLoading}
        rows={3}
        className="prompt-textarea"
        aria-label="Video prompt"
      />
      <button
        type="submit"
        disabled={isLoading || prompt.trim().length === 0}
        className="generate-btn"
      >
        {isLoading ? 'Generating…' : 'Generate Short'}
      </button>
    </form>
  );
}
