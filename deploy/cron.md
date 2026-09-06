# Scheduled work — the cron tick

OneVYRT runs as a single container with **no separate worker process**. Anything
time-based happens when an external cron calls one API route on a schedule:

```
POST https://<host>/api/cron/tick
     header:  x-cron-secret: <CRON_SECRET>
```

That one call runs every job whose interval has elapsed (see `apps/web/lib/jobs.ts`):

| Job | What it does | Cadence |
| --- | --- | --- |
| `scheduled_broadcasts` | Sends broadcasts whose scheduled time has passed | ~every minute |
| `cohort_session_reminders` | Emails members about upcoming cohort sessions | every 6h |
| `stale_programme_nudges` | Nudges owners who've gone quiet on the programme | daily |

The route is idempotent and self-gating: each job tracks its own last-run in the
`job_runs` table, so calling the tick more often than needed is harmless — it
just no-ops the jobs that aren't due yet. Scheduled broadcasts are claimed
atomically (`scheduled → sending` in one UPDATE), so two overlapping ticks can
never send the same broadcast twice.

## Set it up (host cron)

The tick is protected by a shared secret rather than a user session (there's no
user on the other end of a cron job). Set `CRON_SECRET` in the container's env
file (`/etc/onevyrt/web.env`, the same file the deploy uses) to any long random
string, then add a host crontab entry that calls the route with it.

`curl` is the simplest caller. Example — tick once a minute (so a scheduled
broadcast fires within ~a minute of its time):

```cron
# m h dom mon dow  command
* * * * * curl -fsS -m 30 -X POST http://127.0.0.1:8515/api/cron/tick \
  -H "x-cron-secret: REPLACE_WITH_CRON_SECRET" >/dev/null 2>&1
```

Notes:
- `127.0.0.1:8515` is the container's published port on the host (`PORT` in
  `deploy.sh`); hitting it directly avoids the public TLS hop.
- Keep the header value in sync with `CRON_SECRET` in `web.env`. If they differ
  the route returns `401`; if `CRON_SECRET` is unset it returns `503`.
- Every-minute is fine — the `job_runs` gating means only `scheduled_broadcasts`
  actually does work each minute; the heavier jobs still run on their own longer
  intervals.

## Verify it's working

```sh
# From the host — should return {"ok":true,"results":[...]} with one entry per job.
curl -sS -X POST http://127.0.0.1:8515/api/cron/tick -H "x-cron-secret: $CRON_SECRET"
```

Each result shows `ran: true/false`; `scheduled_broadcasts` reports `created` =
how many broadcasts it dispatched on that tick. If you schedule a broadcast in
the UI (Segments → compose → pick a time) and it never sends, the cron isn't
reaching this route — check the crontab and that the secret matches.
