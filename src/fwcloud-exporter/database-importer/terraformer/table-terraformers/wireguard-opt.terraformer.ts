import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { ImportMapping } from '../mapper/import-mapping';
import { TableTerraformer, TerraformHandlerCollection } from '../table-terraformer';
import { number, object } from 'joi';
import { WireGuard } from '../../../../models/vpn/wireguard/WireGuard';

export class WireguardOptTerraformer extends TableTerraformer {
  public static async make(
    mapper: ImportMapping,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<WireguardOptTerraformer> {
    return new WireguardOptTerraformer(mapper, eventEmitter);
  }

  protected getCustomHandlers(): TerraformHandlerCollection {
    const result: TerraformHandlerCollection = {};
    result['wireguard'] = (mapper: ImportMapping, _row: object, value: number) => {
      return mapper.getMappedId(WireGuard._getTableName(), 'id', value);
    };
    result['wireguard_cli'] = (mapper: ImportMapping, _row: object, value: number) => {
      if (value === null || value === undefined) {
        return value as any;
      }
      return mapper.getMappedId(WireGuard._getTableName(), 'id', value);
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
