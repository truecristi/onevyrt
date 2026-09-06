# Operational runbooks

Per the root README: "Operational procedures should be stored in
`docs/runbooks/`."

- [backup-restore.md](backup-restore.md) - `pg_dump`/`pg_restore`
  commands and a verification procedure, per
  [ADR-0019](../decisions/ADR-0019-backup-restore-disaster-recovery.md).
  Covers the mechanism only (actually exercised against a real
  database) - not yet a schedule, retention policy, or recovery-time
  objectives, since there is no deployed system with real traffic to
  size those against (see
  [ADR-0021](../decisions/ADR-0021-deployment-and-environments.md)).

Otherwise still empty - there is no deployed system to operate yet. The
next real runbook this repository needs, once deployment exists, is an
incident/rollback runbook for the application itself (not just the
database) per §45's "rollback or feature-disable runbook" requirement.
