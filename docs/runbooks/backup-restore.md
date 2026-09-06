# Backup and restore

Per [ADR-0019](../decisions/ADR-0019-backup-restore-disaster-recovery.md):
standard Postgres logical backups via `pg_dump`/`pg_restore`. The exact
commands below are the ones actually exercised (against this session's
dev database, verified row-for-row) while writing that ADR, not a
theoretical sketch.

**This runbook does not yet cover**: a backup schedule, retention
policy, or recovery-time objectives - see ADR-0019's "What's still
deferred" section for why those need a real deployment target first.
What follows is the mechanism, ready to schedule once that exists.

## Take a backup

```sh
pg_dump -h <host> -U <user> -d <database> -Fc -f backup.dump
```

`-Fc` (custom format) is required, not optional - it's what makes the
file usable with `pg_restore` below, compresses automatically, and
restores selectively (a single table, `--data-only`, etc.) if ever
needed, none of which a plain SQL dump (`-Fp`) supports as cleanly.

## Restore a backup

Always restore into a **different, empty database** first and verify it
before ever pointing production traffic at it - never `pg_restore`
directly over a live database you might still need the original of.

```sh
createdb -h <host> -U <user> <restore-target-database>
pg_restore -h <host> -U <user> -d <restore-target-database> backup.dump
```

## Verify a restore actually worked

Row counts alone are cheap and catch the common failure mode (a
truncated dump, a restore that silently skipped tables):

```sh
psql -h <host> -U <user> -d <database> -t -A -c "
  SELECT table_name || ':' || (xpath('/row/c/text()',
    query_to_xml(format('select count(*) as c from %I', table_name), false, true, '')
  ))[1]::text
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name != 'schema_migrations'
  ORDER BY table_name;
" > counts.txt
```

Run this against both the source and the restored database, then
`diff` the two files - an empty diff means every table's row count
matches. For a stronger check, also spot-check a specific row's exact
column values in both databases, and confirm at least one foreign-key
join still resolves (proves referential integrity, not just row counts,
survived the round trip).

## Clean up

Drop the restore-target database once verification is done, unless it's
meant to become the new primary:

```sh
dropdb -h <host> -U <user> <restore-target-database>
```
