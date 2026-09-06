# Free auto-deploy (no GitHub Actions, no billing)

GitHub Actions charges for runner minutes. You don't need it. Your server can
already deploy itself via `deploy/deploy.sh`; this adds a tiny poller so a
`git push` to `master` goes live automatically — on your own box, for free.

**How it works:** every few minutes the server fetches `origin/master`. If the
tip moved since the last successful deploy, it runs `deploy/deploy.sh` (migrate
→ build → swap container → health-check → auto-rollback). A marker file
(`.last-deployed-sha`) means unchanged ticks are no-ops and a failed deploy is
retried next tick.

## Fastest path — one command (run once, on the server)

Paste this into a shell on the box (a cPanel **Terminal** works — no SSH client
needed). It pulls the latest `master`, installs the poller (systemd, or cron if
there's no systemd), and deploys immediately:

```bash
cd /opt/onevyrt-src && git fetch origin && git checkout master && git pull && bash deploy/install-autodeploy.sh
```

After it finishes, `master` is live and every future merge deploys itself within
~3 minutes. The installer runs `deploy/healthcheck.sh` at the end to confirm it.

**Confirm any time** (safe to run whenever, exits non-zero if the app is down):

```bash
cd /opt/onevyrt-src && bash deploy/healthcheck.sh
```

It reports the deployed commit vs. `origin/master`, that the app answers
`/api/health?ready` with the DB up, and the process uptime (a small number means
it just deployed). That's the whole thing — the manual steps below are just what
the installer automates, kept for reference / customisation.

## One-time setup (run once, on the server)

```bash
# 1. Make the poller executable (it's committed in the repo checkout)
cd /opt/onevyrt-src
chmod +x deploy/auto-deploy.sh

# 2a. systemd (recommended) — installs a timer that fires every 3 min
sudo cp deploy/onevyrt-autodeploy.service deploy/onevyrt-autodeploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now onevyrt-autodeploy.timer

# check it
systemctl list-timers onevyrt-autodeploy.timer
journalctl -u onevyrt-autodeploy.service -n 50 --no-pager
```

If your checkout path, env-file path, or service user differ from the defaults
(`/opt/onevyrt-src`, `/etc/onevyrt/web.env`, `root`), edit those `Environment=`
/ `User=` lines in `onevyrt-autodeploy.service` before copying.

### Alternative: cron (if you'd rather not use systemd)

```bash
# every 3 minutes; logs to /var/log/onevyrt-autodeploy.log
( crontab -l 2>/dev/null; \
  echo "*/3 * * * * SRC_DIR=/opt/onevyrt-src ENV_FILE=/etc/onevyrt/web.env /usr/bin/env bash /opt/onevyrt-src/deploy/auto-deploy.sh >> /var/log/onevyrt-autodeploy.log 2>&1" \
) | crontab -
```

## Deploy right now (once, by hand)

```bash
cd /opt/onevyrt-src && ./deploy/auto-deploy.sh
# or force the underlying deploy regardless of the marker:
REF=origin/master bash deploy/deploy.sh
```

## Notes

- First run deploys the current `origin/master` (the marker starts empty).
- Nothing here talks to GitHub Actions, so it is unaffected by Actions billing.
- Roll back a bad deploy the usual way (`deploy/deploy.sh` already auto-rolls
  back on a failed health check); the marker only advances on success, so the
  next push re-attempts cleanly.
