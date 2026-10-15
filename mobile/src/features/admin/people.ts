/** Name as the web shows it: first, father, grandfather, last (the parts that are set). */
export function fullName(p?: { first_name?: string | null; father_name?: string | null; grandfather_name?: string | null; last_name?: string | null } | null) {
  if (!p) return '';
  return [p.first_name, p.father_name, p.grandfather_name, p.last_name].filter((x) => x && x.trim()).join(' ');
}

/** Short name for lists: first + last. */
export function shortName(p?: { first_name?: string | null; last_name?: string | null } | null) {
  if (!p) return '';
  return [p.first_name, p.last_name].filter((x) => x && x.trim()).join(' ');
}
