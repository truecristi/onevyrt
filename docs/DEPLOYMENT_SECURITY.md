# ONEVYRT Deployment Security Guide

This guide covers the security configurations required for deploying ONEVYRT to production. All three critical security features must be properly configured before the app will start.

## Quick Start (Production Deployment)

### 1. Generate AUTH_SECRET

```bash
# Generate a 64-character random hex string
AUTH_SECRET=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')
echo "AUTH_SECRET=$AUTH_SECRET"
```

Save this in your platform's secrets manager (e.g., GitHub Actions Secrets, Vercel Environment Variables, Railway Secrets).

### 2. Configure Database TLS Certificate

Obtain the CA certificate from your database provider and set ONE of these:

**Option A: Inline Certificate (Single Line)**
```bash
# For most providers, export the cert as a single PEM and set inline
export DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----
MIIDQTCCAimgAwIBAgITBmyfz5m/...
-----END CERTIFICATE-----"
```

**Option B: Certificate File Path**
```bash
# Store the PEM in a file and point to it
export DATABASE_CA_CERT_PATH="/etc/ssl/certs/rds-ca-bundle.pem"
```

**Option C: Node's Default Trust Store**
```bash
# For providers already in Node's default trust store
export DATABASE_SSL_REJECT_UNAUTHORIZED=1
```

### 3. Set NODE_ENV

```bash
export NODE_ENV=production
```

### 4. Start the App

```bash
npm start
# or
node apps/web/server.js
```

If all three security features are configured correctly, you should see:
```
[Security] All production security checks passed.
```

If any check fails, the app will not start and will display a detailed error message.

---

## Platform-Specific Guides

### Vercel

1. **Set Environment Variables:**
   - Go to Project Settings → Environment Variables
   - Add `NODE_ENV` = `production`
   - Add `AUTH_SECRET` = (generated value)
   - Add `DATABASE_URL` = (your connection string)
   - Add `DATABASE_CA_CERT` = (certificate content) OR
   - Add `DATABASE_CA_CERT_PATH` = (path to cert file) OR
   - Add `DATABASE_SSL_REJECT_UNAUTHORIZED` = `1`

2. **Deploy:**
   ```bash
   vercel deploy --prod
   ```

3. **Verify:**
   - Check deployment logs for "[Security] All production security checks passed"
   - Test a protected endpoint (POST without CSRF token should return 403)

### Railway.app

1. **Set Variables in Dashboard:**
   - Variables → Add
   - `NODE_ENV` = `production`
   - `AUTH_SECRET` = (generated)
   - `DATABASE_CA_CERT_PATH` = `/app/ca-bundle.pem` (then upload file)

2. **Upload CA Certificate:**
   - Files → Upload `ca-bundle.pem`
   - Ensure path matches `DATABASE_CA_CERT_PATH`

3. **Deploy:**
   - Push to connected repository (GitHub)
   - Railway auto-deploys on push

### Self-Hosted / VPS

1. **Set Environment File:**
   ```bash
   # /app/.env.production.local
   NODE_ENV=production
   AUTH_SECRET=<generated-secret>
   DATABASE_URL=postgres://user:pass@host:5432/db
   DATABASE_CA_CERT_PATH=/app/certs/ca-bundle.pem
   ```

2. **Copy CA Certificate:**
   ```bash
   mkdir -p /app/certs
   cp /path/to/ca-bundle.pem /app/certs/ca-bundle.pem
   chmod 400 /app/certs/ca-bundle.pem
   ```

3. **Start Service:**
   ```bash
   # Using systemd
   systemctl restart onevyrt
   
   # Using Docker
   docker run -e NODE_ENV=production \
     -e AUTH_SECRET="..." \
     -e DATABASE_CA_CERT_PATH=/app/certs/ca-bundle.pem \
     -v /app/certs:/app/certs:ro \
     onevyrt:latest
   ```

### Fly.io

1. **Set Secrets:**
   ```bash
   flyctl secrets set NODE_ENV=production
   flyctl secrets set AUTH_SECRET="<generated-secret>"
   flyctl secrets set DATABASE_CA_CERT_PATH="/app/ca.pem"
   ```

2. **Upload CA Certificate:**
   - Add to Dockerfile:
   ```dockerfile
   COPY ca.pem /app/ca.pem
   RUN chmod 400 /app/ca.pem
   ```

3. **Deploy:**
   ```bash
   flyctl deploy
   ```

---

## TLS Certificate Acquisition

### From Supabase

1. Log in to Supabase Console
2. Project Settings → Database → Connection String
3. Download "CA Certificate" (usually a `.crt` file)
4. Convert to PEM if needed:
   ```bash
   openssl x509 -inform DER -in certificate.crt -out certificate.pem
   ```

### From AWS RDS

1. AWS RDS Console → Databases → (Your Database)
2. Connectivity & Security → Endpoint & port
3. Regional certificate download link near the bottom
4. Download the CA bundle (usually `rds-ca-2019-root.pem` or similar)

### From Azure Database for PostgreSQL

1. Azure Portal → Your PostgreSQL Server
2. SSL/TLS settings → Download server CA certificate
3. Use the downloaded `.pem` file directly

### From Self-Hosted Postgres

If running your own Postgres with TLS:
```bash
# Extract certificate from server
pg_dump --host=$PGHOST --user=$PGUSER --dbname=postgres \
  | openssl s_client -connect $PGHOST:5432 -showcerts

# Or get from server certificate store
cat /etc/postgresql/certs/server.crt
```

---

## Verifying TLS Configuration

### Test Connection Before Deployment

```bash
# Test PostgreSQL TLS connection with Node.js
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(process.env.DATABASE_CA_CERT_PATH, 'utf-8')
  }
});
pool.query('SELECT 1')
  .then(() => console.log('✓ TLS connection successful'))
  .catch(e => console.error('✗ TLS connection failed:', e.message))
  .finally(() => pool.end());
"
```

### Check Certificate Details

```bash
# View certificate info
openssl x509 -in ca.pem -text -noout

# Verify certificate chain
openssl verify -CAfile ca.pem ca.pem

# Test connection with openssl
openssl s_client -connect $PGHOST:5432 -CAfile ca.pem
```

---

## Troubleshooting

### "AUTH_SECRET is not set in production"

**Problem:** App fails to start with this error
**Solution:** 
1. Generate: `node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'`
2. Set in environment: `export AUTH_SECRET="..."`
3. Verify: `echo $AUTH_SECRET` (should show 64 hex chars)
4. Restart app

### "TLS certificate verification is not configured"

**Problem:** App fails to start about missing CA certificate
**Solution:**
1. Get certificate from provider (see "TLS Certificate Acquisition" above)
2. Set ONE of:
   - `DATABASE_CA_CERT` (inline PEM)
   - `DATABASE_CA_CERT_PATH` (path to file)
   - `DATABASE_SSL_REJECT_UNAUTHORIZED=1` (if in Node's trust store)
3. Restart app

### "certificate verify failed"

**Problem:** TLS connection fails with "certificate verify failed"
**Causes:**
- Certificate has expired
- Certificate doesn't match hostname
- Wrong CA certificate provided
- System clock out of sync

**Debug:**
```bash
# Check cert expiry
openssl x509 -in ca.pem -noout -dates

# Test connection details
psql "host=$PGHOST port=5432 user=$PGUSER dbname=$PGDATABASE sslmode=require sslrootcert=ca.pem"
```

### CSRF Tokens Returning 403

**Problem:** Forms submitted with POST return 403 Forbidden
**Possible Causes:**
- CSRF token not in `x-csrf-token` header
- Session cookie lost or domain mismatch
- Token signature invalid (auth secret mismatch across instances)

**Debug:**
1. Check browser cookies for `gb_csrf_token`
2. Check request headers for `x-csrf-token`
3. Verify all instances share same `AUTH_SECRET`
4. Check browser console for JavaScript errors

---

## Security Checklist Before Production

- [ ] `NODE_ENV=production` is set
- [ ] `AUTH_SECRET` is generated (64 hex chars) and set in all instances
- [ ] Database TLS is configured (one of three options)
- [ ] Test: Try to start app with missing AUTH_SECRET → should fail
- [ ] Test: Try to start app with missing CA cert → should fail
- [ ] Test: Submit POST without CSRF token → should return 403
- [ ] Test: Verify TLS certificate is valid (not self-signed or expired)
- [ ] Secrets are stored in platform secrets manager (never in code/commit)
- [ ] All instances share identical AUTH_SECRET
- [ ] Database connection uses TLS (never plain TCP)

---

## Performance Notes

- **Auth Secret Lookup:** Cached after first access (minimal overhead)
- **TLS Certificate Verification:** No per-request cost (negotiated once per connection)
- **CSRF Token Validation:** ~0.1ms per request (HMAC-SHA256)
- **Database Pool:** Connection reuse means TLS negotiation happens once per connection, not per query

No measurable performance impact from these security features.

---

## Backup & Recovery

### AUTH_SECRET Rotation

If AUTH_SECRET is compromised:

1. **Generate new secret:**
   ```bash
   node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
   ```

2. **Update in secrets manager**

3. **Rolling restart** (one instance at a time):
   - Stop instance
   - Update AUTH_SECRET env var
   - Start instance
   - Wait for health check to pass
   - Move to next instance

4. **Note:** All existing sessions will be invalidated. Users must log back in.

### TLS Certificate Renewal

1. Download new certificate from provider
2. Update `DATABASE_CA_CERT_PATH` or `DATABASE_CA_CERT` (no restart needed immediately)
3. Next connection will use new certificate
4. Optional: Restart instances to close old connections

---

## Monitoring & Alerts

### What to Monitor

1. **App Startup Success:**
   - Look for "[Security] All production security checks passed" in logs
   - If missing or missing an earlier line, security check failed

2. **CSRF Failures:**
   - Monitor for 403 responses with "CSRF token" in error message
   - High rate might indicate:
     - Client-side bug (token not being sent)
     - Session cookie issues (domain/path mismatch)
     - Multi-instance token mismatch (different AUTH_SECRET across instances)

3. **Database Connection Failures:**
   - Check for TLS handshake errors
   - Certificate expiry approaching (obtain renewed cert)
   - Network issues (proxy, firewall)

### Example Log to Watch For

```
✓ Connection pool created: max=10, timeout=10s
✓ SSL enabled: rejectUnauthorized=true, CA provided
✓ Database connection successful
[Security] All production security checks passed.
```

---

Last Updated: 2026-09-02  
Version: 1.0 (Wave 1 Foundations)
