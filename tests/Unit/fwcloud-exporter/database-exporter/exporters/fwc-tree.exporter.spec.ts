import { describeName, expect } from '../../../../mocha/global-setup';
import { ExporterResult } from '../../../../../src/fwcloud-exporter/database-exporter/exporter-result';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import { getRepository, Connection } from 'typeorm';
import StringHelper from '../../../../../src/utils/string.helper';
import { FwcTree } from '../../../../../src/models/tree/fwc-tree.model';
import { FwcTreeExporter } from '../../../../../src/fwcloud-exporter/database-exporter/exporters/fwc-tree.exporter';
import { app } from '../../../../../src/fonaments/abstract-application';
import { DatabaseService } from '../../../../../src/database/database.service';

describe(describeName('FwcTree Exporter Unit Tests'), () => {
  let result: ExporterResult;
  let fwCloud: FwCloud;
  let fwCloud2: FwCloud;
  let fwCloud2_node: FwcTree;

  let exporter: FwcTreeExporter;
  let connection: Connection;

  beforeEach(async () => {
    result = new ExporterResult();

    fwCloud = await getRepository(FwCloud).save(
      getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    fwCloud2 = await getRepository(FwCloud).save(
      getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    fwCloud2_node = await getRepository(FwcTree).save(
      getRepository(FwcTree).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud2.id,
      }),
    );

    exporter = new FwcTreeExporter();
    connection = (await app().getService<DatabaseService>(DatabaseService.name))
      .connection;
  });

  describe('export()', () => {
    it('should return an empty set if there is not any row related with the fwcloud', async () => {
      await exporter.bootstrap(connection, fwCloud.id);
      await exporter.export(result, connection, fwCloud.id);

      expect(result.getTableResults(FwcTree._getTableName())).to.have.length(0);
    });

    it('should return the fwc_tree which belongs directly with the fwcloud', async () => {
      await getRepository(FwcTree).save(
        getRepository(FwcTree).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );

      await exporter.bootstrap(connection, fwCloud.id);
      await exporter.export(result, connection, fwCloud.id);

      expect(result.getTableResults(FwcTree._getTableName())).to.have.length(1);
    });

    it('should return the fwc_tree which belongs indirectly with the fwcloud', async () => {
      const parentNode: FwcTree = await getRepository(FwcTree).save(
        getRepository(FwcTree).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );

      await getRepository(FwcTree).save(
        getRepository(FwcTree).create({
          name: StringHelper.randomize(10),
          parentId: parentNode.id,
          fwCloudId: fwCloud.id,
        }),
      );

      await exporter.bootstrap(connection, fwCloud.id);
      await exporter.export(result, connection, fwCloud.id);

      expect(result.getTableResults(FwcTree._getTableName())).to.have.length(2);
    });
  });
});
