/**
 * Attribution capture (Acquisition OS, brick 3). Turns the URL params + cookies
 * a visitor lands with into a structured Attribution record that travels with
 * the lead all the way to the qualified event — so Meta can attribute a
 * *qualified* conversion back to the exact campaign / ad / creative, not just
 * "a lead happened." Pure and deterministic (a `now` can be injected) so it's
 * unit-testable and reusable on both client and server.
 */
export interface Attribution {
  fbclid?: string;
  fbp?: string;
  fbc?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  creativeId?: string;
  landingUrl?: string;
  referrer?: string;
}

type Params = URLSearchParams | Record<string, string | undefined>;

function get(params: Params, key: string): string | undefined {
  const v = params instanceof URLSearchParams ? params.get(key) : params[key];
  const s = v == null ? "" : String(v).trim();
  return s === "" ? undefined : s;
}

/** Read a cookie value out of a `document.cookie` / Cookie-header string. */
export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) { const v = rest.join("=").trim(); return v || undefined; }
  }
  return undefined;
}

/** Build Meta's fbc value from an fbclid when the _fbc cookie is absent, using
 *  the documented `fb.1.<ms>.<fbclid>` shape. */
export function fbcFromFbclid(fbclid: string, nowMs: number): string {
  return `fb.1.${nowMs}.${fbclid}`;
}

export function parseAttribution(params: Params, opts: { cookies?: string; referrer?: string; url?: string; now?: number } = {}): Attribution {
  const now = opts.now ?? Date.now();
  const fbclid = get(params, "fbclid");
  const fbc = readCookie(opts.cookies, "_fbc") ?? (fbclid ? fbcFromFbclid(fbclid, now) : undefined);
  const fbp = readCookie(opts.cookies, "_fbp");
  const att: Attribution = {
    fbclid, fbc, fbp,
    utmSource: get(params, "utm_source"),
    utmMedium: get(params, "utm_medium"),
    utmCampaign: get(params, "utm_campaign"),
    utmContent: get(params, "utm_content"),
    utmTerm: get(params, "utm_term"),
    // ONEVYRT ad-URL macros carry the platform ids so a lead ties to the exact
    // creative; accept a couple of common spellings.
    campaignId: get(params, "gb_campaign") ?? get(params, "campaign_id"),
    adsetId: get(params, "gb_adset") ?? get(params, "adset_id"),
    adId: get(params, "gb_ad") ?? get(params, "ad_id"),
    creativeId: get(params, "gb_creative") ?? get(params, "creative_id"),
    landingUrl: opts.url,
    referrer: opts.referrer,
  };
  // Drop undefined keys so the stored/serialized record stays tight.
  for (const k of Object.keys(att) as (keyof Attribution)[]) if (att[k] === undefined) delete att[k];
  return att;
}

/** Whether we captured anything that can attribute a conversion to an ad. */
export function hasAdAttribution(a: Attribution): boolean {
  return Boolean(a.fbclid || a.fbc || a.creativeId || a.adId || a.utmCampaign);
}
