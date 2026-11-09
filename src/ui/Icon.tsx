const PATHS = {
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  rotateLeft: 'M4 9V4m0 5h5M4.6 9A8 8 0 1 1 4 13',
  rotateRight: 'M20 9V4m0 5h-5M19.4 9A8 8 0 1 0 20 13',
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  download: 'M12 3v12m0 0l-5-5m5 5l5-5M4 19h16',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4',
  check: 'M5 12l5 5 9-10',
  warn: 'M12 3l10 18H2L12 3zM12 10v5M12 18v.01',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 11v6M12 7v.01',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  swap: 'M7 4v16M7 4L3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9v.01',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      class="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** App mark: an e-reader with a crescent moon on its screen. Same artwork as docs/icon.svg. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg class="logo" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect x="12" y="4" width="40" height="56" rx="7" fill="var(--logo-body)" />
      <rect x="17" y="10" width="30" height="40" rx="2" fill="var(--logo-screen)" />
      <path d="M36.5 20a10 10 0 1 0 4.5 16.8A12 12 0 0 1 36.5 20z" fill="var(--logo-body)" />
      <rect x="27" y="53" width="10" height="3" rx="1.5" fill="var(--logo-screen)" />
    </svg>
  );
}
