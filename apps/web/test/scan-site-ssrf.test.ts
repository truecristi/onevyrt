import test from "node:test";
import assert from "node:assert/strict";
import { fetchFollowingSafely, SsrfRedirectError } from "../lib/campaign-studio/scan-site-fetch";

/**
 * The scan-site scraper follows redirects manually and re-runs the SSRF guard
 * on every hop, so a public URL that 302-redirects to an internal address
 * (cloud metadata, loopback) is blocked on the SECOND hop — the gap that
 * redirect:"follow" left open.
 */
function resp(status: number, location?: string): Response {
  const headers = new Headers();
  if (location) headers.set("location", location);
  return new Response(null, { status, headers });
}

const signal = new AbortController().signal;
// A validator that mimics the real guard: rejects the metadata/loopback hosts.
const validate = async (url: string) => {
  const h = new URL(url).hostname;
  return h === "169.254.169.254" || h === "127.0.0.1" || h === "localhost"
    ? { safe: false, reason: `resolves to a private/internal address` }
    : { safe: true };
};

test("scan-site: a redirect to cloud metadata is blocked on the second hop", async () => {
  const fetchImpl = async (url: string) =>
    url === "https://evil.example/" ? resp(302, "http://169.254.169.254/latest/meta-data/") : resp(200);
  await assert.rejects(
    () => fetchFollowingSafely("https://evil.example/", signal, fetchImpl, validate),
    (e) => e instanceof SsrfRedirectError,
  );
});

test("scan-site: a redirect to loopback is blocked", async () => {
  const fetchImpl = async (url: string) =>
    url === "https://evil.example/" ? resp(301, "http://127.0.0.1:8080/admin") : resp(200);
  await assert.rejects(() => fetchFollowingSafely("https://evil.example/", signal, fetchImpl, validate), SsrfRedirectError);
});

test("scan-site: a redirect to another public URL is followed to the final response", async () => {
  const fetchImpl = async (url: string) => {
    if (url === "https://a.example/") return resp(302, "https://b.example/final");
    if (url === "https://b.example/final") return resp(200);
    throw new Error(`unexpected url ${url}`);
  };
  const res = await fetchFollowingSafely("https://a.example/", signal, fetchImpl, validate);
  assert.equal(res.status, 200);
});

test("scan-site: a redirect loop is capped, not followed forever", async () => {
  const fetchImpl = async (url: string) => resp(302, url === "https://a.example/" ? "https://b.example/" : "https://a.example/");
  await assert.rejects(() => fetchFollowingSafely("https://a.example/", signal, fetchImpl, validate),
    (e) => e instanceof SsrfRedirectError && /too many redirects/.test((e as Error).message));
});
