/**
 * A friendly first name for the Studio greeting. Accounts have no name field,
 * only an email, and the greeting used to show the whole local part verbatim —
 * so a machine-generated address rendered as "Good evening,
 * e2e-audit_1787431159920_53275ba0". This takes the first token of the local
 * part and uses it ONLY when it reads like an actual name (letters, sensible
 * length); otherwise it returns "" so the caller greets without a name
 * ("Good evening") instead of showing a hash.
 */
export function friendlyFirstName(email: string): string {
  const local = (email.split("@")[0] || "").trim();
  const first = local.split(/[._+\-\s]/)[0] || "";
  if (/^[a-zA-Z]{2,20}$/.test(first)) {
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  }
  return "";
}
