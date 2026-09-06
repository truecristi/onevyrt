# Rollback runbook

## If a deploy breaks production

1. SSH in: `ssh -i ~/.ssh/id_ed25519_bluehost root@100.98.30.40`
2. Find the last known-good commit: `cd /opt/onevyrt-src && git log --oneline -10`
3. Roll the checkout back: `git checkout <good-sha>`
4. Rebuild and redeploy:
   ```
   docker build -t onevyrt:latest .
   docker rm -f onevyrt-app
   docker run -d --name onevyrt-app --restart unless-stopped -p 127.0.0.1:8515:3000 -v onevyrt-data:/data --env-file /etc/onevyrt/web.env onevyrt:latest
   ```
5. Confirm: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8515/` should print `200`.
6. Once stable, move the repo back onto `master`'s tip locally, fix the actual bug, and redeploy forward rather than leaving the server pinned to an old commit.

## Deploying (the happy path)

`deploy/deploy.sh`, run on the server from the source checkout, does the whole
sequence atomically: check out the target ref, run migrations, build the image,
swap the container, health-check, and **roll back automatically** if the new
container doesn't come up healthy. So the normal deploy is:

```
cd /opt/onevyrt-src && REF=origin/master bash deploy/deploy.sh
```

Or trigger it from GitHub: the **Deploy** workflow (`.github/workflows/deploy.yml`)
runs on manual `workflow_dispatch` **and** automatically after CI goes green on
`master` (a merged PR). It joins Tailscale and runs the same script over SSH.

> **⚠️ Auto-deploy needs its secrets set.** The workflow requires
> `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST` and
> `DEPLOY_USER` (Settings → Secrets and variables → Actions). If any are
> missing, the run now **fails immediately with a clear "missing secret(s)"
> message** (it used to die deep inside the Tailscale step, so a broken
> auto-deploy looked like nothing happened — a merge was *not* shipping).
> Until the secrets are set, deploy with the manual one-liner above.

The manual rollback steps below are the fallback for when the automated rollback
itself can't recover.

> **⚠️ Env-file format (`/etc/onevyrt/web.env`).** The container runs with
> `docker run --env-file`, so the file MUST be in that format: `KEY=value`, one
> per line, and **do NOT quote values** — `--env-file` keeps quotes literally
> and would corrupt e.g. `DATABASE_URL`. Values with spaces are fine *unquoted*
> (`ADMIN_EMAILS=a@b.com c@d.com`). `deploy.sh` reads `DATABASE_URL` for
> migrations the same raw way (it no longer `source`s the whole file), so there
> is one format and no shell-vs-Docker mismatch. If you ever "fix" a line by
> quoting it, the app will fail to reach the database.

## If the DATA itself is corrupted (not just bad code)

Nightly backups live in `/opt/onevyrt-backups/` on the server (rotated, 14-day retention, created by the `onevyrt-backup.timer` systemd timer). To restore:

1. Stop the app: `docker rm -f onevyrt-app`
2. Pick a backup: `ls -la /opt/onevyrt-backups/`
3. Wipe and restore the volume:
   ```
   docker run --rm -v onevyrt-data:/data alpine sh -c "rm -rf /data/*"
   docker run --rm -v onevyrt-data:/data -v /opt/onevyrt-backups:/backup alpine \
     tar xzf /backup/onevyrt-data-<TIMESTAMP>.tar.gz -C /data
   ```
4. Restart the app (same `docker run` command as above).

### Postgres database (the primary datastore)

Most data now lives in Postgres (Supabase), which the volume tarballs above do **not** cover — back it up separately with `deploy/backup.sh`:

```
# manual
ENV_FILE=/etc/onevyrt/web.env ./deploy/backup.sh
# cron (daily 03:15 UTC), writes to /var/backups/onevyrt, keeps 14
15 3 * * * /opt/onevyrt-src/deploy/backup.sh >> /var/log/onevyrt-backup.log 2>&1
```

It writes a verified, gzipped `pg_dump` and prunes to the newest `KEEP` (default 14). To restore (DESTRUCTIVE — overwrites the target DB, so it demands `CONFIRM=yes`):

```
CONFIRM=yes ./deploy/restore.sh /var/backups/onevyrt/onevyrt-<TIMESTAMP>.sql.gz
```

**Restore drill (an untested backup is not a backup):** `deploy/verify-backup.sh` does this automatically — it restores a dump into a throwaway scratch database, checks the schema actually came back (table count + required tables), then drops the scratch DB. It exits non-zero on any problem, so run it from cron right after the backup and you'll be alerted to a bad backup instead of discovering it during a real recovery.

```
# verify the newest backup (or pass a specific file)
ENV_FILE=/etc/onevyrt/web.env ./deploy/verify-backup.sh
# cron (daily 04:00 UTC, after the 03:15 backup)
0 4 * * * /opt/onevyrt-src/deploy/verify-backup.sh >> /var/log/onevyrt-backup.log 2>&1
```

The scratch DB is created on the same server, so the DB role needs `CREATEDB` (or run the script as the postgres superuser).

**Freshness alarm (catch a silently-stopped backup cron):** `deploy/backup-freshness.sh` exits non-zero when the newest backup is older than `MAX_AGE_HOURS` (default 26) or missing/empty — so a backup job that quietly dies (full disk, bad env, removed crontab line) gets noticed instead of discovered during recovery. Run it hourly under a `MAILTO` crontab and it only mails you when something's wrong:

```
17 * * * * /opt/onevyrt-src/deploy/backup-freshness.sh   # BACKUP_DIR/MAX_AGE_HOURS overridable
```

For a manual drill you can still restore into a named throwaway DB by hand:

```
CONFIRM=yes DATABASE_URL="postgres://.../onevyrt_restore_test" \
  ./deploy/restore.sh /var/backups/onevyrt/onevyrt-<TIMESTAMP>.sql.gz
```

## How you'll find out something's wrong before a user tells you

`onevyrt-health.timer` checks `http://127.0.0.1:8515/` every 5 minutes and emails the addresses in `ADMIN_EMAILS` (in `/etc/onevyrt/web.env`) if it fails twice in a row, then again once it recovers. Check timer status: `systemctl status onevyrt-health.timer onevyrt-backup.timer`.

## Before you deploy at all

CI (`.github/workflows/ci.yml`) runs typecheck + the full test suite on every push to `master`. A red run on GitHub doesn't block a manual deploy by itself (there's no branch protection configured), so treat a failing run as "don't deploy this" even though nothing will stop you if you do.

## Scaling to thousands of concurrent users

The app is stateless in the request path: all data lives in Postgres, and every read-modify-write critical section (including the low-frequency ones — visitor-journey tracking, enrollments, curriculum edits) is serialized with **Postgres transaction-scoped advisory locks** (`db.ts` `withAdvisoryLock`), which coordinate across *every* container, not a per-process file lock. That means the two real limits at scale are the **database** and the **single Node process**:

1. **Database connections.** The pool size is `DATABASE_POOL_MAX` (default 10). Supabase's *session* pooler caps this project's tier at ~15 concurrent clients — fine for hundreds of users, not thousands. For thousands:
   - Point `DATABASE_URL` at Supabase's **transaction pooler** (pgBouncer, port 6543) so a small server-side pool multiplexes many app clients, then you can raise `DATABASE_POOL_MAX` without exhausting the tier.
   - Raise the database tier (more RAM/connections) as load grows.
   - Watch for `connection timeout` errors in the logs — that's the pool saturating; it now fails fast (10s) rather than hanging.
   - **Invariant: one connection per locked operation.** A critical section must never hold a checked-out connection (a lock/transaction client) *and* check out a second connection from the same pool for its inner work — under a burst that deadlocks the pool, since every lock holder waits on a connection that can't free up until it finishes. Enforce it two ways: (a) `withAdvisoryLock`/`withWorkspaceRowLock`/`withOwnedCohort`/`withUserRowLock` pass their client into the callback, and the callback's reads/writes must use *that* client (see the `Queryable` param on `enrollments.ts`/`curriculum-store.ts` helpers), not a fresh `pgPool()`; (b) fire best-effort side-effects that open their own connection (e.g. `dispatchEvent` webhooks) *after* the lock releases, not inside it. This was the root cause of a `timeout exceeded when trying to connect` CI failure; the whole `lib/` was audited afterward and no other instances remain.
2. **One Node process per container.** `docker run` starts a single process, which uses one CPU core. To use a multi-core box, run **N containers** (e.g. one per core) behind a reverse proxy / load balancer, each on its own `127.0.0.1:85xx` port. Because all state — including rate limiting (`lib/rate-limit.ts`, a shared Postgres counter when `DATABASE_URL` is set) and the AI connection (now stored encrypted per workspace, see the AI env vars below) — lives in Postgres, limits and everything else hold correctly across every container. (Without a database the limiter falls back to a per-process in-memory counter, fine for a single container.)
3. **Indexes.** Hot lookups are indexed, including GIN indexes on workspace/cohort membership (migration `1786630900000`). Run `pnpm --filter web migrate:up` on deploy so new indexes are applied before traffic hits them.

A single well-connected container against the transaction pooler comfortably handles the hundreds-of-concurrent range; go multi-container + bigger DB tier before a sustained few-thousand concurrent.

## Acquisition OS integrations (optional env vars)

The acquisition funnel (`/q/[slug]` → qualify → verify → book → Meta) works end to end with **no** external credentials — every integration below degrades gracefully to a safe no-op (and, for OTP in non-production, surfaces a dev code so the flow still completes). Set these in `apps/web/.env.local` (untracked) to make each piece live. All are read at request time; none are required for CI or a basic deploy.

- **Email (OTP codes, transactional):** `MAIL_ENABLED=true` + `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_SECURE` (`ssl`/`true` for implicit TLS on 465, else STARTTLS), `SMTP_USERNAME`, `SMTP_PASSWORD`. Without these, mail is logged (not sent) and an email-channel OTP funnel shows the dev code in non-production only. (See `lib/mailer.ts`.)
- **SMS OTP (Twilio):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. Without all three, SMS sends are skipped (`smsConfigured()` is false) and an SMS-channel funnel falls back to the dev code in non-production. (See `lib/acquisition/otp.ts`.)
- **Meta Conversions API (server-side pixel):** `META_PIXEL_ID`, `META_CAPI_TOKEN`; optional `META_API_VERSION` (default `v19.0`) and `META_TEST_EVENT_CODE` (Events Manager test tab). Without the pixel id + token, `QualifiedLead` / `Schedule` events are built but not sent (`metaCapiConfigured()` is false). PII is SHA-256 hashed before it leaves the server; the browser pixel and this server event share an `event_id` for dedupe. (See `lib/acquisition/meta-capi.ts`.)

### AI (optional env vars)

Both features degrade gracefully: unset, the app behaves as before (BYO key, browser-only), so they're safe to deploy before you set anything.

- **Durable BYO-AI key storage:** `AI_ENCRYPTION_KEY` — a stable secret used to encrypt each workspace's own AI key at rest (AES-256-GCM, `lib/crypto-box`) so it survives a browser clear, restart, container move and backup restore, and syncs across the user's devices. Generate once and **keep it in the env backup** — rotate it and previously-stored keys can't be decrypted (users just re-enter them, no crash). Generate with `openssl rand -hex 32`. Unset → the AI key stays browser-only as before. (See `lib/ai-connection-store.ts`.)
- **Managed AI ("you provide the AI"):** `MANAGED_AI_KEY` — the owner's own provider key (server-side only, never sent to the browser). When set, users who haven't added their own key generate through `POST /api/ai/generate` using this key, metered by a per-workspace monthly quota. Optional: `MANAGED_AI_MODEL` (default `openai/gpt-4o-mini`), `MANAGED_AI_MONTHLY_QUOTA` (default `50` generations/workspace/month), `MANAGED_AI_ENDPOINT` (default OpenRouter). Unset → managed AI is off and the app is BYO-only (`/api/ai/generate` returns 501). Use a cheap model and a sane quota — you pay per generation. (See `lib/managed-ai.ts`, `lib/ai-usage-store.ts`.)

**Verification never trusts the client.** A booking on a verification-enabled funnel requires a verification id that the server confirms is verified *for the exact contact given* (`lib/acquisition/otp.ts` `isVerified`), and the calendar is always gated behind a server-side re-score of the answers — a client "qualified"/"verified" flag is never sufficient.

New tables ship as migrations (`bookings`, `leads`, `qual_funnel_owners`, `qual_funnels`, `otp_verifications`, `funnel_events`, `funnel_spend`); run `pnpm --filter web migrate:up` on deploy, as always.
