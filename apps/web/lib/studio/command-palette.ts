/**
 * The ranking engine behind a ⌘K command palette — pure and testable, so the
 * overlay UI stays a thin shell. A command is anything the palette can run
 * (switch mode, add a block, open a panel); `filterCommands` fuzzy-matches a
 * query against each command's title and keywords and returns them best-first.
 */
export interface Command {
  id: string;
  title: string;
  /** Grouping label, e.g. "Navigate", "Insert", "AI". */
  section?: string;
  /** Extra terms that should also match (synonyms, abbreviations). */
  keywords?: string[];
  /** Display-only shortcut hint, e.g. "⌘Z". */
  shortcut?: string;
}

/**
 * Score `text` against `query`, case-insensitive. Higher is better; -1 means no
 * match. Prefers, in order: a prefix match, a word-boundary substring, any
 * substring, then a scattered subsequence (with bonuses for consecutive and
 * word-start characters). An empty query matches everything.
 */
export function fuzzyScore(text: string, query: string): number {
  if (!query) return 1;
  const t = text.toLowerCase();
  const q = query.toLowerCase();

  const idx = t.indexOf(q);
  if (idx === 0) return 1000 - t.length; // prefix — strongest, shorter title wins ties
  if (idx > 0) {
    const boundary = /\W/.test(t[idx - 1] ?? "");
    return (boundary ? 700 : 500) - idx - t.length * 0.1;
  }

  // Subsequence: every query char appears in order.
  let ti = 0;
  let score = 0;
  let matched = 0;
  let lastMatch = -2;
  let consec = 0;
  for (let qi = 0; qi < q.length; qi++) {
    let found = -1;
    for (; ti < t.length; ti++) {
      if (t[ti] === q[qi]) { found = ti; ti++; break; }
    }
    if (found === -1) return -1;
    matched++;
    if (found === lastMatch + 1) { consec++; score += 5 + consec; } else { consec = 0; score += 1; }
    if (found === 0 || /\W/.test(t[found - 1] ?? "")) score += 3; // word-start bonus
    lastMatch = found;
  }
  return matched === q.length ? score : -1;
}

/** Best score of the query against a command's title or any keyword (keyword
 *  hits are weighted slightly below a title hit so the title stays primary). */
export function scoreCommand(cmd: Command, query: string): number {
  let best = fuzzyScore(cmd.title, query);
  for (const kw of cmd.keywords ?? []) {
    const s = fuzzyScore(kw, query);
    if (s > -1) best = Math.max(best, s - 50);
  }
  return best;
}

/** Matching commands, best-first. An empty query returns all (original order),
 *  capped at `limit`. */
export function filterCommands(commands: Command[], query: string, limit = 20): Command[] {
  const q = query.trim();
  if (!q) return commands.slice(0, limit);
  const ranked: { cmd: Command; score: number; i: number }[] = [];
  commands.forEach((cmd, i) => {
    const score = scoreCommand(cmd, q);
    if (score > -1) ranked.push({ cmd, score, i });
  });
  // Sort by score desc, stable on original index for equal scores.
  ranked.sort((a, b) => (b.score - a.score) || (a.i - b.i));
  return ranked.slice(0, limit).map((r) => r.cmd);
}
