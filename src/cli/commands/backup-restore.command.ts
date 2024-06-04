import chalk from "chalk";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import yargs from "yargs";
import { Backup } from "../../backups/backup";
import { BackupService } from "../../backups/backup.service";
import {
  EndTaskPayload,
  ErrorTaskPayload,
  StartTaskPayload,
} from "../../fonaments/http/progress/messages/progress-messages";
import { ProgressPayload } from "../../sockets/messages/socket-message";
import { Argument, Command } from "../command";

/**
 * Runs migration command.
 */
export class BackupRestoreCommand extends Command {
  public name: string = "backup:restore";
  public description: string = "Restore an existing backup";

  async handle(args: yargs.Arguments) {
    const backupService: BackupService =
      await this._app.getService<BackupService>(BackupService.name);
    const backup: Backup = await backupService.findOneOrFail(args.id as number);
    const eventEmitter = new EventEmitter();

    eventEmitter.on("message", (message: ProgressPayload) => {
      if (message instanceof EndTaskPayload) {
        this.output.success(message.message, 0);
      }

      if (message instanceof ErrorTaskPayload) {
        this.output.error(message.message);
      }
    });

    await backupService.restore(backup, eventEmitter);

    this.output.writeLine();
  }

  public getArguments(): Argument[] {
    return [{ name: "id", description: "Backup id", required: true }];
  }
}
