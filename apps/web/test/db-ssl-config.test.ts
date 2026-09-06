import test from "node:test";
import assert from "node:assert/strict";
import { buildSslConfig } from "../lib/db";

function withEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; if (vars[k] === undefined) delete process.env[k]; else process.env[k] = vars[k]; }
  try { return fn(); }
  finally { for (const k of Object.keys(prev)) { if (prev[k] === undefined) delete process.env[k]; else process.env[k] = prev[k]; } }
}

const CA_KEYS = { DATABASE_CA_CERT: undefined, DATABASE_CA_CERT_PATH: undefined, DATABASE_SSL_REJECT_UNAUTHORIZED: undefined };

test("buildSslConfig: local (no TLS) returns undefined", () => {
  withEnv(CA_KEYS, () => assert.equal(buildSslConfig(false), undefined));
});

test("buildSslConfig: default is permissive (unchanged behaviour) when no CA/flag set", () => {
  withEnv(CA_KEYS, () => assert.deepEqual(buildSslConfig(true), { rejectUnauthorized: false }));
});

test("buildSslConfig: an inline CA cert enables strict verification with that CA", () => {
  withEnv({ ...CA_KEYS, DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----" }, () => {
    const cfg = buildSslConfig(true);
    assert.equal(cfg?.rejectUnauthorized, true);
    assert.match(cfg?.ca ?? "", /BEGIN CERTIFICATE/);
  });
});

test("buildSslConfig: the reject-unauthorized flag enables strict against the default trust store", () => {
  withEnv({ ...CA_KEYS, DATABASE_SSL_REJECT_UNAUTHORIZED: "1" }, () => {
    assert.deepEqual(buildSslConfig(true), { rejectUnauthorized: true });
  });
});

test("buildSslConfig: an unreadable CA path falls back rather than crashing the pool", () => {
  withEnv({ ...CA_KEYS, DATABASE_CA_CERT_PATH: "/nonexistent/ca-does-not-exist.pem" }, () => {
    assert.deepEqual(buildSslConfig(true), { rejectUnauthorized: false });
  });
});
