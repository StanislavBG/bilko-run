export function Chevron({ up }: { up?: boolean }) {
  return (
    <svg className="smlp-turn__chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={up ? 'M3 10.5 8 5.5l5 5' : 'M3 5.5 8 10.5l5-5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
