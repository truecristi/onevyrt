import test from "node:test";
import assert from "node:assert/strict";
import { pinnedFetch, SsrfPinError } from "../lib/safe-fetch";
import { isPublicAddress } from "../lib/url-safety";

test("isPublicAddress: blocks loopback, private, link-local; allows public", () => {
  assert.equal(isPublicAddress("127.0.0.1", 4), false);
  assert.equal(isPublicAddress("10.0.0.5", 4), false);
  assert.equal(isPublicAddress("169.254.169.254", 4), false); // cloud metadata
  assert.equal(isPublicAddress("192.168.1.1", 4), false);
  assert.equal(isPublicAddress("::1", 6), false);
  assert.equal(isPublicAddress("fd00::1", 6), false);
  assert.equal(isPublicAddress("93.184.216.34", 4), true);   // example.com, public
  assert.equal(isPublicAddress("2606:2800:220:1::", 6), true);
});

test("pinnedFetch: a host that resolves to cloud metadata is refused at connect (rebinding blocked)", async () => {
  // The rebinding case: validation might have seen a public IP, but the address
  // actually resolved for the connection is internal — the pinning lookup must
  // refuse it before any socket is opened.
  const resolver = async () => [{ address: "169.254.169.254", family: 4 }];
  await assert.rejects(
    () => pinnedFetch("http://rebind.example/", { resolver }),
    (e: unknown) => e instanceof SsrfPinError,
  );
});

test("pinnedFetch: a host that resolves only to loopback is refused", async () => {
  const resolver = async () => [{ address: "127.0.0.1", family: 4 }, { address: "::1", family: 6 }];
  await assert.rejects(
    () => pinnedFetch("https://evil.example/", { resolver }),
    (e: unknown) => e instanceof SsrfPinError,
  );
});

test("pinnedFetch: rejects a non-http(s) URL", async () => {
  await assert.rejects(() => pinnedFetch("file:///etc/passwd"), (e: unknown) => e instanceof SsrfPinError);
});

test("pinnedFetch: POST — sends the method + body through the pinned socket (webhook delivery path)", async () => {
  const { createServer } = await import("node:http");
  let seen: { method?: string; body: string; ct?: string } | null = null;
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      seen = { method: req.method, body: Buffer.concat(chunks).toString("utf8"), ct: req.headers["content-type"] };
      res.writeHead(202).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  try {
    const payload = JSON.stringify({ hello: "world" });
    const res = await pinnedFetch(`http://localhost:${port}/hook`, {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(payload)) },
      body: payload,
      resolver: async () => [{ address: "127.0.0.1", family: 4 }],
      validateAddress: () => true,
    });
    assert.equal(res.status, 202);
    assert.ok(seen, "the receiver got the request");
    const got = seen as unknown as { method: string; body: string; ct: string };
    assert.equal(got.method, "POST");
    assert.equal(got.body, payload, "the body was written to the pinned socket");
    assert.match(got.ct, /application\/json/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test("pinnedFetch: POST to a rebinding host is refused before the body is sent", async () => {
  // A POST must get the same pin as a GET — a low-TTL name resolving internal
  // can't be reached even with a body in hand.
  const resolver = async () => [{ address: "10.0.0.1", family: 4 }];
  await assert.rejects(
    () => pinnedFetch("http://rebind.example/hook", { method: "POST", body: "{}", resolver }),
    (e: unknown) => e instanceof SsrfPinError,
  );
});

test("pinnedFetch: happy path — connects to the pinned address, reads status/headers/body", async () => {
  const { createServer } = await import("node:http");
  const server = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end("<title>Hi</title><p>hello world</p>");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  try {
    // Pin to loopback (allowed only because this test injects validateAddress);
    // resolver returns the loopback the server is on.
    const res = await pinnedFetch(`http://localhost:${port}/`, {
      resolver: async () => [{ address: "127.0.0.1", family: 4 }],
      validateAddress: () => true,
    });
    assert.equal(res.status, 200);
    assert.equal(res.ok, true);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    const body = Buffer.from(await res.arrayBuffer()).toString("utf8");
    assert.match(body, /hello world/);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
  }
});
