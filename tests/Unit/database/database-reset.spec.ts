import sinon from 'sinon';
import { DatabaseService } from '../../../src/database/database.service';
import { expect, testSuite } from '../../mocha/global-setup';
import { DatabaseReset } from '../../utils/database-reset';

describe('Test database reset', () => {
  let service: DatabaseService;
  let reset: DatabaseReset;

  before(async () => {
    service = await testSuite.app.getService<DatabaseService>(DatabaseService.name);
    reset = new DatabaseReset();
    await reset.reset(service);
  });

  after(async () => {
    await testSuite.resetDatabaseData({ rebuildSchema: true });
  });

  it('restores both migrated and seeded rows without rerunning migrations', async () => {
    const before = await service.dataSource.query('SELECT * FROM ipobj_type ORDER BY id');
    const migrations = await service.dataSource.query('SELECT * FROM migrations ORDER BY id');
    const tables = await service.dataSource.query('SHOW TABLES');
    expect(before.some((row) => row.id === 0)).to.equal(true);
    expect(before.some((row) => row.id === 333)).to.equal(true);

    const rebuild = sinon.stub(service, 'resetMigrations').rejects(new Error('Unexpected rebuild'));
    const migrate = sinon.stub(service, 'runMigrations').rejects(new Error('Unexpected migration'));
    try {
      await service.dataSource.query(
        "UPDATE ipobj_type SET type = 'modified' WHERE id IN (0, 333)",
      );
      await service.dataSource.query("INSERT INTO fwcloud (id, name) VALUES (999, 'temporary')");
      await reset.reset(service);

      expect(await service.dataSource.query('SELECT * FROM ipobj_type ORDER BY id')).to.deep.equal(
        before,
      );
      expect(await service.dataSource.query('SELECT * FROM migrations ORDER BY id')).to.deep.equal(
        migrations,
      );
      expect(await service.dataSource.query('SHOW TABLES')).to.deep.equal(tables);
      expect(await service.dataSource.query('SELECT * FROM fwcloud')).to.deep.equal([]);
      expect(rebuild.called).to.equal(false);
      expect(migrate.called).to.equal(false);
    } finally {
      rebuild.restore();
      migrate.restore();
    }
  });

  it('restores auto-increment counters between consecutive resets', async () => {
    await reset.reset(service);
    const first = await service.dataSource.query("INSERT INTO fwcloud (name) VALUES ('first')");
    await service.dataSource.query("INSERT INTO fwcloud (id, name) VALUES (999, 'temporary')");
    await reset.reset(service);
    const second = await service.dataSource.query("INSERT INTO fwcloud (name) VALUES ('second')");
    expect(second.insertId).to.equal(first.insertId);
    await reset.reset(service);
  });

  it('rebuilds the schema explicitly after a test drops a column', async () => {
    try {
      await service.dataSource.query('ALTER TABLE ipsec DROP COLUMN name');
      await reset.reset(service, true);
      const columns = await service.dataSource.query("SHOW COLUMNS FROM ipsec LIKE 'name'");
      expect(columns).to.have.length(1);
      // The rebuilt baseline is also usable by the next ordinary reset.
      await reset.reset(service);
    } finally {
      await reset.reset(service, true);
    }
  });

  it('restores connection settings after a failed reset and rebuilds on the next reset', async () => {
    const runner = service.dataSource.createQueryRunner();
    const query = runner.query.bind(runner);
    const [original] = await query(
      'SELECT @@SESSION.FOREIGN_KEY_CHECKS AS foreignKeys, @@SESSION.SQL_MODE AS sqlMode',
    );
    const createRunner = sinon.stub(service.dataSource, 'createQueryRunner').returns(runner);
    const release = sinon.stub(runner, 'release').resolves();
    const failingQuery = sinon.stub(runner, 'query').callsFake(async (sql, parameters) => {
      if (sql.startsWith('DELETE FROM')) throw new Error('Simulated reset failure');
      return query(sql, parameters);
    });
    try {
      await expect(reset.reset(service)).to.be.rejectedWith('Simulated reset failure');
      const [restored] = await query(
        'SELECT @@SESSION.FOREIGN_KEY_CHECKS AS foreignKeys, @@SESSION.SQL_MODE AS sqlMode',
      );
      expect(restored).to.deep.equal(original);
      expect(release.calledOnce).to.equal(true);
    } finally {
      failingQuery.restore();
      release.restore();
      createRunner.restore();
      await runner.release();
    }
    const rebuild = sinon.spy(service, 'resetMigrations');
    try {
      await reset.reset(service);
      expect(rebuild.calledOnce).to.equal(true);
    } finally {
      rebuild.restore();
    }
  });
});
