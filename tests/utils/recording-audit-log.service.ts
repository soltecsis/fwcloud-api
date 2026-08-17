import type { AuditLogMutationInput } from '../../src/models/audit/AuditLog.service';

/**
 * Audit double for services that take an `AuditLogService` override: records
 * every mutation instead of writing it, so a test can assert both *what* was
 * audited and that nothing else was.
 *
 * Set `fail` to make `logMutation()` reject, which is how the "an audit failure
 * must not undo the work that was already done" paths are exercised.
 */
export class RecordingAuditLogService {
  public readonly calls: AuditLogMutationInput[] = [];
  public fail = false;

  public async logMutation(input: AuditLogMutationInput): Promise<null> {
    this.calls.push(input);
    if (this.fail) {
      throw new Error('audit unavailable');
    }
    return null;
  }
}
