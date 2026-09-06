// Campaign Studio channels — the mediums a template step can run on, with
// display metadata (label, hue, icon) used across the campaign UI.

export type Channel =
  | "meta" | "google" | "tiktok" | "linkedin" | "email" | "sms" | "landing" | "organic" | "other";

export const CHANNELS: { id: Channel; label: string; hue: string; icon: string }[] = [
  { id: "meta", label: "Meta (FB/IG)", hue: "#1877f2", icon: "◆" },
  { id: "google", label: "Google", hue: "#ea4335", icon: "●" },
  { id: "tiktok", label: "TikTok", hue: "#111827", icon: "♪" },
  { id: "linkedin", label: "LinkedIn", hue: "#0a66c2", icon: "▮" },
  { id: "email", label: "Email", hue: "#7c3aed", icon: "✉" },
  { id: "sms", label: "SMS", hue: "#0891b2", icon: "▸" },
  { id: "landing", label: "Landing page", hue: "#0f766e", icon: "▤" },
  { id: "organic", label: "Organic / social", hue: "#65a30d", icon: "✿" },
  { id: "other", label: "Other", hue: "#6b7280", icon: "•" },
];

export function channelMeta(id: string): { id: Channel; label: string; hue: string; icon: string } {
  // Non-null: CHANNELS is a fixed non-empty literal declared above, so its
  // last element always exists — noUncheckedIndexedAccess just can't see that.
  return CHANNELS.find((c) => c.id === id) ?? CHANNELS[CHANNELS.length - 1]!;
}
