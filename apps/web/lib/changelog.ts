/**
 * The product changelog — the data behind an in-app "What's new". Plain data so
 * it's trivial to render (a panel, a page, or the /api/changelog route) and to
 * test. Newest entry first; write items from the user's side ("You can now…"),
 * not the system's.
 */
export type ChangeTag = "new" | "improved" | "fixed";

export interface ChangelogEntry {
  /** ISO date (YYYY-MM-DD) of the release. */
  date: string;
  title: string;
  tag: ChangeTag;
  items: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-08-16",
    title: "Faster, calmer AI",
    tag: "improved",
    items: [
      "The Copilot now streams its answer word-by-word instead of pausing on a blank screen — and you can Stop a reply mid-generation.",
      "“Draft with AI” fields fill in live as the model writes.",
      "A shaky provider (rate limit or a blip) is retried automatically, so a single hiccup no longer fails your request.",
      "Test your connection before you rely on it, and pick your AI provider (OpenAI, Claude, Grok, OpenRouter) on every screen, not just one.",
    ],
  },
  {
    date: "2026-08-16",
    title: "Your data, your integrations",
    tag: "new",
    items: [
      "Download everything tied to your account as one JSON file, from Settings → Security.",
      "Import tracking actuals from a CSV — the exact inverse of Export CSV.",
      "The public API is now documented (OpenAPI) and rate-limited, and every response tells you your remaining quota.",
    ],
  },
  {
    date: "2026-08-15",
    title: "Reliability & polish",
    tag: "fixed",
    items: [
      "Fixed a rare database contention issue that could stall saves under heavy concurrent editing.",
      "Sharpened light-mode green for readability (now meets WCAG AA contrast).",
      "Search engines can find your public pages while your workspace stays private.",
    ],
  },
];

/** The most recent release date — handy for a "new since you last looked" dot. */
export function latestChangeDate(): string {
  return CHANGELOG.reduce((max, e) => (e.date > max ? e.date : max), "");
}
