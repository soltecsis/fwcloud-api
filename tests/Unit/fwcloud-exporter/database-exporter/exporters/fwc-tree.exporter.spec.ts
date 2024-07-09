import { describeName, expect } from '../../../../mocha/global-setup';
import { ExporterResult } from '../../../../../src/fwcloud-exporter/database-exporter/exporter-result';
import { FwCloud } from '../../../../../src/models/fwcloud/FwCloud';
import StringHelper from '../../../../../src/utils/string.helper';
import { FwcTree } from '../../../../../src/models/tree/fwc-tree.model';
import { FwcTreeExporter } from '../../../../../src/fwcloud-exporter/database-exporter/exporters/fwc-tree.exporter';
import { app } from '../../../../../src/fonaments/abstract-application';
import { DatabaseService } from '../../../../../src/database/database.service';
import { DataSource } from 'typeorm';

describe(describeName('FwcTree Exporter Unit Tests'), () => {
  let result: ExporterResult;
  let fwCloud: FwCloud;
  let fwCloud2: FwCloud;

  let exporter: FwcTreeExporter;
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = (await app().getService<DatabaseService>(DatabaseService.name)).dataSource;
    result = new ExporterResult();

    fwCloud = await dataSource.manager.getRepository(FwCloud).save(
      dataSource.manager.getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    fwCloud2 = await dataSource.manager.getRepository(FwCloud).save(
      dataSource.manager.getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );

    //fwCloud2_node =
    await dataSource.manager.getRepository(FwcTree).save(
      dataSource.manager.getRepository(FwcTree).create({
        name: StringHelper.randomize(10),
        fwCloudId: fwCloud2.id,
      }),
    );

    exporter = new FwcTreeExporter();
  });

  describe('export()', () => {
    it('should return an empty set if there is not any row related with the fwcloud', async () => {
      await exporter.bootstrap(dataSource, fwCloud.id);
      await exporter.export(result, dataSource, fwCloud.id);

      expect(result.getTableResults(FwcTree._getTableName())).to.have.length(0);
    });

    it('should return the fwc_tree which belongs directly with the fwcloud', async () => {
      await dataSource.manager.getRepository(FwcTree).save(
        dataSource.manager.getRepository(FwcTree).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );

      await exporter.bootstrap(dataSource, fwCloud.id);
      await exporter.export(result, dataSource, fwCloud.id);

      expect(result.getTableResults(FwcTree._getTableName())).to.have.length(1);
    });

    it('should return the fwc_tree which belongs indirectly with the fwcloud', async () => {
      const parentNode: FwcTree = await dataSource.manager.getRepository(FwcTree).save(
        dataSource.manager.getRepository(FwcTree).create({
          name: StringHelper.randomize(10),
          fwCloudId: fwCloud.id,
        }),
      );

      await dataSource.manager.getRepository(FwcTree).save(
        dataSource.manager.getRepository(FwcTree).create({
          name: StringHelper.randomize(10),
          parentId: parentNode.id,
          fwCloudId: fwCloud.id,
        }),
      );

      await exporter.bootstrap(dataSource, fwCloud.id);
      await exporter.export(result, dataSource, fwCloud.id);

      expect(result.getTableResults(FwcTree._getTableName())).to.have.length(2);
    });
  });
});
