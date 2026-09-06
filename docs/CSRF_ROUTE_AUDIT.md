# CSRF route audit (2026-09-03)

Every state-changing (POST/PUT/PATCH/DELETE) API route handler in the app —
155 of them, across 204 `route.ts` files — read directly (not inferred from
the path) and classified by its actual authentication mechanism, ahead of
turning on central CSRF enforcement in `proxy.ts`. See CLAUDE.md's Phase 1 /
`docs/IMPLEMENTATION_ROADMAP.md`'s "Technical foundation" row for context:
`lib/middleware/csrf.ts`'s `validateCsrf()` had a critical cookie/header bug
(fixed the same day this audit was done) and was never called from any route.
This document is what makes turning it on safe.

**Method:** four parallel read-only agents each covered a slice of the route
tree, tracing every route's auth into `lib/auth.ts` (`currentUser`,
`resolveSession`), `lib/admin.ts` (`requireAdmin`), or a route's own
signature/secret verification, rather than guessing from directory names.

## Verdict categories

| Verdict | Meaning | proxy.ts treatment |
|---|---|---|
| `SESSION_CSRF_NEEDED` | Authenticates via the `gb_session` (or `gb_impersonator`) cookie | CSRF enforced |
| `EXEMPT_SIGNED_WEBHOOK` | Authenticates via an external cryptographic signature (Stripe, or this app's own HMAC scheme) | Exempt — no cookie ever involved |
| `EXEMPT_SHARED_SECRET` | Authenticates via a shared secret header (cron) | Exempt — no cookie ever involved |
| `EXEMPT_PRE_SESSION_AUTH` | Runs before any session cookie exists, or authenticates via a one-time/emailed token instead | Exempt |
| `EXEMPT_PUBLIC_NO_SESSION` | No authentication at all, intentionally public (funnel/lead-capture/telemetry) | Exempt |
| `UNCLEAR` / mixed | Branches between more than one of the above | Handled as its own case, not a blanket rule (see below) |

## Result: the exemption list actually wired into `proxy.ts`

134 of the 155 routes are `SESSION_CSRF_NEEDED` — the default. Everything
else falls into one of these rules:

- **Prefix `/api/webhooks/`** (4 routes) — `EXEMPT_SIGNED_WEBHOOK`. All four
  (`stripe`, `stripe-billing`, `stripe-oto`, `why-creed-events`) verify an
  HMAC signature from the sender; none reads our session cookie.
- **Prefix `/api/cron/`** (2 routes) — `tick` is `EXEMPT_SHARED_SECRET`
  (`x-cron-secret` only). `digest` is **mixed**: it tries the same shared
  secret first, but falls back to `requireAdmin()` (session cookie) if the
  secret is absent/wrong. A route-level prefix exemption can't see that
  internal branch, so `digest`'s route file got its own inline
  `validateCsrf()` call on specifically the session-fallback branch (fixed
  the same day as this audit — see the route file's comment).
- **Prefix `/api/q/`** (6 routes: `book`, `event`, `pay`, `verify/check`,
  `verify/start`, `qualified`) — `EXEMPT_PUBLIC_NO_SESSION`. This is the
  Acquisition OS's public-facing qualification funnel; an anonymous site
  visitor with no account hits these. Confirmed no `currentUser` call in any
  of the six.
- **Exact path `/api/client-error`** — `EXEMPT_PUBLIC_NO_SESSION`. Explicitly
  commented in the route as "unauthenticated and reachable from a broken
  page" — a page that's already broken can't be relied on to have a working
  CSRF token either.
- **Exact path `/api/track`** — `EXEMPT_PUBLIC_NO_SESSION`. Deliberately
  embeddable cross-origin (`access-control-allow-origin: "*"`) on third-party
  sites — enforcing CSRF here would break the feature outright, since a
  same-site cookie is never sent on a genuinely cross-origin embed anyway.
- **Exact path `/api/unsubscribe`** — `EXEMPT_PRE_SESSION_AUTH`. A CAN-SPAM/
  RFC 8058 one-click unsubscribe link: authenticates via an HMAC-signed
  token in the URL's query string, never a cookie.
- **Exact paths `/api/auth/login`, `/api/auth/register`,
  `/api/auth/forgot-password`, `/api/auth/reset-password`,
  `/api/auth/2fa/login-verify`** — `EXEMPT_PRE_SESSION_AUTH`. These either
  run before any session cookie is issued (login/register create it on
  success), or authenticate via a one-time emailed token instead of a
  session (forgot/reset-password), or via a short-lived pending-login token
  returned in the login response body rather than a cookie (2fa/login-verify,
  mid-login after the password check but before the real session exists).

Everything else that authenticates via `currentUser()`/`requireAdmin()` —
including `/api/auth/logout` and `/api/auth/stop-impersonating`, both of
which are session-cookie-driven even though one reads a differently-named
cookie (`gb_impersonator`) — gets CSRF enforced with no special-casing. A
forced-logout CSRF is low severity on its own, but there's no cost to
protecting it too, and a uniform rule is harder to accidentally get wrong
than a rule with per-route carve-outs.

## Flagged for the "central authz" follow-up (not a CSRF issue, noted here since it surfaced during this audit)

Two routes didn't use the same admin-check helper as the other ~30
`/api/admin/*` routes (all of which call `requireAdmin(cookie)` from
`lib/admin.ts` → `currentUser()` + `isAdminEmail()`) — **status as of
2026-09-03, later the same day:**

- ~~`app/api/admin/enable-free-access/route.ts` — inline
  `process.env.ADMIN_EMAILS.split(',').map(trim).includes(user.email)`~~
  **Fixed** — now calls the canonical `requireAdmin()`. The divergence was
  real (comma-only split, case-sensitive compare — could wrongly *deny* a
  legitimate admin whose email casing or an ADMIN_EMAILS whitespace format
  didn't match exactly) but always fail-closed, never a security hole.
- `app/api/admin/free-access/enable-improved/route.ts` — a differently-shaped
  `requireAdmin(request, validateUserCb)` from `lib/free-access-api.ts`
  (takes the raw `Request` + a callback), not `lib/admin.ts`'s
  `requireAdmin(cookie)`. Same eventual `isAdminEmail()` check under the
  hood, different wrapper — a naming/shape inconsistency, not a behavioral
  bug. Left as-is: it's the only caller of `lib/free-access-api.ts`'s
  `requireAdmin`, so there's no live divergence risk, and forcing it onto
  the other shape would be pure churn with no fix attached.
- `app/api/webhooks/why-creed-events/route.ts`'s signature check compares
  with plain `===` rather than `timingSafeEqual` — every other signature/
  secret check found in this audit (Stripe, cron) uses a timing-safe
  compare; this one doesn't. Worth a look, unrelated to CSRF.

## Full per-route table

### Admin, billing, webhooks, cron (39 routes)

| Path | Methods | Auth mechanism | Verdict |
|---|---|---|---|
| app/api/admin/bulk/email/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/bulk/export/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/bulk/invite/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/bulk/reset-progress/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/community/route.ts | DELETE | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/curriculum/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/enable-free-access/route.ts | POST | inline `ADMIN_EMAILS` check (bespoke) | SESSION_CSRF_NEEDED |
| app/api/admin/feature-flags/route.ts | DELETE,POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/free-access/disable/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/free-access/enable-improved/route.ts | POST | `requireAdmin(request, cb)` (bespoke, lib/free-access-api.ts) | SESSION_CSRF_NEEDED |
| app/api/admin/free-access/enable/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/impersonate/[id]/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/lockouts/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/programme-offers/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/settings/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/users/[id]/route.ts | DELETE | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/users/[id]/status/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/webhook-status/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/workspaces/[id]/entitlements/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/workspaces/[id]/free-access/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/workspaces/[id]/members/[userId]/route.ts | DELETE | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/workspaces/[id]/owner/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/workspaces/[id]/plan/route.ts | POST | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/admin/workspaces/[id]/route.ts | DELETE | `requireAdmin(cookie)` | SESSION_CSRF_NEEDED |
| app/api/billing/cancel/route.ts | POST | `currentUser` + owner role | SESSION_CSRF_NEEDED |
| app/api/billing/checkout/route.ts | POST | `currentUser` + owner role | SESSION_CSRF_NEEDED |
| app/api/billing/connect/start/route.ts | POST | `currentUser` + owner role | SESSION_CSRF_NEEDED |
| app/api/billing/oto/route.ts | POST | `currentUser` + owner role | SESSION_CSRF_NEEDED |
| app/api/billing/resume/route.ts | POST | `currentUser` + owner role | SESSION_CSRF_NEEDED |
| app/api/billing/set-default-payment-method/route.ts | POST | `currentUser` + owner role | SESSION_CSRF_NEEDED |
| app/api/billing/setup-intent/route.ts | POST | `currentUser` + owner role | SESSION_CSRF_NEEDED |
| app/api/billing/status/route.ts | POST | `currentUser` + owner role | SESSION_CSRF_NEEDED |
| app/api/billing/subscribe/route.ts | POST | `currentUser` + owner role | SESSION_CSRF_NEEDED |
| app/api/cron/digest/route.ts | POST | `x-cron-secret` OR `requireAdmin(cookie)` fallback | MIXED — exempt at proxy level; own inline `validateCsrf()` added on the session-fallback branch |
| app/api/cron/tick/route.ts | POST | `x-cron-secret` only | EXEMPT_SHARED_SECRET |
| app/api/webhooks/stripe-billing/route.ts | POST | Stripe signature | EXEMPT_SIGNED_WEBHOOK |
| app/api/webhooks/stripe-oto/route.ts | POST | Stripe signature | EXEMPT_SIGNED_WEBHOOK |
| app/api/webhooks/stripe/route.ts | POST | Stripe signature | EXEMPT_SIGNED_WEBHOOK |
| app/api/webhooks/why-creed-events/route.ts | POST | own HMAC signature (non-timing-safe compare — flagged above) | EXEMPT_SIGNED_WEBHOOK |

### Business, workspace, settings (36 routes)

All 36 authenticate exclusively via `currentUser(cookie)` (directly or
through `requireAdmin`), with no alternate signature/secret path — verified
by grepping every file in this group for `Authorization`/`Bearer`/
`api-key`/`signature`/`hmac`/`secret`. **All 36 are `SESSION_CSRF_NEEDED`**:
`business/{ai-connection,constraint,drivers,economics,execution,funnels,
funnels/analytics,golden-example,journey,launches,leads,leads/[id],message,
offer,presentation,reality,review,streak}`, `command-center/why-creed`,
`dashboard/trigger-decision-moment`, `segments/{,[id],[id]/restore,contacts,
preview}`, `settings/{,api-keys,api-keys/[id],webhooks,webhooks/[id]}`,
`workspace/[id]/{email-preferences,reflection-checkpoint,why-creed}`,
`workspaces/{,[id],[id]/members}`.

One worth calling out explicitly: `business/leads/route.ts` POST is the
**authenticated** "claim an unowned demo funnel into my workspace" action
(`currentUser` + owner/manager role) — it is *not* the public lead-capture
endpoint. That's the separate, unauthenticated `app/api/q/qualified/route.ts`
(`recordLead()`, IP-rate-limited, no session at all), covered below.

### Auth, account, coach/coaching, q/* (34 routes)

| Path | Methods | Auth mechanism | Verdict |
|---|---|---|---|
| app/api/account/data-management/backups/route.ts | POST | `currentUser` + owner | SESSION_CSRF_NEEDED |
| app/api/account/data-management/exports/route.ts | POST | `currentUser` + membership | SESSION_CSRF_NEEDED |
| app/api/account/data-management/imports/route.ts | POST | `currentUser` + owner/manager | SESSION_CSRF_NEEDED |
| app/api/account/data-management/retention-policies/route.ts | POST | `currentUser` + owner | SESSION_CSRF_NEEDED |
| app/api/account/data-management/scheduled-exports/route.ts | POST | `currentUser` + owner/manager | SESSION_CSRF_NEEDED |
| app/api/account/transformation-report/email/route.ts | POST | `currentUser` + membership | SESSION_CSRF_NEEDED |
| app/api/account/transformation-report/share/route.ts | DELETE,POST | `requireOwner()` → `currentUser` + owner | SESSION_CSRF_NEEDED |
| app/api/auth/2fa/confirm/route.ts | POST | `currentUser` | SESSION_CSRF_NEEDED |
| app/api/auth/2fa/disable/route.ts | POST | `currentUser` + password re-check | SESSION_CSRF_NEEDED |
| app/api/auth/2fa/login-verify/route.ts | POST | pending-login token (body), no cookie | EXEMPT_PRE_SESSION_AUTH |
| app/api/auth/2fa/setup/route.ts | POST | `currentUser` + password re-check | SESSION_CSRF_NEEDED |
| app/api/auth/avatar/route.ts | DELETE,POST | `currentUser` | SESSION_CSRF_NEEDED |
| app/api/auth/change-email/route.ts | POST | `currentUser` + password re-check | SESSION_CSRF_NEEDED |
| app/api/auth/change-password/route.ts | POST | `currentUser` + password re-check | SESSION_CSRF_NEEDED |
| app/api/auth/delete-account/route.ts | POST | `currentUser` + password re-verify | SESSION_CSRF_NEEDED |
| app/api/auth/forgot-password/route.ts | POST | none — always `{ok:true}`, no cookie | EXEMPT_PRE_SESSION_AUTH |
| app/api/auth/login/route.ts | POST | none — issues the session on success | EXEMPT_PRE_SESSION_AUTH |
| app/api/auth/logout/route.ts | POST | `currentUser` + `currentSessionId` | SESSION_CSRF_NEEDED |
| app/api/auth/register/route.ts | POST | none — issues the session on success | EXEMPT_PRE_SESSION_AUTH |
| app/api/auth/reset-password/route.ts | POST | one-time emailed token, no cookie | EXEMPT_PRE_SESSION_AUTH |
| app/api/auth/sessions/[id]/route.ts | DELETE | `currentUser` | SESSION_CSRF_NEEDED |
| app/api/auth/sessions/route.ts | DELETE | `currentUser` | SESSION_CSRF_NEEDED |
| app/api/auth/stop-impersonating/route.ts | POST | `currentImpersonator` (`gb_impersonator` cookie) | SESSION_CSRF_NEEDED |
| app/api/client-error/route.ts | POST | none — explicitly unauthenticated | EXEMPT_PUBLIC_NO_SESSION |
| app/api/coach/reach-out/route.ts | POST | `currentUser` + owner/manager/admin | SESSION_CSRF_NEEDED |
| app/api/coaching/chapter/4/review/route.ts | POST | `currentUser` + owner/manager | SESSION_CSRF_NEEDED |
| app/api/notifications/route.ts | PATCH | `currentUser` | SESSION_CSRF_NEEDED |
| app/api/q/[slug]/book/route.ts | POST | none — OTP-verified, not identity-verified | EXEMPT_PUBLIC_NO_SESSION |
| app/api/q/[slug]/event/route.ts | POST | none | EXEMPT_PUBLIC_NO_SESSION |
| app/api/q/[slug]/pay/route.ts | POST | none | EXEMPT_PUBLIC_NO_SESSION |
| app/api/q/[slug]/verify/check/route.ts | POST | none | EXEMPT_PUBLIC_NO_SESSION |
| app/api/q/[slug]/verify/start/route.ts | POST | none | EXEMPT_PUBLIC_NO_SESSION |
| app/api/q/qualified/route.ts | POST | none | EXEMPT_PUBLIC_NO_SESSION |
| app/api/track/route.ts | POST | none — deliberately cross-origin embeddable | EXEMPT_PUBLIC_NO_SESSION |

### Programme, projects, campaign-studio, cohorts, community, misc (46 routes)

All 46 authenticate via `currentUser(cookie)` except one. **45 are
`SESSION_CSRF_NEEDED`**: `ai/generate`, `analytics/{feature-attempt,
feature-attempts-batch,privacy}` (telemetry beacons that still hard-require
a session — 401 without one), `batch-operations/{,[id]}`,
`broadcasts/{,[id]}`, `campaign-studio/{brand,campaigns,campaigns/deleted,
connections,scan-site}`, `campaign/creatives`, `cohorts/{,[cohortId]/
access-limit,[cohortId]/announcements,[cohortId]/members,[cohortId]/
sessions}`, `community/{comments,creatives,profile,reactions}`,
`growth-plan/share`, `programme/{access,chapter/4/submit,chapters/[stageId]/
review,chapters/[stageId]/submit,coach-notes,lessons/[lessonId]/review,
lessons/[lessonId]/start,lessons/[lessonId]/submit,messages}`,
`projects/{,[id],[id]/comments,[id]/restore,[id]/revisions,[id]/share,
[id]/tracking}`, `reports/email`, `templates`, `workflows/{,[id],
[id]/execute}`.

The one exception: `app/api/unsubscribe/route.ts` (POST) — `verifyUnsubscribeToken()`,
an HMAC-signed token in the `?token=` query string, never reads a cookie.
`EXEMPT_PRE_SESSION_AUTH`.

Two rows confirmed NOT to be what their name might suggest: `projects/[id]/share`
and `growth-plan/share` both create/revoke a separately-tokened *public* link
— but the create/revoke action itself is a normal session-authenticated
mutation (owner-gated), so both are `SESSION_CSRF_NEEDED` like everything
else in this group.
