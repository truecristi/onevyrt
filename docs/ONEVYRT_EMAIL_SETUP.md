# ONEVYRT Email Setup

How to turn on real transactional email for the ONEVYRT app.

## 1. Overview

Email sending is **already built** — see `apps/web/lib/mailer.ts`, which uses
[nodemailer](https://nodemailer.com/) for the SMTP path. Nothing else needs to
be written to start sending.

The mailer is pluggable and fails loud, never silent:

- **No provider configured** → it does **not** send. It logs the message to the
  server console (`[mailer] No provider configured — would send email: …`) and
  returns `{ sent: false }`. Mail is never faked as delivered.
- **SMTP configured** (`MAIL_ENABLED=true` **and** `SMTP_HOST` set) → it sends
  for real via nodemailer.
- A Resend fallback (`RESEND_API_KEY`) also exists, but SMTP wins when both are
  set. This doc covers the SMTP path.

`sendMail()` is already wired into the app's transactional flows:

- OTP login
- Password reset
- Change-email confirmation
- Broadcasts

So the moment the SMTP env vars are present in the running container, all of
those start delivering real mail. No code change required.

## 2. SMTP / IMAP settings (from cPanel)

Mailbox: **onevyrt@masteryresearch.com**

**Outgoing (SMTP) — this is what the app uses:**

| Setting  | Value                       |
| -------- | --------------------------- |
| Host     | `mail.masteryresearch.com`  |
| Port     | `465`                       |
| Security | SSL/TLS (implicit)          |
| Username | `onevyrt@masteryresearch.com` |

**Incoming (IMAP) — not used by the app yet:**

| Setting  | Value                       |
| -------- | --------------------------- |
| Host     | `mail.masteryresearch.com`  |
| Port     | `993`                       |
| Security | SSL/TLS                     |

IMAP/receiving is **not implemented** — see [section 6](#6-imap--receiving).

## 3. Environment variables

These are the exact names read by `lib/mailer.ts`. Set all of them for this
mailbox:

```dotenv
MAIL_ENABLED=true
SMTP_HOST=mail.masteryresearch.com
SMTP_PORT=465
SMTP_SECURE=ssl
SMTP_USERNAME=onevyrt@masteryresearch.com
SMTP_PASSWORD=<set-on-server>
SMTP_FROM_EMAIL=onevyrt@masteryresearch.com
SMTP_FROM_NAME=ONEVYRT
```

Notes on each:

- **`MAIL_ENABLED`** — must be exactly `true`. Together with `SMTP_HOST` being
  set, this is what flips the mailer from "would send" into real sending.
- **`SMTP_PORT`** — defaults to `587` in code if unset; here it must be `465`.
- **`SMTP_SECURE`** — controls implicit vs. negotiated TLS. The code treats
  `ssl`, `true`, or `1` (case-insensitive) as **implicit TLS from the first
  byte** (`secure: true`), which is what **port 465** requires. **So set
  `SMTP_SECURE=ssl` for 465.**
  - If you were instead using **port 587**, you would **leave `SMTP_SECURE`
    unset** (or set it to anything other than `ssl`/`true`/`1`). That gives
    `secure: false`, and nodemailer negotiates STARTTLS itself. Do **not** set
    `SMTP_SECURE=ssl` on 587 — the handshake will fail.
- **`SMTP_USERNAME` / `SMTP_PASSWORD`** — the full mailbox login. If
  `SMTP_USERNAME` is set, auth is enabled with this user/pass pair.
- **`SMTP_FROM_EMAIL`** — the visible From address. Falls back to
  `SMTP_USERNAME` if unset; set it explicitly to be safe.
- **`SMTP_FROM_NAME`** — optional display name. With it set, mail is sent as
  `"ONEVYRT" <onevyrt@masteryresearch.com>`; without it, just the bare address.

**Never put the real password in this file or any committed file.** Keep
`SMTP_PASSWORD` as `<set-on-server>` here and supply the real value only in the
server environment and local `.env.local` (see [section 7](#7-security)).

## 4. Applying on the Bluehost Docker deployment

The app runs as a Docker container (**`onevyrt-app`**) under
`/opt/onevyrt-src`. The exact `deploy.sh` isn't documented here, so the rule is
simple: **add the variables from section 3 to wherever this container gets its
environment, then recreate/restart the container.**

The environment is passed in one of these standard ways — use whichever your
deployment already uses:

- **Env file** referenced by `docker run --env-file`:

  ```bash
  # e.g. /opt/onevyrt-src/.env  (server-only, not committed)
  docker run --env-file /opt/onevyrt-src/.env … onevyrt-app
  ```

  Add the section-3 lines to that env file.

- **`environment:` (or `env_file:`) in `docker-compose.yml`:**

  ```yaml
  services:
    onevyrt-app:
      environment:
        - MAIL_ENABLED=true
        - SMTP_HOST=mail.masteryresearch.com
        - SMTP_PORT=465
        - SMTP_SECURE=ssl
        - SMTP_USERNAME=onevyrt@masteryresearch.com
        - SMTP_PASSWORD=<set-on-server>
        - SMTP_FROM_EMAIL=onevyrt@masteryresearch.com
        - SMTP_FROM_NAME=ONEVYRT
  ```

- **Individual `-e` flags** on `docker run`:

  ```bash
  docker run \
    -e MAIL_ENABLED=true \
    -e SMTP_HOST=mail.masteryresearch.com \
    -e SMTP_PORT=465 \
    -e SMTP_SECURE=ssl \
    -e SMTP_USERNAME=onevyrt@masteryresearch.com \
    -e SMTP_PASSWORD='<set-on-server>' \
    -e SMTP_FROM_EMAIL=onevyrt@masteryresearch.com \
    -e SMTP_FROM_NAME=ONEVYRT \
    … onevyrt-app
  ```

**A running container will not pick up new env vars — you must recreate or
restart it** after changing them:

```bash
# compose
docker compose up -d onevyrt-app        # recreates with new env

# or plain docker
docker rm -f onevyrt-app && docker run … onevyrt-app
```

Confirm they landed inside the running container:

```bash
docker exec onevyrt-app printenv | grep -E 'MAIL_ENABLED|SMTP_'
```

The vars must be present in **the running container's environment**. For local
development/testing, also add them to `apps/web/.env.local` (gitignored).

## 5. Testing

### (a) Connection + auth check (no email sent)

From a machine that can actually reach `mail.masteryresearch.com:465`, verify
the transport authenticates using nodemailer's `.verify()`:

```bash
node -e '
const nm = require("nodemailer");
nm.createTransport({
  host: "mail.masteryresearch.com",
  port: 465,
  secure: true,
  auth: { user: "onevyrt@masteryresearch.com", pass: process.env.SMTP_PASSWORD },
}).verify()
  .then(() => console.log("OK: SMTP connect + auth succeeded"))
  .catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
'
```

Run it with the real password in the environment, e.g.
`SMTP_PASSWORD='…' node -e '…'`. This opens the connection and authenticates
but sends nothing.

> **Note:** this **fails from sandboxed/CI environments that block outbound
> SMTP egress** (connection timeout / refused on port 465). That's expected —
> it's a network restriction, not a config error. Run it from the deployment
> host or another box with real SMTP egress.

### (b) End-to-end (real email)

The truest test is to trigger one of the app's existing transactional flows and
confirm the mail arrives:

- Request a **password reset**, or
- Start a **login OTP**,

for an address you control, then check that inbox. Also check the container
logs — a success looks like `[mailer] sent to <addr> via SMTP`; a failure looks
like `[mailer] send to <addr> failed: <reason>`.

## 6. IMAP / receiving

**Receiving mail is NOT implemented.** `lib/mailer.ts` uses nodemailer, which
**only sends** — there is no IMAP client, no polling, no inbox, and the app does
not read the mailbox. The IMAP settings in section 2 are listed only for
completeness of the cPanel account.

If in-app receiving is ever wanted (e.g. a shared inbox, reading user replies,
threading), it is a **separate feature**, roughly:

- an IMAP client library to connect to `mail.masteryresearch.com:993`,
- a sync/poll job to pull new messages into the database,
- UI to list and read them.

**Open question before any of that is built: what is the receive use case?**
(Support inbox? Reply threading on broadcasts? Something else?) The answer
drives the whole design.

## 7. Security

- Keep **`SMTP_PASSWORD`** only in the **server environment** and in
  **`apps/web/.env.local`** (which is gitignored). **Never commit it** — not in
  this doc, not in `docker-compose.yml`, not in any tracked file. The
  placeholder stays `<set-on-server>` everywhere that is tracked.
- If the mailbox password has ever been shared over an insecure channel (chat,
  email, a support ticket, a screenshot), **rotate it** in cPanel and update the
  server env + `.env.local`.
