import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';
import { FirewallInstallCommunication } from '../../../models/firewall/Firewall';

export class firewallAgentConfiguration1632231051227
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('firewall', [
      new TableColumn({
        name: 'install_communication',
        type: 'varchar',
        isNullable: false,
        default: `"${FirewallInstallCommunication.SSH}"`,
      }),
      new TableColumn({
        name: 'install_protocol',
        type: 'varchar',
        isNullable: true,
      }),
      new TableColumn({
        name: 'install_apikey',
        type: 'varchar',
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('firewall', 'install_communication');
    await queryRunner.dropColumn('firewall', 'install_protocol');
    await queryRunner.dropColumn('firewall', 'install_apikey');
  }
}
