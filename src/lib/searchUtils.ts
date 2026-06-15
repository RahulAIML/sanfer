/** Lowercase + strip diacritics: García→garcia, Muñoz→munoz, José→jose */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

/**
 * Token-based, accent-insensitive search.
 * All space-separated tokens in `query` must appear in at least one of the
 * provided `fields` — order doesn't matter.
 * Returns true when query is empty.
 */
export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = norm(query.trim())
  if (!q) return true
  const tokens = q.split(/\s+/).filter(Boolean)
  const normalizedFields = fields.map((f) => norm(f ?? ''))
  return tokens.every((tok) => normalizedFields.some((field) => field.includes(tok)))
}
