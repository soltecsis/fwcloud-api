import request = require('supertest');
import db from '../../../../src/database/database-manager';
import { DHCPGroup } from '../../../../src/models/system/dhcp/dhcp_g/dhcp_g.model';
import { DHCPRule } from '../../../../src/models/system/dhcp/dhcp_r/dhcp_r.model';
import { HAProxyGroup } from '../../../../src/models/system/haproxy/haproxy_g/haproxy_g.model';
import { HAProxyRule } from '../../../../src/models/system/haproxy/haproxy_r/haproxy_r.model';
import { KeepalivedGroup } from '../../../../src/models/system/keepalived/keepalived_g/keepalived_g.model';
import { KeepalivedRule } from '../../../../src/models/system/keepalived/keepalived_r/keepalived_r.model';
import { Offset } from '../../../../src/offset';
import { expect, testSuite } from '../../../mocha/global-setup';
import { FwCloudFactory } from '../../../utils/fwcloud-factory';
import { attachSession, createUser, generateSession } from '../../../utils/utils';

describe('System policy group boundaries', () => {
  for (const { path, Group, Rule } of [
    { path: 'dhcpRules', Group: DHCPGroup, Rule: DHCPRule },
    { path: 'haproxyRules', Group: HAProxyGroup, Rule: HAProxyRule },
    { path: 'keepalivedRules', Group: KeepalivedGroup, Rule: KeepalivedRule },
  ]) {
    it(`creates ungrouped ${path} before, between, and after groups`, async () => {
      await testSuite.resetDatabaseData();
      const user = await createUser({ role: 1 });
      const cookie = attachSession(generateSession(user));
      const { fwcloud, firewall } = await new FwCloudFactory().make();
      const manager = db.getSource().manager;
      const groups = await manager.save(Group, [
        { name: 'first', firewallId: firewall.id },
        { name: 'last', firewallId: firewall.id },
      ]);
      const rules = await manager.save(
        Rule,
        [1, 2, 2, 3].map((rule_order, index) => ({
          firewallId: firewall.id,
          groupId: groups[index < 2 ? 0 : 1].id,
          rule_order,
          rule_type: 1,
        })),
      );

      const create = (to: number, offset: Offset) =>
        request(testSuite.app.express)
          .post(`/fwclouds/${fwcloud.id}/firewalls/${firewall.id}/system/${path}`)
          .set('Cookie', [cookie])
          .send({ idgroup: null, to, offset, rule_type: 1 });

      await create(rules[0].id, Offset.Below).expect(422);
      const before = await create(rules[0].id, Offset.Above).expect(201);
      const between = await create(rules[1].id, Offset.Below).expect(201);
      const after = await create(rules[3].id, Offset.Below).expect(201);

      const reloaded = await manager.find(Rule, {
        where: { firewallId: firewall.id },
        order: { rule_order: 'ASC', id: 'ASC' },
      });
      expect(reloaded.map(({ id, groupId }) => [id, groupId])).to.deep.equal([
        [before.body.data.id, null],
        [rules[0].id, groups[0].id],
        [rules[1].id, groups[0].id],
        [between.body.data.id, null],
        [rules[2].id, groups[1].id],
        [rules[3].id, groups[1].id],
        [after.body.data.id, null],
      ]);
    });
  }
});
