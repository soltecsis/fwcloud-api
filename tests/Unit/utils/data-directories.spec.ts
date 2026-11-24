import 'reflect-metadata';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const config = require('../../../src/config/config');
const utils = require('../../../src/utils/utils');

describe('Legacy data directories', () => {
  const areas = ['policy', 'pki', 'backup', 'snapshot'];
  const originalRoots = new Map<string, string>();
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'fwcloud-data-'));
    for (const area of areas) {
      originalRoots.set(area, config.get(`${area}.data_dir`));
      config.set(`${area}.data_dir`, join(root, area));
    }
  });

  afterEach(async () => {
    for (const [area, directory] of originalRoots) config.set(`${area}.data_dir`, directory);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('creates and resets firewall directories and waits for the rename', async () => {
    const source = join(root, 'policy', '1', '2');
    const destination = join(root, 'policy', '1', '3');
    await utils.createFirewallDataDir('1', 2);
    await fs.writeFile(join(source, 'old.sh'), 'old');
    await utils.createFirewallDataDir(1, 2);
    assert.deepEqual(await fs.readdir(source), []);

    await fs.writeFile(join(source, 'policy.sh'), 'policy');
    await utils.renameFirewallDataDir(1, 2, 3);
    assert.equal(await fs.readFile(join(destination, 'policy.sh'), 'utf8'), 'policy');
    await assert.rejects(fs.stat(source), { code: 'ENOENT' });
    await utils.renameFirewallDataDir(1, 2, 3);
  });

  it('removes firewall, cloud, and CA directories and tolerates repeated removal', async () => {
    await utils.createFirewallDataDir(1, 2);
    await utils.removeFirewallDataDir(1, 2);
    await utils.removeFirewallDataDir(1, 2);
    const caDirectory = await utils.getCaDataDir(1, 3);
    await fs.mkdir(caDirectory, { recursive: true });
    await utils.removeCaDataDir(1, 3);
    await assert.rejects(fs.stat(caDirectory), { code: 'ENOENT' });

    const snapshot = join(root, 'snapshot', '1');
    await fs.mkdir(snapshot, { recursive: true });
    await utils.removeFwcloudDataDir(1);
    await assert.rejects(fs.stat(snapshot), { code: 'ENOENT' });
  });

  it('validates identifiers and preserves timestamp-based backup names', async () => {
    const backupId = '2026-11-24_10:30:00';
    await utils.createBackupDataDir(backupId);
    assert.ok((await fs.stat(join(root, 'backup', backupId))).isDirectory());
    await assert.rejects(utils.createBackupDataDir('..'), /Invalid data path segment/);
    await assert.rejects(utils.createFirewallDataDir(0, 2), /Invalid data directory ID/);
    await assert.rejects(utils.createFirewallDataDir(1, 2.5), /Invalid data directory ID/);
    await assert.rejects(utils.deleteFile(root, 'issued', 'invalid/name.crt'), /Invalid data path/);
    await utils.deleteFile(root, 'issued', 'missing.crt');
  });

  it('rejects linked directories and unlinks a linked certificate without following it', async () => {
    const destination = join(root, 'outside');
    const source = join(root, 'policy', '1');
    const certificate = join(destination, 'cert.crt');
    await fs.mkdir(join(root, 'policy'));
    await fs.mkdir(destination);
    await fs.writeFile(certificate, 'certificate');
    await fs.symlink(destination, source, 'dir');
    await assert.rejects(utils.removeFirewallDataDir(1, 2), /Invalid data directory/);
    await fs.symlink(destination, join(root, 'linked'), 'dir');
    await assert.rejects(utils.deleteFile(root, 'linked', 'cert.crt'), /Invalid data directory/);

    const issued = join(root, 'issued');
    await fs.mkdir(issued);
    await fs.symlink(certificate, join(issued, 'cert.crt'));
    await utils.deleteFile(root, 'issued', 'cert.crt');
    await assert.rejects(fs.lstat(join(issued, 'cert.crt')), { code: 'ENOENT' });
    assert.equal(await fs.readFile(certificate, 'utf8'), 'certificate');
  });
});
