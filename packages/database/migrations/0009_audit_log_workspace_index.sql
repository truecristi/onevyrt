-- Phase 2 schema (tenth slice): audit records.
-- Hand-written to match packages/database/src/schema.ts - see 0000_init.sql's
-- header comment for why these are hand-written rather than drizzle-kit
-- generated.
--
-- No new table: audit_log has existed and been written to since Phase 1
-- (every business-core use case inserts a row). This migration only adds
-- the index its first read path (listAuditLog) now needs.

CREATE INDEX audit_log_workspace_id_idx ON audit_log(workspace_id);
