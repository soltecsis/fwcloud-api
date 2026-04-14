import { EventEmitter } from 'typeorm/platform/PlatformTools';
import type { Arguments } from 'yargs';
import { Backup } from '../../backups/backup';
import { BackupService } from '../../backups/backup.service';
import { AuditLogService } from '../../models/audit/AuditLog.service';
import {
  EndTaskPayload,
  ErrorTaskPayload,
} from '../../fonaments/http/progress/messages/progress-messages';
import { ProgressPayload } from '../../sockets/messages/socket-message';
import { Argument, Command } from '../command';

/**
 * Runs migration command.
 */
export class BackupRestoreCommand extends Command {
  public name: string = 'backup:restore';
  public description: string = 'Restore an existing backup';

  async handle(args: Arguments) {
    const backupService: BackupService = await this._app.getService<BackupService>(
      BackupService.name,
    );
    const auditLogService: AuditLogService = await this._app.getService<AuditLogService>(
      AuditLogService.name,
    );
    const backup: Backup = await backupService.findOneOrFail(args.id as number);
    const eventEmitter = new EventEmitter();
    const operator = process.env.SUDO_USER ?? process.env.USER ?? null;
    const startedAt = Date.now();

    eventEmitter.on('message', (message: ProgressPayload) => {
      if (message instanceof EndTaskPayload) {
        this.output.success(message.message, 0);
      }

      if (message instanceof ErrorTaskPayload) {
        this.output.error(message.message);
      }
    });

    try {
      await backupService.restore(backup, eventEmitter);
      await auditLogService.logMutation({
        call: 'CLI backup:restore',
        description: `cli=backup:restore | status=success | backup=${backup.id}`,
        userName: operator,
        data: {
          source: 'cli',
          command: 'backup:restore',
          backupId: backup.id,
          durationMs: Date.now() - startedAt,
        },
      });
    } catch (error) {
      await auditLogService.logMutation({
        call: 'CLI backup:restore',
        description: `cli=backup:restore | status=error | backup=${backup.id}`,
        userName: operator,
        data: {
          source: 'cli',
          command: 'backup:restore',
          backupId: backup.id,
          durationMs: Date.now() - startedAt,
          error: error?.message ?? String(error),
        },
      });
      throw error;
    }

    this.output.writeLine();
  }

  public getArguments(): Argument[] {
    return [{ name: 'id', description: 'Backup id', required: true }];
  }
}
