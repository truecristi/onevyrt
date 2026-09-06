import test from "node:test";
import assert from "node:assert/strict";
import { checkPublicHttpUrl } from "../lib/url-safety";

// All cases use literal IPs (or unresolvable/invalid inputs), so the tests are
// deterministic and network-free: node's lookup() handles numeric hosts locally.

test("rejects non-URLs and non-http(s) protocols", async () => {
  assert.equal((await checkPublicHttpUrl("not a url")).safe, false);
  assert.equal((await checkPublicHttpUrl("ftp://example.com/x")).safe, false);
  assert.equal((await checkPublicHttpUrl("file:///etc/passwd")).safe, false);
  assert.equal((await checkPublicHttpUrl("javascript:alert(1)")).safe, false);
});

test("rejects local hostnames outright", async () => {
  assert.equal((await checkPublicHttpUrl("http://localhost/hook")).safe, false);
  assert.equal((await checkPublicHttpUrl("http://api.localhost/hook")).safe, false);
  assert.equal((await checkPublicHttpUrl("http://printer.local/hook")).safe, false);
});

test("rejects loopback, private, link-local and metadata IPv4 space", async () => {
  for (const ip of [
    "127.0.0.1", "127.1.2.3",          // loopback /8
    "10.0.0.1", "10.255.255.255",      // RFC1918
    "172.16.0.1", "172.31.255.254",    // RFC1918 (172.16/12)
    "192.168.1.1",                     // RFC1918
    "169.254.169.254",                 // cloud metadata (link-local)
    "100.64.0.1",                      // CGNAT
    "0.0.0.0",                         // this-network
    "198.51.100.7", "203.0.113.9",     // documentation
    "224.0.0.1", "240.0.0.1",          // multicast / reserved
  ]) {
    const r = await checkPublicHttpUrl(`http://${ip}/hook`);
    assert.equal(r.safe, false, `${ip} should be blocked (got safe)`);
  }
});

test("boundary addresses just OUTSIDE blocked ranges are allowed", async () => {
  for (const ip of [
    "172.32.0.1",   // one past 172.16/12
    "11.0.0.1",     // one past 10/8
    "128.0.0.1",    // one past 127/8
    "8.8.8.8", "1.1.1.1",
  ]) {
    const r = await checkPublicHttpUrl(`http://${ip}/hook`);
    assert.equal(r.safe, true, `${ip} should be allowed (got ${r.reason})`);
  }
});

test("rejects IPv6 loopback, link-local, unique-local and IPv4-mapped internals", async () => {
  for (const host of [
    "[::1]",
    "[fe80::1]",
    "[fd12:3456::1]",
    "[fc00::1]",
    "[::ffff:127.0.0.1]",   // IPv4-mapped loopback
    "[::ffff:169.254.169.254]", // IPv4-mapped metadata
  ]) {
    const r = await checkPublicHttpUrl(`http://${host}/hook`);
    assert.equal(r.safe, false, `${host} should be blocked (got safe)`);
  }
});

test("fails closed on hostnames that do not resolve", async () => {
  const r = await checkPublicHttpUrl("https://definitely-not-a-real-host.invalid/hook");
  assert.equal(r.safe, false);
});
