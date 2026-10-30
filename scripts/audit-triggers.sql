-- Rode UMA vez, depois de `pnpm db:migrate`, no MySQL do Railway (MySQL real suporta triggers).
-- Torna security_audit_log append-only no próprio banco.
DROP TRIGGER IF EXISTS security_audit_log_no_update;
DROP TRIGGER IF EXISTS security_audit_log_no_delete;
CREATE TRIGGER security_audit_log_no_update BEFORE UPDATE ON security_audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'security_audit_log is append-only';
CREATE TRIGGER security_audit_log_no_delete BEFORE DELETE ON security_audit_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'security_audit_log is append-only';
