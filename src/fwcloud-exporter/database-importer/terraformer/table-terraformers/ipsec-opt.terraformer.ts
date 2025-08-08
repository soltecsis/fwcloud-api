import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { ImportMapping } from '../mapper/import-mapping';
import { TableTerraformer, TerraformHandlerCollection } from '../table-terraformer';
import { number, object } from 'joi';
import { IPSec } from '../../../../models/vpn/ipsec/IPSec';

export class IPSecOptTerraformer extends TableTerraformer {
  public static async make(
    mapper: ImportMapping,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<IPSecOptTerraformer> {
    return new IPSecOptTerraformer(mapper, eventEmitter);
  }

  protected getCustomHandlers(): TerraformHandlerCollection {
    const result: TerraformHandlerCollection = {};
    result['ipsec'] = (mapper: ImportMapping, _row: object, value: number) => {
      return mapper.getMappedId(IPSec._getTableName(), 'id', value);
    };
    result['ipsec_cli'] = (mapper: ImportMapping, _row: object, value: number) => {
      if (value === null || value === undefined) {
        return value as any;
      }
      return mapper.getMappedId(IPSec._getTableName(), 'id', value);
    };
    result['ipobj'] = (mapper: ImportMapping, _row: object, value: number) => {
      if (value === null || value === undefined) {
        return value as any;
      }
      return mapper.getMappedId('ipobj', 'id', value);
    };
    return result;
  }
}
