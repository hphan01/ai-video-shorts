import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ProgressBar from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders the progress message', () => {
    render(<ProgressBar progress={50} message="Generating script…" />);
    expect(screen.getByText('Generating script…')).toBeInTheDocument();
  });

  it('renders the progressbar role with correct ARIA attributes', () => {
    render(<ProgressBar progress={75} message="Testing" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '75');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('fill element has 0% width at zero progress', () => {
    const { container } = render(<ProgressBar progress={0} message="Starting" />);
    const fill = container.querySelector('.progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('fill element has 50% width at half progress', () => {
    const { container } = render(<ProgressBar progress={50} message="Halfway" />);
    const fill = container.querySelector('.progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('50%');
  });

  it('fill element has 100% width at full progress', () => {
    const { container } = render(<ProgressBar progress={100} message="Done!" />);
    const fill = container.querySelector('.progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('clamps negative progress to 0%', () => {
    const { container } = render(<ProgressBar progress={-10} message="Clamped" />);
    const fill = container.querySelector('.progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('0%');
  });

  it('clamps progress above 100 to 100%', () => {
    const { container } = render(<ProgressBar progress={150} message="Overflow" />);
    const fill = container.querySelector('.progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });
});
