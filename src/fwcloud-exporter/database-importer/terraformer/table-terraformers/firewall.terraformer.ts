import { TableTerraformer, TerraformHandlerCollection } from '../table-terraformer';
import { ImportMapping } from '../mapper/import-mapping';
import { IPObj } from '../../../../models/ipobj/IPObj';
import { Interface } from '../../../../models/interface/Interface';
import { EventEmitter } from 'typeorm/platform/PlatformTools';

export class FirewallTerraformer extends TableTerraformer {
  public static async make(
    mapper: ImportMapping,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<FirewallTerraformer> {
    return new Promise((resolve) => {
      const terraformer: FirewallTerraformer = new FirewallTerraformer(mapper, eventEmitter);
      resolve(terraformer);
    });
  }

  /**
   * Both 'install_ipobj' and 'install_interface' foreign key is missing thus, this handler
   * maps the value as it was a foreign key
   */
  protected getCustomHandlers(): TerraformHandlerCollection {
    const result = {};

    result['install_ipobj'] = (mapper: ImportMapping, row: object, value: number) => {
      return mapper.getMappedId(IPObj._getTableName(), 'id', value);
    };

    result['install_interface'] = (mapper: ImportMapping, row: object, value: number) => {
      return mapper.getMappedId(Interface._getTableName(), 'id', value);
    };

    return result;
  }
}
