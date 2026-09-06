/**
 * Merge-field rendering for broadcasts. Substitutes {{name}}, {{firstName}},
 * {{email}}, {{phone}} in a subject/body with a contact's values. Pure and
 * side-effect free. Unknown fields are left blank rather than echoed, so a
 * typo'd token never leaks "{{whatever}}" into a real message. A friendly
 * fallback is used for an empty name so "Hi {{firstName}}," never reads "Hi ,".
 */
export interface MergeContact {
  name: string | null;
  email: string | null;
  phone: string | null;
}

const FIELD = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;

export function renderTemplate(template: string, c: MergeContact, opts: { nameFallback?: string } = {}): string {
  const fallback = opts.nameFallback ?? "there";
  const first = (c.name || "").trim().split(/\s+/)[0] || "";
  const values: Record<string, string> = {
    name: (c.name || "").trim() || fallback,
    firstname: first || fallback,
    email: c.email || "",
    phone: c.phone || "",
  };
  return (template || "").replace(FIELD, (_m, key: string) => {
    const v = values[key.toLowerCase()];
    return v !== undefined ? v : "";
  });
}

/** The merge tokens offered in the composer UI. */
export const MERGE_TOKENS = [
  { token: "{{firstName}}", label: "First name" },
  { token: "{{name}}", label: "Full name" },
  { token: "{{email}}", label: "Email" },
  { token: "{{phone}}", label: "Phone" },
];
