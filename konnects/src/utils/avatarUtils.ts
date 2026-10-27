/**
 * Utility functions for user profile avatar generation and initial fallback extraction.
 */

export function getProfileInitials(
  firstName?: string,
  lastName?: string,
  fullName?: string,
  username?: string
): string {
  if (firstName && firstName.trim() && lastName && lastName.trim()) {
    const f = firstName.trim().charAt(0);
    const l = lastName.trim().charAt(0);
    if (f || l) return (f + l).toUpperCase();
  }

  const nameToUse = fullName || firstName || username || '';
  if (!nameToUse) return 'KS';

  // Clean string removing handles, symbols
  const cleanName = nameToUse.replace(/[@_.]/g, ' ').trim();
  const parts = cleanName.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  } else if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  } else if (parts.length === 1 && parts[0].length === 1) {
    return parts[0].toUpperCase();
  }

  return 'KS';
}

/**
 * Generates an SVG Data URL with initials rendered over a stylish gradient canvas.
 */
export function generateInitialsAvatarDataUrl(
  initials: string,
  gradientStart = '#4f46e5',
  gradientEnd = '#7c3aed'
): string {
  const safeInitials = (initials || 'KS').slice(0, 3).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${gradientStart}"/>
        <stop offset="100%" stop-color="${gradientEnd}"/>
      </linearGradient>
    </defs>
    <rect width="128" height="128" rx="64" fill="url(#g)"/>
    <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="48" letter-spacing="1">${safeInitials}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
