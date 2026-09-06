/**
 * Minimal structured logging (Ch.090). journald already captures this service's
 * stdout with its own rotation/retention (`journalctl --user -u gearbox-web.service`),
 * so that's the primary, zero-effort sink — just write JSON lines to console.log.
 * A parallel line-delimited file under .gearbox/logs survives if journald's
 * retention window ever turns out shorter than needed, and is readable without
 * `journalctl` access. No framework, no shipping, no external log store — this
 * is a single systemd --user process, not a fleet.
 */
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { gearboxDir } from "./root";

const MAX_LOG_BYTES = 5 * 1024 * 1024;
// Redact any context value whose KEY looks like a credential. Two tiers so we
// catch camel/snake variants (apiKey, accessToken, clientSecret, webhookSecret,
// sessionToken) without over-matching innocent keys: a substring list for words
// that are safe to match anywhere in a key, and an exact list for short words
// ("auth", "pass") that WOULD over-match as substrings ("author", "passed",
// "compass"). Context objects here are small and shallow, so this is enough.
const SENSITIVE_SUBSTRINGS = ["password", "secret", "token", "apikey", "api_key", "cookie", "session", "authorization", "credential", "privatekey", "private_key"];
const SENSITIVE_EXACT = new Set(["auth", "pass"]);
function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_EXACT.has(k) || SENSITIVE_SUBSTRINGS.some((s) => k.includes(s));
}

function logsDir(): string {
  const dir = path.join(gearboxDir(), "logs");
  mkdirSync(dir, { recursive: true });
  return dir;
}
function logFile(): string {
  return path.join(logsDir(), "app.log");
}

/** Recursively redact credential-looking keys from a context object before it
 *  is written to a log. Exported for testing. */
export function scrub(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(scrub);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = isSensitiveKey(k) ? "[redacted]" : scrub(v);
  }
  return out;
}

// Single prior generation (app.log -> app.log.1) is enough headroom for this
// box's log volume; journald remains the real long-term record, so this file
// only needs to cover a short gap, not a full history.
function rotateIfNeeded(file: string): void {
  try {
    if (!existsSync(file)) return;
    if (statSync(file).size < MAX_LOG_BYTES) return;
    renameSync(file, `${file}.1`);
  } catch {
    // Rotation is best-effort; a failure here must never block logging itself.
  }
}

function write(line: Record<string, unknown>): void {
  const rendered = JSON.stringify(line);
  console.log(rendered);
  try {
    const file = logFile();
    rotateIfNeeded(file);
    appendFileSync(file, rendered + "\n", "utf8");
  } catch {
    // stdout (-> journald) already has it; the file is a bonus, not the source of truth.
  }
}

export function logError(scope: string, err: unknown, context?: Record<string, unknown>): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  write({
    level: "error",
    ts: new Date().toISOString(),
    scope,
    message,
    ...(stack ? { stack } : {}),
    ...(context ? { context: scrub(context) } : {}),
  });
}

export function logEvent(scope: string, context?: Record<string, unknown>): void {
  write({
    level: "info",
    ts: new Date().toISOString(),
    scope,
    ...(context ? { context: scrub(context) } : {}),
  });
}

/**
 * Wraps a route handler so an unexpected throw (a bug in a lib call, not one of
 * the routes' own validated error responses) is logged and turned into a plain
 * 500 instead of Next's default opaque failure, which in production mode leaves
 * no trace at all of what went wrong.
 */
export function withRouteLogging<A extends unknown[]>(
  scope: string,
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A): Promise<Response> => {
    // Correlate a request across the client's network log and the server logs:
    // reuse an id the proxy/client already set, else mint one. It's echoed on
    // every response as X-Request-Id and attached to any error we log.
    const req = args[0];
    const requestId = (req instanceof Request && req.headers.get("x-request-id")) || randomUUID();
    try {
      const res = await handler(...args);
      if (!res.headers.has("x-request-id")) {
        const headers = new Headers(res.headers);
        headers.set("x-request-id", requestId);
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
      }
      return res;
    } catch (err) {
      logError(scope, err, { requestId });
      return new Response(JSON.stringify({ error: "internal error" }), {
        status: 500,
        headers: { "content-type": "application/json", "x-request-id": requestId },
      });
    }
  };
}
