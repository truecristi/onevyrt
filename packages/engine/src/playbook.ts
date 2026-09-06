/**
 * Sales Playbook (Force 3 / Force 4): a swipe-file the team can reuse without
 * re-inventing it live on a call or in an ad — objections mapped to responses,
 * and hooks/headlines worth reusing. Deliberately dumb reference lists, no
 * scoring or engine logic; the value is having them in one place next to the
 * rest of the business definition.
 */
export interface ObjectionEntry {
  id: string;
  objection: string;
  response: string;
  createdAt: string;
}

export interface HookEntry {
  id: string;
  hook: string;
  angle?: string; // e.g. "fear", "curiosity", "proof" — free text, not a fixed taxonomy
  createdAt: string;
}
