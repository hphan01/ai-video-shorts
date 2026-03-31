'use client';

import { useState } from 'react';

interface ReferenceImageInputProps {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
}

export default function ReferenceImageInput({ value, onChange, disabled }: ReferenceImageInputProps) {
  const [error, setError] = useState<string | null>(null);

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    const url = e.target.value.trim();
    onChange(url);
    setError(null);
  }

  function handleValidate() {
    if (!value) return;
    try {
      new URL(value);
      setError(null);
    } catch {
      setError('Enter a valid URL');
    }
  }

  return (
    <div className="field">
      <label htmlFor="ref-img-input" className="field-label">
        Reference Image
      </label>
      <div className="reference-image-field">
        <input
          id="ref-img-input"
          type="url"
          value={value}
          onChange={handleUrlChange}
          onBlur={handleValidate}
          placeholder="https://example.com/photo.jpg"
          disabled={disabled}
          className="field-input"
        />
        {error && <span className="field-error">{error}</span>}
        {value && !error && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Reference preview" className="reference-preview" />
        )}
      </div>
    </div>
  );
}
