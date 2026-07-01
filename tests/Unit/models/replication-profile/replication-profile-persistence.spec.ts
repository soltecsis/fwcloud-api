import { describeName, expect, testSuite } from '../../../mocha/global-setup';
import db from '../../../../src/database/database-manager';
import defaultReplicationProfile from '../../../../src/models/replication-profile/presets/default-replication-profile.v1.json';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import StringHelper from '../../../../src/utils/string.helper';
import { Like, QueryFailedError, Repository } from 'typeorm';

describe(describeName('Replication Profile Persistence (FWCloud scope) Unit Tests'), () => {
  let repository: Repository<ReplicationProfile>;
  let fwCloudRepository: Repository<FwCloud>;
  let fwCloudA: FwCloud;
  let fwCloudB: FwCloud;
  let codePrefix: string;

  const makeProfile = (overrides: Partial<ReplicationProfile> = {}): ReplicationProfile =>
    repository.create({
      code: `${codePrefix}profile`,
      version: 1,
      name: 'Custom profile',
      description: null,
      scope: 'custom',
      targetKind: 'firewall',
      model: {
        compatibility: { targetKinds: ['firewall'] },
        roleAssignments: { interfaceRoles: ['wan', 'lan'] },
      },
      isBuiltin: false,
      isActive: true,
      isDeprecated: false,
      ...overrides,
    });

  const newFwCloud = (): Promise<FwCloud> =>
    fwCloudRepository.save(
      fwCloudRepository.create({
        name: StringHelper.randomize(10),
        locked: false,
        locked_by: null,
      }),
    );

  before(async () => {
    testSuite.app;
    await testSuite.resetDatabaseData();
  });

  beforeEach(async () => {
    repository = db.getSource().manager.getRepository(ReplicationProfile);
    fwCloudRepository = db.getSource().manager.getRepository(FwCloud);
    codePrefix = `rp-persist-${Date.now()}-${Math.round(Math.random() * 100000)}-`;

    fwCloudA = await newFwCloud();
    fwCloudB = await newFwCloud();
  });

  afterEach(async () => {
    await repository.delete({ code: Like(`${codePrefix}%`) });
  });

  it('should keep the built-in default preset global and unchanged', async () => {
    const preset = await repository.findOne({
      where: { code: defaultReplicationProfile.code, version: defaultReplicationProfile.version },
    });

    expect(preset).not.to.be.null;
    expect(preset.isBuiltin).to.be.true;
    expect(preset.fwCloudId).to.be.null;
    expect(preset.category).to.be.null;
    expect(preset.created_by).to.be.null;
    expect(preset.updated_by).to.be.null;
  });

  it('should persist a custom profile scoped to a FWCloud', async () => {
    const saved = await repository.save(
      makeProfile({
        code: `${codePrefix}scoped`,
        fwCloudId: fwCloudA.id,
        category: 'office',
        created_by: 7,
        updated_by: 7,
      }),
    );

    const reloaded = await repository.findOneOrFail({ where: { id: saved.id } });

    expect(reloaded.isBuiltin).to.be.false;
    expect(reloaded.fwCloudId).to.be.eq(fwCloudA.id);
    expect(reloaded.category).to.be.eq('office');
    expect(reloaded.created_by).to.be.eq(7);
    expect(reloaded.updated_by).to.be.eq(7);
  });

  it('should allow the same code+version in two different FWClouds', async () => {
    const inA = await repository.save(
      makeProfile({ code: `${codePrefix}shared`, version: 1, fwCloudId: fwCloudA.id }),
    );
    const inB = await repository.save(
      makeProfile({ code: `${codePrefix}shared`, version: 1, fwCloudId: fwCloudB.id }),
    );

    expect(inA.id).to.be.a('number');
    expect(inB.id).to.be.a('number');
    expect(inA.id).not.to.be.eq(inB.id);
  });

  it('should reject a duplicate code+version within the same FWCloud', async () => {
    await repository.save(
      makeProfile({ code: `${codePrefix}dup`, version: 1, fwCloudId: fwCloudA.id }),
    );

    await expect(
      repository.save(
        makeProfile({ code: `${codePrefix}dup`, version: 1, fwCloudId: fwCloudA.id }),
      ),
    ).to.be.rejectedWith(QueryFailedError);
  });

  it('should keep built-in/global profiles globally unique', async () => {
    await repository.save(
      makeProfile({ code: `${codePrefix}global`, version: 1, isBuiltin: true, fwCloudId: null }),
    );

    await expect(
      repository.save(
        makeProfile({ code: `${codePrefix}global`, version: 1, isBuiltin: true, fwCloudId: null }),
      ),
    ).to.be.rejectedWith(QueryFailedError);
  });

  it('should block deleting a FWCloud that still owns custom profiles (ON DELETE RESTRICT)', async () => {
    const owner = await newFwCloud();
    await repository.save(makeProfile({ code: `${codePrefix}restrict`, fwCloudId: owner.id }));

    await expect(
      db.getSource().query('DELETE FROM fwcloud WHERE id = ?', [owner.id]),
    ).to.be.rejectedWith(QueryFailedError);
  });

  it('should remove owned custom profiles and preserve built-ins when a FWCloud is removed', async () => {
    const owner = await newFwCloud();
    const custom = await repository.save(
      makeProfile({ code: `${codePrefix}removed`, fwCloudId: owner.id }),
    );

    const managedFwCloud = await FwCloud.findOneOrFail({ where: { id: owner.id } });
    await managedFwCloud.remove();

    expect(await repository.findOne({ where: { id: custom.id } })).to.be.null;

    const preset = await repository.findOne({
      where: { code: defaultReplicationProfile.code, version: defaultReplicationProfile.version },
    });
    expect(preset).not.to.be.null;
    expect(preset.fwCloudId).to.be.null;

    expect(await fwCloudRepository.findOne({ where: { id: owner.id } })).to.be.null;
  });
});
