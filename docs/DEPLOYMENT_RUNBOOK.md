# Deployment Runbook

This is the CI/CD-pipeline view of shipping ONEVYRT: what triggers a deploy,
where it goes, how to tell it worked, and how to undo it. It complements two
existing, more detailed docs rather than replacing them — this is the layer
that explains how the pieces fit together and, in particular, a gap between
them worth knowing about before you rely on either:

- **`RUNBOOK.md`** (repo root) — the deep operational reference: manual
  rollback commands, database backup/restore/verify drills, scaling notes,
  optional-integration env vars.
- **`docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md`** — the hands-on deploy playbook:
  exact server paths, the three ways to trigger a deploy, the pre-deploy
  checklist, post-deploy smoke tests.

Where this doc gives a command, it matches those two exactly; where it
diverges even slightly, treat those two as authoritative and this one as
stale.

## What triggers a deploy

There are genuinely **two independent auto-deploy mechanisms** live for this
app, and they behave very differently with respect to test results. Knowing
which one(s) are active on the production host matters more than anything
else in this document.

**1. GitHub Actions (`.github/workflows/deploy.yml`)** — fires via
`workflow_run` after the `CI` workflow completes a run against `master`, and
only proceeds if that run's overall conclusion was `success`
(`github.event.workflow_run.conclusion == 'success'`). It also accepts manual
`workflow_dispatch` (any ref, any time, no gate). Requires five repository
secrets (`TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY`,
`DEPLOY_HOST`, `DEPLOY_USER`); missing any of them fails the run immediately
with an explicit `::error`, rather than the old silent-death-inside-Tailscale
failure mode. **This path is CI-aware and safe by construction** — if `CI` is
red, it will not fire automatically.

**2. The server-side poller (`deploy/auto-deploy.sh`)** — installed via
`deploy/install-autodeploy.sh`, described in `deploy/AUTODEPLOY.md` as
"Option A — recommended; no GitHub Actions minutes." A systemd timer (or
cron, if systemd isn't available) ticks every ~3 minutes, checks whether
`origin/master`'s tip has moved since the last successful deploy, and if so
runs `deploy/deploy.sh` directly. **It has no concept of GitHub Actions or CI
status at all.** It deploys whatever is on `master`, full stop. Its only
safety net is `deploy/deploy.sh`'s own post-deploy health check — which
verifies the app *starts and answers HTTP 200*, not that the specific things
your test suite covers are actually correct.

**Find out which one is actually running** before you assume either
behavior: SSH to the box and check `systemctl status onevyrt-autodeploy.timer`
(or `crontab -l` for the cron variant). If that timer is active, treat
`master` as auto-shipping on every push regardless of whether `CI` is green —
**a red `CI` run does not stop it.** As of this writing, `CI` has been red on
`master` for about two weeks straight (a reproducible `bookings_slot_unique`
failure — see `docs/CI_CD_OPTIMIZATION.md`), which means: if the poller is
installed, everything pushed to `master` in that window went to production
regardless; if it isn't, production has been frozen on whatever was last
deployed and is now two weeks stale. Either way, run
`bash deploy/healthcheck.sh` on the box — it diffs the deployed commit
against `origin/master`'s tip and tells you directly which situation you're
in, instead of guessing.

**Recommendation:** until the poller is made CI-aware (e.g., by checking the
commit's combined status via the GitHub API before deploying — not
implemented anywhere today), treat a red `CI` as a hard "do not push to
`master`" signal regardless of which auto-deploy path is active, the same way
`docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md`'s pre-deploy checklist already frames
it. There is no branch protection configured, so nothing technically stops a
push — this is a process discipline, not a system guarantee.

## Configuration and concurrency

The GitHub Actions path needs five **repository secrets** — `TS_OAUTH_CLIENT_ID`,
`TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER` — set under
Settings → Secrets and variables → Actions. Two optional **repository
variables** override defaults if the server's layout ever changes:
`DEPLOY_SRC_DIR` (default `/opt/onevyrt-src`) and `DEPLOY_ENV_FILE` (default
`/etc/onevyrt/web.env`). None of this is needed for the server-side poller,
which reads its own defaults directly from `deploy/auto-deploy.sh`.

`deploy.yml` sets `concurrency: { group: production-deploy,
cancel-in-progress: false }` — deliberately different from `ci.yml`'s
cancel-on-new-push behavior. Two deploys triggered close together (a manual
dispatch landing while an auto-deploy from a just-merged PR is mid-flight,
say) **queue and run one after another**, never in parallel and never
cancelling each other. That's the right default for something that mutates a
shared container and runs database migrations — but it does mean a burst of
merges produces a burst of queued deploys, each re-running the full
migrate/build/swap/health-check sequence for whatever `master` looked like
at *its* trigger time, not just the last one. Harmless (the script is
idempotent) but worth knowing if a deploy run looks like it's "taking a
while" — check whether it's actually queued behind another one.

## Where it deploys

Production is a single Docker container (`onevyrt-app`, image
`onevyrt:latest`) on a Bluehost VPS, reached over Tailscale for
administration and exposed to the internet via a Cloudflare Tunnel:

```
Internet → https://onevyrt.masteryresearch.com → Cloudflare Tunnel
         → 127.0.0.1:8515 (loopback only) → onevyrt-app container → :3000
```

The primary datastore is Postgres (Supabase), not the container — the
container itself is stateless in the request path (see `RUNBOOK.md`'s
scaling section). A Docker volume (`onevyrt-data`) persists whatever the app
writes to `/data`, separate from the database.

## The deploy sequence

Both trigger paths above end up running the same script,
`deploy/deploy.sh`, on the server, from the source checkout at
`/opt/onevyrt-src`. It is atomic and self-verifying:

1. Record the current commit (the rollback target).
2. `git fetch` + check out the target ref.
3. Run DB migrations (`pnpm --filter web migrate:deploy`) against the
   database named in `/etc/onevyrt/web.env`.
4. `docker build -t onevyrt:latest .`
5. Swap the running container (`docker rm -f` then `docker run`).
6. Health-check `http://127.0.0.1:8515/` — up to 20 retries, 2s apart.
7. **On failure:** check out the *previous* commit, rebuild, restart, and
   health-check again. A bad build or a failing container can never leave
   production down on the new, broken version — worst case it's back on the
   last-known-good one.

The GitHub Actions path additionally now verifies the deploy from *outside*
the server: after the SSH step reports the script succeeded, the workflow
curls the public URL (`https://onevyrt.masteryresearch.com/api/health?ready`)
directly, with retries. This catches a failure mode the on-box check
structurally cannot: the container is healthy on `127.0.0.1`, but DNS or the
Cloudflare Tunnel between the internet and the box is broken. If that step
fails, the workflow run fails loudly even though the SSH deploy itself
"succeeded" — check `docker logs onevyrt-app` on the box and the Cloudflare
Tunnel status, in that order.

## Rollback procedure

**Automatic (the normal case):** already covered above — a failed health
check during `deploy/deploy.sh` rolls back and re-verifies before the script
exits, with no action needed from you.

**Manual (when the automatic rollback itself doesn't recover, or a deploy
went out that passed its health check but is behaviorally wrong):**

```bash
ssh -i ~/.ssh/id_ed25519_bluehost root@100.98.30.40
cd /opt/onevyrt-src && git log --oneline -10   # find the last known-good commit
git checkout <good-sha>
docker build -t onevyrt:latest .
docker rm -f onevyrt-app
docker run -d --name onevyrt-app --restart unless-stopped \
  -p 127.0.0.1:8515:3000 -v onevyrt-data:/data \
  --env-file /etc/onevyrt/web.env onevyrt:latest
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8515/   # expect 200
```

Full detail, including the database-corruption case (nightly `pg_dump`
backups + restore drill) and the env-file quoting trap that has bitten this
setup before, lives in `RUNBOOK.md` — read it before a real incident, not
during one.

## Health checks

Three layers, each catching something the others can't:

1. **In-script, during deploy** — `deploy/deploy.sh`'s own retry loop against
   `127.0.0.1:8515/`. Gates whether the deploy is considered successful at
   all.
2. **On demand, from the box** — `bash deploy/healthcheck.sh`. Reports three
   things in one shot: whether the deployed commit matches `origin/master`'s
   tip (so you can tell a pending-but-not-yet-deployed push apart from an
   actually-deployed one), whether `/api/health?ready` returns `ok:true`
   (app up *and* DB reachable), and process uptime (a small number right
   after a deploy is expected; a small number at a random moment is not).
3. **From the internet, after a GitHub Actions deploy** — the new "Verify
   public endpoint" step described above. Only runs on the Actions-triggered
   path; a poller-triggered or fully manual deploy doesn't get this
   independent check for free, so run `deploy/healthcheck.sh` yourself
   afterward if you deployed that way.

## Monitoring

- **`onevyrt-health.timer`** polls `http://127.0.0.1:8515/` every 5 minutes
  and emails the addresses in `ADMIN_EMAILS` after two consecutive failures,
  then again on recovery. Check it with
  `systemctl status onevyrt-health.timer`.
- **`deploy/backup-freshness.sh`**, run hourly, alerts if the newest database
  backup is missing or older than `MAX_AGE_HOURS` (default 26) — catches a
  silently-dead backup cron before it matters.
- **Watching a live deploy:** `docker logs -f onevyrt-app` on the box during
  or right after a deploy; the GitHub Actions run's own log (or, now, its
  step summary) for the Actions-triggered path.
- **CI status itself is a monitoring signal for deploys**, not just for
  code review — per the finding above, a sustained red `CI` on `master`
  should be treated as an active incident for whichever deploy path is live,
  not background noise to fix "eventually."

## Quick reference

| Question | Answer |
|---|---|
| What actually deployed last, and is it current? | `bash deploy/healthcheck.sh` on the box |
| Is the app up right now? | `curl -s -o /dev/null -w '%{http_code}\n' https://onevyrt.masteryresearch.com/` → expect `200` |
| Something's badly wrong, roll back now | See "Rollback procedure" above, or the fuller version in `RUNBOOK.md` |
| Is auto-deploy CI-gated on this server? | `systemctl status onevyrt-autodeploy.timer` — if active, no, it isn't (see "What triggers a deploy") |
| Deploy via GitHub Actions manually | Actions tab → `Deploy` → `Run workflow`, choose a ref |
| Deploy manually from your own machine | See `docs/ONEVYRT_BLUEHOST_DEPLOYMENT.md` §2, Option C, or `deploy-from-pc.ps1` |
