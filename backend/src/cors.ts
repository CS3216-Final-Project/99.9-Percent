// CORS_ORIGINS is a comma-separated list of exact origins or patterns where `*`
// matches one run of letters, digits and dashes, e.g.
//   https://lingoquest.vercel.app,https://lingoquest-*-myteam.vercel.app
// The second entry covers our own Vercel preview URLs without allowing every *.vercel.app site.

function toRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '[a-z0-9-]+');
  return new RegExp(`^${escaped}$`);
}

export function parseAllowedOrigins(value: string | undefined): RegExp[] {
  return (value ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
    .map(toRegExp);
}

export function isAllowedOrigin(origin: string, allowed: RegExp[]): boolean {
  return allowed.some((re) => re.test(origin));
}
