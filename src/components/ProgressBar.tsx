interface ProgressBarProps {
  progress: number;
  message: string;
}

export default function ProgressBar({ progress, message }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <div
      className="progress-container"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Generation progress"
    >
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <p className="progress-message">{message}</p>
    </div>
  );
}
