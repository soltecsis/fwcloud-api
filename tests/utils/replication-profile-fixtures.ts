import * as fs from 'fs';
import * as path from 'path';
import db from '../../src/database/database-manager';
import { Firewall, FireWallOptMask } from '../../src/models/firewall/Firewall';
import { Interface } from '../../src/models/interface/Interface';
import { IPObj } from '../../src/models/ipobj/IPObj';
import { PolicyRule } from '../../src/models/policy/PolicyRule';
import { ReplicationProfile } from '../../src/models/replication-profile/replication-profile.model';
import {
  buildReplicationProfileTemplatePath,
  getReplicationProfileTemplatesDirectory,
  resolveReplicationProfileTemplatePath,
  writeReplicationProfileModel,
  type ReplicationProfileModel,
  type ReplicationProfileTemplateReference,
} from '../../src/models/replication-profile/replication-profile-template';
import StringHelper from '../../src/utils/string.helper';
import { FwCloudProduct } from './fwcloud-factory';

export interface ReplicationTargetSide {
  firewall: Firewall;
  wanInterface: Interface;
  lanInterface: Interface;
  wanAddress: IPObj;
}

export type ReplicationProfileFixture = Partial<Omit<ReplicationProfile, 'path'>> & {
  code: string;
  model?: ReplicationProfileModel;
};

/** The seeded administrator owns the custom fixtures that are not given an owner. */
const DEFAULT_FIXTURE_OWNER_ID = 1;

/**
 * Where makeReplicationProfileFixture() keeps the template of a profile.
 * Profiles without an owner keep theirs among the custom templates as well,
 * so fixtures never write into the version-controlled config/templates.
 */
export function replicationProfileFixtureTemplate({
  code,
  version = 1,
  userId = DEFAULT_FIXTURE_OWNER_ID,
  targetKind = 'firewall',
}: {
  code: string;
  version?: number;
  userId?: number | null;
  targetKind?: string;
}): ReplicationProfileTemplateReference {
  const templatePath = buildReplicationProfileTemplatePath({ code, version, userId });

  return {
    code,
    version,
    targetKind,
    path: typeof userId === 'number' ? templatePath : `custom/fixtures/${templatePath}`,
  };
}

/** Builds (without saving) an active custom profile and writes its template. */
export function makeReplicationProfileFixture({
  model = { replicate: {}, options: {} },
  ...fields
}: ReplicationProfileFixture): ReplicationProfile {
  const profile = db
    .getSource()
    .manager.getRepository(ReplicationProfile)
    .create({
      version: 1,
      name: 'Test replication profile',
      description: null,
      scope: 'generic',
      targetKind: 'firewall',
      isBuiltin: false,
      isActive: true,
      isDeprecated: false,
      userId: fields.isBuiltin ? null : DEFAULT_FIXTURE_OWNER_ID,
      ...fields,
    });

  profile.path = replicationProfileFixtureTemplate(profile).path;
  writeReplicationProfileModel(profile, model);

  return profile;
}

export function templateExists(profile: ReplicationProfileTemplateReference): boolean {
  return fs.existsSync(resolveReplicationProfileTemplatePath(profile));
}

/** Puts raw content where a template is expected, skipping the writer checks. */
export function writeRawReplicationProfileTemplate(
  profile: ReplicationProfileTemplateReference,
  content: string,
): void {
  const file = resolveReplicationProfileTemplatePath(profile);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

/** A version-controlled template exactly as shipped, read without the loader checks. */
export function readVersionedReplicationProfileTemplate(
  templatePath: string,
): ReplicationProfileModel {
  return JSON.parse(
    fs.readFileSync(path.join(getReplicationProfileTemplatesDirectory(), templatePath), 'utf8'),
  );
}

export function makeCustomReplicationProfilePayload(
  codePrefix: string = '',
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: `${codePrefix}Basic LAN/WAN profile`,
    description: 'Creates WAN/LAN interfaces and allows LAN to WAN traffic.',
    targetKind: 'firewall',
    scope: 'generic',
    category: 'Custom',
    model: {
      compatibility: {
        target_kinds: ['firewall'],
      },
      uiDefaults: {
        targetKind: 'firewall',
        connectionType: 'agent',
      },
      provision: {
        interfaces: [
          { name: 'WAN', role: 'wan' },
          { name: 'LAN', role: 'lan' },
        ],
        rules: [
          {
            chain: 'forward',
            action: 'accept',
            inRole: 'lan',
            outRole: 'wan',
            service: {
              protocol: 'tcp',
              port: 80,
            },
            comment: 'Allow LAN to WAN HTTP',
          },
        ],
      },
    },
    ...overrides,
  };
}

/**
 * Creates a standalone firewall inside the product FWCloud with wan/lan
 * interfaces, an optional wan interface address and the generated default
 * policy, ready to act as a policy replication target.
 */
export async function makeReplicationTargetFirewall(
  fwc: FwCloudProduct,
  withWanAddress: boolean = true,
): Promise<ReplicationTargetSide> {
  const manager = db.getSource().manager;

  const firewall = await manager.getRepository(Firewall).save({
    name: StringHelper.randomize(10),
    fwCloudId: fwc.fwcloud.id,
  });

  const wanInterface = await manager.getRepository(Interface).save({
    name: 'ens18',
    type: '10',
    interface_type: '10',
    firewallId: firewall.id,
  });

  const lanInterface = await manager.getRepository(Interface).save({
    name: 'ens19',
    type: '10',
    interface_type: '10',
    firewallId: firewall.id,
  });

  let wanAddress: IPObj = null;
  if (withWanAddress) {
    wanAddress = await manager.getRepository(IPObj).save({
      name: 'tgt-wan-addr',
      address: '203.0.113.10',
      ipObjTypeId: 5,
      ip_version: 4,
      interfaceId: wanInterface.id,
      fwCloudId: fwc.fwcloud.id,
    });
  }

  await PolicyRule.insertDefaultPolicy(firewall.id, null, FireWallOptMask.STATEFUL);

  return { firewall, wanInterface, lanInterface, wanAddress };
}
