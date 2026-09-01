import { expect, testSuite } from '../../../mocha/global-setup';
import { COUNTRY_TREE_ROOT_NODE_TYPE, Tree } from '../../../../src/models/tree/Tree';
import { EntityManager } from 'typeorm';
import { FwCloud } from '../../../../src/models/fwcloud/FwCloud';
import db from '../../../../src/database/database-manager';
import StringHelper from '../../../../src/utils/string.helper';
import { Firewall } from '../../../../src/models/firewall/Firewall';
import { Cluster } from '../../../../src/models/firewall/Cluster';
import { Repair } from '../../../../src/models/tree/Repair';

const crowdSecChildNodes = [
  ['S06', 'Status'],
  ['S07', 'Collections'],
  ['S08', 'Decisions'],
  ['S09', 'Alerts'],
  ['S10', 'Bouncers'],
];

function expectCrowdSecChildren(firewallNode): void {
  const systemNode = firewallNode.children.find((node) => node.node_type === 'SYS');
  const crowdSecNode = systemNode.children.find((node) => node.node_type === 'S05');

  expect(crowdSecNode).to.exist;

  for (const [nodeType, name] of crowdSecChildNodes) {
    const node = crowdSecNode.children.find((child) => child.node_type === nodeType);
    expect(node).to.exist;
    expect(node.text).to.equal(name);
  }
}

describe('Tree Model Unit Tests', function () {
  let fwCloud: FwCloud;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();
    fwCloud = await manager.getRepository(FwCloud).save(
      manager.getRepository(FwCloud).create({
        name: StringHelper.randomize(10),
      }),
    );
  });

  describe('insertFwc_Tree_New_firewall()', () => {
    let firewall;

    beforeEach(async () => {
      const firewallData = {
        name: StringHelper.randomize(15),
        status: 3,
        fwCloudId: fwCloud.id,
        install_user: 'testUser',
        install_pass: 'testPass',
      };

      firewall = await manager
        .getRepository(Firewall)
        .save(manager.getRepository(Firewall).create(firewallData));
    });

    it('should insert a new firewall node and verify tree dump', async () => {
      const nodeId = 1;

      await Tree.createAllTreeCloud(fwCloud);
      await Tree.insertFwc_Tree_New_firewall(fwCloud.id, nodeId, firewall.id);
      const treeDump = await Tree.dumpTree(db.getQuery(), 'FIREWALLS', fwCloud.id);
      const insertedNode = treeDump.children.find((node) => node.id_obj === firewall.id);
      expect(insertedNode).to.exist;
      expect(insertedNode.node_type).to.equal('FW');
      expect(insertedNode.fwcloud).to.equal(fwCloud.id);
    });

    it('should generate VPN nodes under the firewall node', async () => {
      const nodeId = 1;

      await Tree.createAllTreeCloud(fwCloud);
      await Tree.insertFwc_Tree_New_firewall(fwCloud.id, nodeId, firewall.id);
      const treeDump = await Tree.dumpTree(db.getQuery(), 'FIREWALLS', fwCloud.id);
      const firewallNode = treeDump.children.find((node) => node.id_obj === firewall.id);
      expect(firewallNode).to.exist;

      const vpnNode = firewallNode.children.find((node) => node.node_type === 'VPN');
      expect(vpnNode).to.exist;
      expect(vpnNode.text).to.equal('VPN');

      const openVpnNode = vpnNode.children.find((node) => node.node_type === 'OPN');
      expect(openVpnNode).to.exist;
      expect(openVpnNode.text).to.equal('OpenVPN');

      const wireGuardNode = vpnNode.children.find((node) => node.node_type === 'WG');
      expect(wireGuardNode).to.exist;
      expect(wireGuardNode.text).to.equal('WireGuard');

      const ipSecNode = vpnNode.children.find((node) => node.node_type === 'IS');
      expect(ipSecNode).to.exist;
      expect(ipSecNode.text).to.equal('IPSec');
    });

    it('should generate CrowdSec child nodes under the system node', async () => {
      const nodeId = 1;

      await Tree.createAllTreeCloud(fwCloud);
      await Tree.insertFwc_Tree_New_firewall(fwCloud.id, nodeId, firewall.id);
      const treeDump = await Tree.dumpTree(db.getQuery(), 'FIREWALLS', fwCloud.id);
      const firewallNode = treeDump.children.find((node) => node.id_obj === firewall.id);

      expectCrowdSecChildren(firewallNode);
    });

    it('should insert a firewall tree when ipsec.name does not exist', async () => {
      const nodeId = 1;

      await manager.query('ALTER TABLE ipsec DROP COLUMN name');

      await Tree.createAllTreeCloud(fwCloud);
      await Tree.insertFwc_Tree_New_firewall(fwCloud.id, nodeId, firewall.id);

      const treeDump = await Tree.dumpTree(db.getQuery(), 'FIREWALLS', fwCloud.id);
      const insertedNode = treeDump.children.find((node) => node.id_obj === firewall.id);
      expect(insertedNode).to.exist;
      expect(insertedNode.node_type).to.equal('FW');
    });
  });

  describe('insertFwc_Tree_New_cluster_firewall()', () => {
    let clusterId;
    let fwnodes;
    let nodeId;

    beforeEach(async () => {
      const clusterData = {
        name: StringHelper.randomize(15),
        fwCloudId: fwCloud.id,
      };

      const cluster = await manager
        .getRepository(Cluster)
        .save(manager.getRepository(Cluster).create(clusterData));

      clusterId = cluster.id;

      nodeId = 1;

      fwnodes = [];
      for (let i = 0; i < 2; i++) {
        const firewallData = {
          name: StringHelper.randomize(15),
          status: 3,
          fwCloudId: fwCloud.id,
          clusterId: clusterId,
          install_user: 'testUser',
          install_pass: 'testPass',
          fwmaster: i === 0 ? 1 : 0,
        };

        const firewall = await manager
          .getRepository(Firewall)
          .save(manager.getRepository(Firewall).create(firewallData));

        fwnodes.push(firewall);
      }

      await Tree.createAllTreeCloud(fwCloud);
    });

    it('should insert a new cluster firewall node and verify tree dump', async () => {
      await Tree.insertFwc_Tree_New_cluster(fwCloud.id, nodeId, clusterId);

      const treeDump = await Tree.dumpTree(db.getQuery(), 'FIREWALLS', fwCloud.id);

      const insertedNode = treeDump.children.find((node) => node.id_obj === clusterId);
      expect(insertedNode).to.exist;
      expect(insertedNode.node_type).to.equal('CL');
      expect(insertedNode.fwcloud).to.equal(fwCloud.id);
    });

    it('should generate VPN nodes under the cluster firewall node', async () => {
      await Tree.insertFwc_Tree_New_cluster(fwCloud.id, 1, clusterId);

      const treeDump = await Tree.dumpTree(db.getQuery(), 'FIREWALLS', fwCloud.id);

      const clusterNode = treeDump.children.find((node) => node.id_obj === clusterId);
      expect(clusterNode).to.exist;

      const vpnNode = clusterNode.children.find((node) => node.node_type === 'VPN');
      expect(vpnNode).to.exist;
      expect(vpnNode.text).to.equal('VPN');

      const openVpnNode = vpnNode.children.find((node) => node.node_type === 'OPN');
      expect(openVpnNode).to.exist;
      expect(openVpnNode.text).to.equal('OpenVPN');

      const wireGuardNode = vpnNode.children.find((node) => node.node_type === 'WG');
      expect(wireGuardNode).to.exist;
      expect(wireGuardNode.text).to.equal('WireGuard');

      const ipSecNode = vpnNode.children.find((node) => node.node_type === 'IS');
      expect(ipSecNode).to.exist;
      expect(ipSecNode.text).to.equal('IPSec');
    });

    it('should generate CrowdSec child nodes under the system node', async () => {
      await Tree.insertFwc_Tree_New_cluster(fwCloud.id, nodeId, clusterId);
      const treeDump = await Tree.dumpTree(db.getQuery(), 'FIREWALLS', fwCloud.id);
      const clusterNode = treeDump.children.find((node) => node.id_obj === clusterId);

      expectCrowdSecChildren(clusterNode);
    });
  });

  describe('repair root checks', () => {
    it('should keep the countries root node as a valid tree root', async () => {
      const dbCon = db.getQuery();

      await Tree.createAllTreeCloud(fwCloud);
      await Repair.initData({ dbCon, body: { fwcloud: fwCloud.id } });
      await Repair.checkRootNodes(dbCon);

      const countryRootNodes = await manager.query(
        'SELECT id FROM fwc_tree WHERE fwcloud = ? AND id_parent IS NULL AND node_type = ?',
        [fwCloud.id, COUNTRY_TREE_ROOT_NODE_TYPE],
      );

      expect(countryRootNodes).to.have.length(1);
    });
  });
});
