// Minimal hand-rolled stroke icons (24x24, currentColor) — the app has no
// icon library dependency, and the sidebar only needs a handful of glyphs.
export function IconGrid(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  );
}

export function IconUser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-3.5 4.2-5.5 7.5-5.5s6.3 2 7.5 5.5" />
    </svg>
  );
}

export function IconUsers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2.5 19c1-3 3.3-4.7 6.5-4.7s5.5 1.7 6.5 4.7" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.5 14.6c2.4.3 4.1 1.9 5 4.4" />
    </svg>
  );
}

export function IconIdCard(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="12" r="2" />
      <path d="M6.3 16.5c.6-1.5 1.6-2.2 2.7-2.2s2.1.7 2.7 2.2M14.5 9.5h4M14.5 13h4" />
    </svg>
  );
}

export function IconLayers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3.5l8 4.3-8 4.3-8-4.3 8-4.3z" />
      <path d="M4 12.2l8 4.3 8-4.3M4 16l8 4.3L20 16" />
    </svg>
  );
}

export function IconBell(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9.5a6 6 0 1112 0c0 4 1.3 5.7 2 6.5H4c.7-.8 2-2.5 2-6.5z" />
      <path d="M9.5 19a2.5 2.5 0 005 0" />
    </svg>
  );
}

export function IconTarget(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </svg>
  );
}

export function IconShield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 3.5l7 2.5v5.3c0 4.4-2.9 7.9-7 9.2-4.1-1.3-7-4.8-7-9.2V6l7-2.5z" />
      <path d="M8.7 12.2l2.2 2.2 4.4-4.4" />
    </svg>
  );
}

export function IconClock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function IconDollar(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.5 9.3c-.4-.8-1.3-1.3-2.5-1.3-1.6 0-2.7.8-2.7 2s1 1.6 2.7 2 2.7.8 2.7 2-1.1 2-2.7 2c-1.2 0-2.1-.5-2.5-1.3M12 6.7v10.6" />
    </svg>
  );
}

export function IconBadge(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="9.5" r="6" />
      <path d="M9 14.8L7.5 21l4.5-2.5 4.5 2.5-1.5-6.2" />
    </svg>
  );
}

export function IconUserCheck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3 20c1.1-3.5 3.7-5.5 6.5-5.5s5.4 2 6.5 5.5" />
      <path d="M15.5 12l2 2 3.5-3.5" />
    </svg>
  );
}

export function IconFolder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3.5 6.5a1.5 1.5 0 011.5-1.5h4l2 2.2h7.5a1.5 1.5 0 011.5 1.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 013.5 17.7v-11.2z" />
    </svg>
  );
}

export function IconPencil(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 20l.9-4.2L15.6 5.1a1.5 1.5 0 012.1 0l1.2 1.2a1.5 1.5 0 010 2.1L8.2 19.1 4 20z" />
      <path d="M14 7l3 3" />
    </svg>
  );
}

export function IconFilter(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5z" />
    </svg>
  );
}

export function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M19.5 19.5l-4.3-4.3" />
    </svg>
  );
}

export function IconClipboardList(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3.5h6a1 1 0 011 1V6H8V4.5a1 1 0 011-1z" />
      <path d="M8.5 11h7M8.5 14.5h7M8.5 18h4.5" />
    </svg>
  );
}
