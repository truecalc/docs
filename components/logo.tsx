// TrueCalc lockup for the docs nav — T-cube mark + TRUECALC wordmark.
// Mark is the primary (light + dark safe); wordmark is Archivo expanded (see design.md).
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        width="22"
        height="22"
        viewBox="14 16 68 68"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <polygon points="62,22 76,36 76,78 62,64" fill="#B5860E" />
        <polygon points="20,64 62,64 76,78 34,78" fill="#8A6608" />
        <rect x="20" y="22" width="42" height="42" fill="#FFC91C" />
        <path d="M26 28 H56 V37 H46 V58 H36 V37 H26 Z" fill="#0B0C0E" />
      </svg>
      <span
        style={{
          fontFamily: 'var(--font-logo), sans-serif',
          fontStretch: '125%',
          fontWeight: 800,
          fontSize: '15px',
          letterSpacing: '0.01em',
        }}
      >
        TRUECALC
      </span>
    </span>
  );
}
