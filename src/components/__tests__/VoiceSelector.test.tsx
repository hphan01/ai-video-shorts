import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import VoiceSelector from '../VoiceSelector';

const MOCK_VOICES = [
  { id: 'en-US-AriaNeural', label: 'Aria (US, Female)' },
  { id: 'en-US-GuyNeural', label: 'Guy (US, Male)' },
  { id: 'en-GB-SoniaNeural', label: 'Sonia (GB, Female)' },
];

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_VOICES,
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('VoiceSelector', () => {
  it('renders a select/combobox element', async () => {
    render(<VoiceSelector value="en-US-AriaNeural" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });

  it('fetches and displays all voice options from /api/voices', async () => {
    render(<VoiceSelector value="en-US-AriaNeural" onChange={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Aria (US, Female)')).toBeInTheDocument();
      expect(screen.getByText('Guy (US, Male)')).toBeInTheDocument();
      expect(screen.getByText('Sonia (GB, Female)')).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith('/api/voices');
  });

  it('has the correct initial value selected', async () => {
    render(<VoiceSelector value="en-US-GuyNeural" onChange={vi.fn()} />);
    await waitFor(() => screen.getByText('Aria (US, Female)'));
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('en-US-GuyNeural');
  });

  it('calls onChange with the new voice id when another option is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<VoiceSelector value="en-US-AriaNeural" onChange={onChange} />);
    await waitFor(() => screen.getByText('Guy (US, Male)'));
    await user.selectOptions(screen.getByRole('combobox'), 'en-US-GuyNeural');
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('en-US-GuyNeural');
  });

  it('renders without crashing when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );
    render(<VoiceSelector value="en-US-AriaNeural" onChange={vi.fn()} />);
    // Should render an empty select without throwing
    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
  });
});
