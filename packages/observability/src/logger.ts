import { randomUUID } from "node:crypto";

/**
 * Minimal structured logger (§13: "structured logs include correlation,
 * user/workspace pseudonymous IDs, route, duration and result"). Not a
 * replacement for an OpenTelemetry-compatible pipeline (§3) - that's a
 * later ADR-0011-adjacent decision once there's traffic to observe. This
 * gives every request a correlation ID and consistent JSON output now.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  correlationId?: string;
  userId?: string;
  workspaceId?: string;
  route?: string;
  durationMs?: number;
  [key: string]: unknown;
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  const record = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...redact(fields),
  };
  const line = JSON.stringify(record);
  if (level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.log(line);
  }
}

// §38: redact tokens/passwords/financial detail/message bodies before they reach logs.
const REDACTED_KEYS = new Set([
  "password",
  "passwordHash",
  "sessionToken",
  "tokenHash",
  "authorization",
  "cookie",
]);

function redact(fields: LogFields): LogFields {
  const result: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = REDACTED_KEYS.has(key) ? "[redacted]" : value;
  }
  return result;
}

export function newCorrelationId(): string {
  return randomUUID();
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write("debug", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
  error: (message: string, fields?: LogFields) => write("error", message, fields),
};
