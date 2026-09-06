/**
 * Mindfulness (Module 5): blind spots and hidden opportunities the user
 * names for themselves — not measured, not scored, just written down so
 * they don't stay invisible. Pure data, no UI.
 */
export type MindfulnessKind = "assumption" | "opportunity";

export interface MindfulnessEntry {
  id: string;
  kind: MindfulnessKind;
  text: string;
  createdAt: string;
}
