export default function RobotLogo() {
  return (
    <svg
      className="robot-logo"
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Antenna */}
      <line className="robot-antenna" x1="40" y1="10" x2="40" y2="20" stroke="#e02020" strokeWidth="2.5" strokeLinecap="round" />
      <circle className="robot-antenna-bulb" cx="40" cy="8" r="3.5" fill="#e02020" />

      {/* Head */}
      <rect className="robot-head" x="14" y="20" width="52" height="38" rx="9" fill="#1a1a1a" stroke="#e02020" strokeWidth="2" />

      {/* Left eye */}
      <rect className="robot-eye-left" x="22" y="30" width="13" height="10" rx="3" fill="#e02020" />
      <rect x="26" y="33" width="5" height="4" rx="1.5" fill="#000" />
      {/* Left eye glint */}
      <circle className="robot-glint" cx="27.5" cy="34" r="1" fill="#fff" opacity="0.9" />

      {/* Right eye */}
      <rect className="robot-eye-right" x="45" y="30" width="13" height="10" rx="3" fill="#e02020" />
      <rect x="49" y="33" width="5" height="4" rx="1.5" fill="#000" />
      {/* Right eye glint */}
      <circle className="robot-glint" cx="50.5" cy="34" r="1" fill="#fff" opacity="0.9" />

      {/* Mouth — grid of dots */}
      <rect x="25" y="46" width="4" height="4" rx="1" fill="#e02020" opacity="0.5" />
      <rect x="32" y="46" width="4" height="4" rx="1" fill="#e02020" />
      <rect x="39" y="46" width="4" height="4" rx="1" fill="#e02020" opacity="0.7" />
      <rect x="46" y="46" width="4" height="4" rx="1" fill="#e02020" opacity="0.5" />
      <rect x="53" y="46" width="4" height="4" rx="1" fill="#e02020" opacity="0.3" />

      {/* Ears / side bolts */}
      <rect x="9" y="30" width="6" height="8" rx="3" fill="#1a1a1a" stroke="#e02020" strokeWidth="1.5" />
      <rect x="65" y="30" width="6" height="8" rx="3" fill="#1a1a1a" stroke="#e02020" strokeWidth="1.5" />

      {/* Neck */}
      <rect x="32" y="58" width="16" height="6" rx="3" fill="#1a1a1a" stroke="#e02020" strokeWidth="1.5" />
    </svg>
  );
}
