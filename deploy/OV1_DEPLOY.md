# ov1 deployment (ov1.masteryresearch.com)

This app runs as its **own** Docker container, fully separate from the legacy
`onevyrt-app` (port 8515) — leave that one untouched.

| | ov1 (this app) | legacy (do not touch) |
|---|---|---|
| container | `ov1-app` | `onevyrt-app` |
| image | `ov1:latest` | — |
| port | **8516** | 8515 |
| hostname | ov1.masteryresearch.com | onevyrt.masteryresearch.com |
| env file | `/etc/onevyrt/ov1.env` | — |
| database | Supabase (Postgres only) | — |

## 1. Environment file — `/etc/onevyrt/ov1.env` (on the server, never in git)

Set these **on the server** (do not paste secret values into chat). See
`apps/web/.env.example` for the full list and comments.

```
DATABASE_URL=postgresql://postgres.<projectref>:<url-encoded-password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
DATABASE_SSL_REJECT_UNAUTHORIZED=1
AUTH_SECRET=<32+ byte random secret>
```

- Use the **session pooler** host (`...pooler.supabase.com:5432`), username
  `postgres.<projectref>`, and **URL-encode** special characters in the
  password (`$`→`%24`, `!`→`%21`, `+`→`%2B`, etc.).
- `NODE_ENV=production`, `ONEVYRT_ROOT=/data`, and `PORT=8516` are baked into
  the image; you do not need to set them.

## 2. Build & run

```
docker build -t ov1:latest .
docker rm -f ov1-app 2>/dev/null || true
docker run -d --name ov1-app --restart unless-stopped \
  -p 8516:8516 \
  --env-file /etc/onevyrt/ov1.env \
  -v ov1-data:/data \
  ov1:latest
docker logs -f ov1-app
```

On start the container **runs database migrations** (`node-pg-migrate up`, via
`apps/web/scripts/migrate-deploy.mjs`, using the same TLS verification as the
app) and then serves Next.js on `0.0.0.0:8516`.

## 3. TLS troubleshooting

The app **requires** a verified DB TLS connection in production. If the logs
show a certificate error (`self-signed certificate in certificate chain` /
`unable to verify the first certificate`), the pooler cert isn't in Node's
trust store on this host — supply Supabase's CA explicitly:

1. Download the project's CA bundle from the Supabase dashboard
   (Project → Settings → Database → SSL configuration).
2. Put it on the host, e.g. `/etc/onevyrt/db-ca.crt`.
3. In `ov1.env`, replace `DATABASE_SSL_REJECT_UNAUTHORIZED=1` with
   `DATABASE_CA_CERT_PATH=/certs/db-ca.crt` and add `-v /etc/onevyrt/db-ca.crt:/certs/db-ca.crt:ro`
   to the `docker run`.

Never set `sslmode=no-verify` or disable verification in production — the app
will refuse to start rather than run an unauthenticated DB connection.

## 4. Cloudflare tunnel

The existing `onevyrt-cloudflared` tunnel already routes
`ov1.masteryresearch.com` → `http://localhost:8516`. No change needed unless
the route is missing.
