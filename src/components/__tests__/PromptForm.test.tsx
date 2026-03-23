import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import PromptForm from '../PromptForm';

describe('PromptForm', () => {
  it('renders the textarea and submit button', () => {
    render(<PromptForm onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.getByRole('textbox', { name: /video prompt/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /generate short/i })).toBeInTheDocument();
  });

  it('submit button is disabled when textarea is empty', () => {
    render(<PromptForm onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('submit button becomes enabled after typing', async () => {
    const user = userEvent.setup();
    render(<PromptForm onSubmit={vi.fn()} isLoading={false} />);
    await user.type(screen.getByRole('textbox'), 'Hello world');
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('calls onSubmit with trimmed prompt value on submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PromptForm onSubmit={onSubmit} isLoading={false} />);
    await user.type(screen.getByRole('textbox'), '  My topic  ');
    await user.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith('My topic');
  });

  it('does not call onSubmit when whitespace-only prompt is submitted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<PromptForm onSubmit={onSubmit} isLoading={false} />);
    await user.type(screen.getByRole('textbox'), '   ');
    // button is still disabled for whitespace-only input
    expect(screen.getByRole('button')).toBeDisabled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('disables textarea and button while loading', () => {
    render(<PromptForm onSubmit={vi.fn()} isLoading={true} />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /generating/i })).toBeDisabled();
  });
});
