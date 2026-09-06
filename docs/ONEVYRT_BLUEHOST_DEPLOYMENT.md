# ONEVYRT — Bluehost Deployment (architecture, deploy script, rollback, smoke tests)

> **Purpose.** A single, safe reference for shipping ONEVYRT to the production
> server. It documents the *existing* deployment architecture (nothing here is
> new infrastructure — it is written from `deploy/`, `deploy.sh`, and
> `RUNBOOK.md`), the exact deploy sequence, the one command you run from your
> own PC, how to roll back, and the post-deploy smoke tests.
>
> The deep operational detail (scaling, backup drills, env-file format traps)
> lives in [`RUNBOOK.md`](../RUNBOOK.md). This doc is the deploy playbook that
> sits on top of it. **No secrets are stored here — only variable *names*.**

---

## 1. How the production app is actually served

| Piece | Value | Notes |
|---|---|---|
| Host | `root@100.98.30.40` (Tailscale IP) | Reached over SSH with key `id_ed25519_bluehost` |
| Source checkout | `/opt/onevyrt-src` | A normal git clone of this repo; deploys run from here |
| Runtime | Docker | Image `onevyrt:latest`, container `onevyrt-app` |
| Port | `127.0.0.1:8515` → container `:3000` | Bound to loopback only |
| Public URL | `https://onevyrt.masteryresearch.com` | Cloudflare Tunnel dials `http://localhost:8515` |
| Data volume | `onevyrt-data` (`/data` in container) | Survives container swaps |
| Primary datastore | **Postgres (Supabase)** | Most data lives here, *not* in the volume |
| Secrets | `/etc/onevyrt/web.env` | `KEY=value`, **unquoted**, one per line — never baked into the image |
| Health monitor | `onevyrt-health.timer` (every 5 min) | Emails `ADMIN_EMAILS` on two failures in a row |

> ⚠️ **Env-file format.** `docker run --env-file` keeps quotes literally.
> Values must be **unquoted** (`DATABASE_URL=postgres://…`, not
> `DATABASE_URL="postgres://…"`). Quoting `DATABASE_URL` will break the app's DB
> connection. See RUNBOOK.md §"Env-file format".

---

## 2. The golden rule: GitHub is the deploy trigger

**You do not hand-edit code on the server.** The pipeline is:

```
write code  →  push to GitHub  →  merge to master  →  server deploys itself
```

The server turns `origin/master` into a running container via `deploy/deploy.sh`,
which is **atomic**: it records the current commit, runs DB migrations, builds
the image, swaps the container, health-checks, and **auto-rolls-back** if the new
container is unhealthy. A bad build can never leave production down.

There are **three** ways that script gets run — pick one:

### Option A — Free server-side auto-deploy (recommended; no GitHub Actions minutes)
A poller on the server checks `origin/master` every ~3 min and deploys when the
tip moves. One-time install, run **once on the server**:

```bash
cd /opt/onevyrt-src && git fetch origin && git checkout master && git pull && bash deploy/install-autodeploy.sh
```

After this, **every merge to `master` goes live within ~3 minutes** with no
further action. (Details: `deploy/AUTODEPLOY.md`.)

### Option B — GitHub Actions auto-deploy
`.github/workflows/deploy.yml` runs after CI goes green on `master` (or on manual
`workflow_dispatch`). It joins Tailscale and runs `deploy/deploy.sh` over SSH.
**Requires these repo secrets** (Settings → Secrets and variables → Actions),
or the run fails fast with a "missing secret(s)" message:
`TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`.

### Option C — Manual, one command (from your own PC)
This is the **"deploy script"** — it SSHes into the server and runs the same
atomic deploy. Run it from **PowerShell on your Windows machine**:

```powershell
# Deploy whatever is currently on origin/master to production
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_bluehost" root@100.98.30.40 `
  "cd /opt/onevyrt-src && REF=origin/master bash deploy/deploy.sh"
```

To deploy a **specific branch** (e.g. to preview this work before it's merged),
change the ref — but note the server's auto-deploy (Option A) will pull it back
to `master` on its next tick, so only do this for a quick look:

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_bluehost" root@100.98.30.40 `
  "cd /opt/onevyrt-src && REF=origin/claude/works-f7cor7 bash deploy/deploy.sh"
```

A copy of this command lives in [`deploy-from-pc.ps1`](../deploy-from-pc.ps1) at
the repo root so you can just run `.\deploy-from-pc.ps1`.

---

## 3. Do NOT deploy until all of these are true

This gate exists because production auto-deploys from `master`. Before code
reaches `master`:

- [ ] Implementation is **pushed to GitHub** and reviewed.
- [ ] **CI is green** on the PR (`.github/workflows/ci.yml`: engine build+test,
      web typecheck, lint, migrations, web tests, production build, Playwright +
      a11y). A red CI run means "don't deploy," even though nothing technically
      blocks a manual deploy.
- [ ] The **production build** passes (CI runs `pnpm --filter web build`).
- [ ] Any **new migration** has been reviewed (migrations run automatically on
      deploy — a bad one hits the live DB).
- [ ] A **fresh DB backup** exists (`deploy/backup.sh`) and a **rollback**
      path is confirmed (§5).

---

## 4. The exact deploy sequence (what `deploy/deploy.sh` does)

1. `git fetch` + check out the target `REF` (records the current commit as the
   rollback target).
2. Run DB migrations: `pnpm --filter web migrate:deploy` (reads `DATABASE_URL`
   from `/etc/onevyrt/web.env`).
3. `docker build -t onevyrt:latest .`
4. Swap the container (`docker rm -f` + `docker run` on port 8515).
5. Health-check `http://127.0.0.1:8515/` (expects HTTP 200).
6. **On failure:** check out the previous commit, rebuild, restart — automatic
   rollback. If rollback is also unhealthy, it exits non-zero for manual help.

---

## 5. Rollback (if a deploy breaks production)

`deploy/deploy.sh` already auto-rolls-back on a failed health check. If you need
to roll back manually (from your PC, via SSH):

```powershell
ssh -i "$env:USERPROFILE\.ssh\id_ed25519_bluehost" root@100.98.30.40
```
then on the server:
```bash
cd /opt/onevyrt-src
git log --oneline -10                 # find the last good commit
REF=<good-sha> bash deploy/deploy.sh  # redeploy that commit (migrations + build + swap + health)
```

**If the DATA is corrupted (not just bad code):** restore Postgres from the
nightly `pg_dump` — `deploy/restore.sh` (destructive, demands `CONFIRM=yes`).
Volume data restores from `/opt/onevyrt-backups/`. Full steps: RUNBOOK.md
§"If the DATA itself is corrupted".

> ⚠️ **A curriculum/chapter migration (Phase 1) is special.** It rewrites the
> stored `curriculum` blob and remaps cohort pacing. It is designed to be
> idempotent and reversible, **but** take a fresh `deploy/backup.sh` immediately
> before the first deploy that includes it, and verify with the Phase 1 smoke
> tests (§6) before considering it shipped. See
> `ONEVYRT_IMPLEMENTATION_STATUS.md` for its exact state.

---

## 6. Post-deploy smoke tests

After any deploy, confirm from the server:

```bash
cd /opt/onevyrt-src && bash deploy/healthcheck.sh   # deployed SHA vs origin/master, DB up, uptime
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8515/   # expect 200
```

Then click through `https://onevyrt.masteryresearch.com`:

- [ ] Home / sign-in loads, no server error.
- [ ] Log in; permissions correct (learner vs coach vs admin).
- [ ] Main menu renders (desktop **and** mobile).
- [ ] Programme opens; "Continue" goes to the correct next lesson.
- [ ] Lesson navigation works; opening a lesson does **not** mark it complete.
- [ ] Progress shows consistently on Home and Programme.
- [ ] Coaching / review queue loads for a coach account.
- [ ] Old routes still resolve (no dead bookmarks) — see the redirect map in
      `ONEVYRT_NAVIGATION_AND_USER_FLOW.md`.
- [ ] No errors in `docker logs onevyrt-app` or the browser console.

**Phase 1 (curriculum) specific:** an existing enrolled user still sees their
completed lessons as completed, their current lesson unchanged, and their cohort
pacing intact. (These are asserted by the migration tests in CI; this is the
human confirmation on real data.)

---

## 7. Quick reference

| I want to… | Command |
|---|---|
| Deploy master now (from PC) | `.\deploy-from-pc.ps1` |
| Check prod health | `ssh … root@100.98.30.40 "cd /opt/onevyrt-src && bash deploy/healthcheck.sh"` |
| Tail app logs | `ssh … root@100.98.30.40 "docker logs --tail 80 onevyrt-app"` |
| Back up the DB | `ssh … root@100.98.30.40 "cd /opt/onevyrt-src && ENV_FILE=/etc/onevyrt/web.env ./deploy/backup.sh"` |
| Roll back | `ssh … root@100.98.30.40`, then `REF=<good-sha> bash deploy/deploy.sh` |

(Replace `…` with `-i "$env:USERPROFILE\.ssh\id_ed25519_bluehost"`.)
