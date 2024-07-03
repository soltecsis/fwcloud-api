import yargs from 'yargs';
import { Backup } from '../../backups/backup';
import { BackupService } from '../../backups/backup.service';
import { Command, Option } from '../command';

/**
 * Runs migration command.
 */
export class BackupCreateCommand extends Command {
  public name: string = 'backup:create';
  public description: string = 'Create a new backup';

  async handle(args: yargs.Arguments) {
    const backupService: BackupService =
      await this._app.getService<BackupService>(BackupService.name);

    const backup: Backup = await backupService.create(
      args.comment ? (args.comment as string) : null,
    );

    this.output.success(`Backup created: ${backup.path}`);
  }

  public getOptions(): Option[] {
    return [
      {
        name: 'comment',
        alias: 'c',
        description: 'Backup comment',
        required: false,
      },
    ];
  }
}
