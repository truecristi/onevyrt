"use client";

/**
 * Phase 9 first UI slice: the client-side half of §11's CSRF protocol
 * (server half is apps/web/lib/csrf.ts). Every mutating request from the
 * browser goes through here rather than a bare `fetch`, so no page
 * component has to remember the CSRF handshake itself: fetch a token from
 * /api/auth/csrf, then send it back as the x-csrf-token header the server
 * checks against the same-named cookie it just set.
 */

const CSRF_HEADER = "x-csrf-token";

async function getCsrfToken(): Promise<string> {
  const response = await fetch("/api/auth/csrf");
  if (!response.ok) {
    throw new Error("Could not obtain a CSRF token");
  }
  const data = (await response.json()) as { csrfToken: string };
  return data.csrfToken;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

/** POSTs a CSRF-protected JSON body. `T` should match the route's actual response shape (success or error) - callers narrow on `ok`/`status`. */
export async function postJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  const csrfToken = await getCsrfToken();
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", [CSRF_HEADER]: csrfToken },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T;
  return { ok: response.ok, status: response.status, data };
}

/** PATCHes a CSRF-protected JSON body - same handshake as postJson, e.g. lesson progress updates. */
export async function patchJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  const csrfToken = await getCsrfToken();
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "content-type": "application/json", [CSRF_HEADER]: csrfToken },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T;
  return { ok: response.ok, status: response.status, data };
}

/** PUTs a CSRF-protected JSON body - same handshake as postJson, e.g. a task's project/priority/blocker fields. */
export async function putJson<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  const csrfToken = await getCsrfToken();
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json", [CSRF_HEADER]: csrfToken },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T;
  return { ok: response.ok, status: response.status, data };
}

/** DELETEs a CSRF-protected endpoint (currently just logout) - same handshake as postJson, no body. */
export async function deleteWithCsrf<T>(url: string): Promise<ApiResult<T>> {
  const csrfToken = await getCsrfToken();
  const response = await fetch(url, {
    method: "DELETE",
    headers: { [CSRF_HEADER]: csrfToken },
  });
  const data = (await response.json()) as T;
  return { ok: response.ok, status: response.status, data };
}
