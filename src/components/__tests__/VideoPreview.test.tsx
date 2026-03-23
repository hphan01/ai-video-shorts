import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import VideoPreview from '../VideoPreview';

describe('VideoPreview', () => {
  it('renders nothing when jobId is null', () => {
    const { container } = render(<VideoPreview jobId={null} status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when status is null even with a jobId', () => {
    const { container } = render(<VideoPreview jobId="abc" status={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a loading spinner while job is in progress (scripting)', () => {
    render(<VideoPreview jobId="test-id" status="scripting" />);
    expect(screen.getByRole('generic', { name: 'loading' })).toBeInTheDocument();
    expect(screen.getByText(/generating your video/i)).toBeInTheDocument();
  });

  it('shows a loading spinner while job is composing', () => {
    render(<VideoPreview jobId="test-id" status="composing" />);
    expect(screen.getByRole('generic', { name: 'loading' })).toBeInTheDocument();
  });

  it('shows the video player and a download link when status is done', async () => {
    const user = userEvent.setup();
    render(<VideoPreview jobId="abc-12345-xyz" status="done" />);

    // Modal is closed initially — click the preview button to open it
    await user.click(screen.getByRole('button', { name: /preview video/i }));

    const video = screen.getByLabelText('Generated video');
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute('src', '/api/download/abc-12345-xyz?inline=true');

    const link = screen.getByRole('link', { name: /download mp4/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/api/download/abc-12345-xyz');
  });

  it('renders nothing for error status (error shown in ProgressBar)', () => {
    const { container } = render(<VideoPreview jobId="fail-id" status="error" />);
    expect(container.querySelector('.video-preview')).toBeNull();
    expect(container.querySelector('.video-loading')).toBeNull();
  });
});
