/**
 * DNS-pinned, SSRF-safe fetch for server-side requests to user-supplied URLs.
 *
 * The problem it closes: validating a hostname with checkPublicHttpUrl resolves
 * DNS once, but a normal fetch() then resolves AGAIN when it connects. An
 * attacker-controlled name with a low TTL can answer "public" on the validation
 * lookup and "127.0.0.1 / 169.254.169.254" on the connect lookup (DNS
 * rebinding). Since the site scanner returns the fetched body, that's a read
 * SSRF against cloud metadata / internal services.
 *
 * The fix: connect through node:http(s) with a custom `lookup` that validates
 * the resolved address and hands the socket exactly that IP — so the address we
 * checked IS the address we connect to (no second, unchecked resolution). The
 * Host/SNI stays the original hostname, so TLS cert validation is unaffected.
 * Redirects are NOT followed here (the caller follows them manually, revalidating
 * each hop); we return the 3xx as-is.
 *
 * GET is the default, but a method + body may be passed so outbound-webhook
 * POST delivery gets the same rebind-safe pinning (see lib/webhooks.ts) — the
 * body is written after headers and the 3xx is still returned unfollowed.
 */
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { lookup as dnsLookupCb } from "node:dns";
import { isIP } from "node:net";
import { isPublicAddress } from "./url-safety";

export class SsrfPinError extends Error {}

/** A minimal fetch-Response-like surface — exactly what fetchFollowingSafely and
 *  the scan-site route read. */
export interface PinnedResponse {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface PinnedFetchInit {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  maxBytes?: number;
  // Defaults to GET. When a body is given (e.g. webhook POST delivery) it is
  // written after the headers; redirects are still never followed.
  method?: string;
  body?: string | Buffer;
  // Injectable for tests: a dns.lookup-shaped resolver (all:true).
  resolver?: (hostname: string) => Promise<{ address: string; family: number }[]>;
  // Injectable for tests only: which resolved addresses are allowed. Defaults to
  // isPublicAddress (production always blocks private/loopback/link-local).
  validateAddress?: (address: string, family: number) => boolean;
}

const DEFAULT_MAX_BYTES = 2_000_000;

function defaultResolver(hostname: string): Promise<{ address: string; family: number }[]> {
  return new Promise((resolve, reject) => {
    dnsLookupCb(hostname, { all: true }, (err, addresses) => {
      if (err) reject(err);
      else resolve(addresses as { address: string; family: number }[]);
    });
  });
}

/**
 * GET a URL with the resolved IP validated and pinned. Rejects with
 * SsrfPinError if the host resolves only to non-public addresses. Never follows
 * redirects (returns the 3xx).
 */
export function pinnedFetch(rawUrl: string, init: PinnedFetchInit = {}): Promise<PinnedResponse> {
  const url = new URL(rawUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return Promise.reject(new SsrfPinError("must be an http(s) URL"));
  }
  const resolver = init.resolver ?? defaultResolver;
  const isAllowed = init.validateAddress ?? isPublicAddress;
  const maxBytes = init.maxBytes ?? DEFAULT_MAX_BYTES;

  // If the URL's host is already a literal IP address (e.g. "127.0.0.1" or
  // "[::1]"), Node's http/https client never needs to resolve it, so it never
  // invokes a custom `lookup` — it connects straight to that address. That
  // means the pinningLookup guard below would silently never run for a
  // literal-IP target, defeating the whole SSRF check for exactly the
  // destinations most worth blocking (loopback, link-local, RFC1918). Check
  // this case explicitly, up front, before ever opening a socket.
  const literalFamily = isIP(url.hostname); // 0 = not a literal IP; 4 or 6 = is one
  if (literalFamily !== 0 && !isAllowed(url.hostname, literalFamily)) {
    return Promise.reject(Object.assign(new SsrfPinError("resolves to a private/internal address"), { code: "ESSRFBLOCKED" }));
  }

  // A dns.lookup-shaped function that resolves, validates every candidate, and
  // hands the socket the first PUBLIC address — so the connection can't be
  // rebinding-swapped to an internal IP behind our back.
  const pinningLookup = (
    hostname: string,
    options: { all?: boolean; family?: number } | ((...a: unknown[]) => void),
    callback?: (err: NodeJS.ErrnoException | null, address?: string | { address: string; family: number }[], family?: number) => void,
  ): void => {
    // node calls lookup(hostname, options, cb) — but options can be omitted.
    const opts = typeof options === "function" ? {} : (options ?? {});
    const cb = (typeof options === "function" ? options : callback) as (err: NodeJS.ErrnoException | null, address?: string | { address: string; family: number }[], family?: number) => void;
    resolver(hostname).then((addresses) => {
      const wanted = opts.family ? addresses.filter((a) => a.family === opts.family) : addresses;
      const safe = wanted.find((a) => isAllowed(a.address, a.family)) ?? addresses.find((a) => isAllowed(a.address, a.family));
      if (!safe) {
        cb(Object.assign(new SsrfPinError("resolves to a private/internal address"), { code: "ESSRFBLOCKED" }));
        return;
      }
      // Honor the `all` shape the caller asked for.
      if (opts.all) cb(null, [{ address: safe.address, family: safe.family }]);
      else cb(null, safe.address, safe.family);
    }).catch((e) => cb(e instanceof Error ? e : new Error("lookup failed")));
  };

  const requestFn = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<PinnedResponse>((resolve, reject) => {
    const req = requestFn(
      url,
      {
        method: init.method ?? "GET",
        headers: init.headers,
        signal: init.signal,
        // @ts-expect-error node's types allow lookup on request options at runtime
        lookup: pinningLookup,
      },
      (res: IncomingMessage) => {
        const status = res.statusCode ?? 0;
        const chunks: Buffer[] = [];
        let total = 0;
        res.on("data", (c: Buffer) => {
          total += c.length;
          if (total <= maxBytes) chunks.push(c); // cap accumulation; keep draining to "end"
        });
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({
            status,
            ok: status >= 200 && status < 300,
            headers: { get: (name: string) => (res.headers[name.toLowerCase()] as string | undefined) ?? null },
            arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
          });
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    if (init.body != null) req.write(init.body);
    req.end();
  });
}
