// Builds a PostgREST .or() filter for check-in search (lookup_code exact OR
// team_name partial). Values containing reserved chars (comma, parens) must be
// double-quoted inside an or() group; we also strip embedded double-quotes and
// backslashes so a value can't break out of its quotes.
export function buildCheckinOrFilter(query: string): string {
  const safe = query.trim().replace(/["\\]/g, "");
  return `lookup_code.eq."${safe.toUpperCase()}",team_name.ilike."%${safe}%"`;
}
