import type { EntityManager } from 'typeorm';
import { format, type SqlValue } from 'mysql2';
import db from '../../database/database-manager';
import {
  Firewall,
  FirewallInstallCommunication,
  FirewallPluginMask,
  FireWallOptMask,
} from '../firewall/Firewall';
import { PolicyRule } from '../policy/PolicyRule';
import type { PolicyReplicationRequest } from './policy-replication.types';
import { asReplicationProfileRecord } from './replication-profile.constants';
import type {
  ReplicationProfileFirewallMasks,
  ReplicationProfileFirewallSettings,
} from './replication-profile-firewall-settings';
import type { ReplicationProfileModel } from './replication-profile-template';

const OPTIONS_MASK = Object.values(FireWallOptMask).reduce(
  (mask: number, flag) => (typeof flag === 'number' ? mask | flag : mask),
  Firewall.COMPILER_OPTIONS_MASK,
);
const PLUGIN_FLAGS = Object.entries(FirewallPluginMask);
const PLUGINS_MASK = PLUGIN_FLAGS.reduce((mask, [, flag]) => mask | flag, 0);

interface FirewallSettingsRow {
  id: number;
  options: number;
  plugins: number;
  fwmaster: number;
  install_communication: FirewallInstallCommunication;
}

interface FirewallSettingsPlan {
  settings: ReplicationProfileFirewallSettings;
  errors: string[];
  warnings: string[];
  changes: FirewallOptionsChange[];
  rollback?: (errors: string[]) => Promise<void>;
}

interface FirewallOptionsChange {
  id: number;
  previous: number;
  options: number;
  ownsPolicy: boolean;
}

/**
 * Use the same checks during preview and application. Plugin flags describe destination
 * installation state. A template can require those flags, but cannot install or remove software.
 */
export async function planFirewallSettings(
  model: ReplicationProfileModel,
  { target, nodeRoleMapping = {} }: PolicyReplicationRequest,
  fwCloudId: number,
  transaction?: EntityManager,
): Promise<FirewallSettingsPlan | undefined> {
  if (model.firewallSettings === undefined) return;
  const { nodes, ...global } = model.firewallSettings;
  const plan: FirewallSettingsPlan = { settings: global, errors: [], warnings: [], changes: [] };
  const cluster = target.kind === 'cluster';
  const manager = transaction ?? db.getSource().manager;
  const lock = transaction ? ' FOR UPDATE' : '';
  const rows: FirewallSettingsRow[] = await manager.query(
    `SELECT id, options, plugins, fwmaster, install_communication FROM firewall
     WHERE fwcloud = ? AND ${cluster ? 'cluster = ?' : 'id = ? AND cluster IS NULL'}
     ORDER BY fwmaster DESC, id${lock}`,
    [fwCloudId, target.id],
  );
  const owner = rows[0];
  if (!owner || (cluster && owner.fwmaster !== 1)) {
    plan.errors.push(
      `Firewall settings: the target ${cluster ? 'cluster has no master firewall' : 'firewall is unavailable'}.`,
    );
    return plan;
  }

  if (!cluster) {
    if (Object.values(nodes ?? {}).some((node) => differsFrom(node, global))) {
      plan.warnings.push(
        'Template topology conversion: the standalone firewall will use the global settings. Distinct cluster node settings require a cluster target.',
      );
    }
    planFirewallOptions(owner, global.options, true, 'Target firewall', plan);
    validatePlugins(global.plugins, owner.plugins, 'Target firewall', plan.errors);
    return plan;
  }

  if (global.plugins !== undefined) {
    const [destination] = await manager.query(
      `SELECT plugins FROM cluster WHERE id = ? AND fwcloud = ?${lock}`,
      [target.id, fwCloudId],
    );
    if (!destination) {
      plan.errors.push('Firewall settings: the target cluster is unavailable.');
      return plan;
    }
    validatePlugins(global.plugins, destination.plugins, 'Target cluster', plan.errors);
  }

  // In FWCloud a cluster edit applies the global options to its nodes. Captured node
  // settings override those options. Cluster plugin metadata has its own scope.
  const defaultNodePlugins = nodes ? undefined : global.plugins;
  const assignments = nodes
    ? assignNodeSettings(
        nodes,
        rows,
        nodeRoleMapping,
        model.topologyPreset ?? model.topology_preset,
        plan.errors,
      )
    : undefined;
  const plannedNodes: [string, ReplicationProfileFirewallMasks][] = [];
  for (const row of rows) {
    const [role, masks] = assignments?.get(row.id) ?? [];
    const options = masks?.options ?? global.options;
    const plugins = masks?.plugins ?? defaultNodePlugins;
    const label = role === undefined ? `Target cluster node ${row.id}` : `Cluster node "${role}"`;
    const ownsPolicy = row.id === owner.id;
    if (ownsPolicy && options !== undefined && options !== global.options) {
      plan.settings.options = options;
      if (global.options !== undefined) {
        plan.warnings.push('The node assigned to the target master sets the cluster options.');
      }
    }
    planFirewallOptions(row, options, ownsPolicy, label, plan);
    validatePlugins(plugins, row.plugins, label, plan.errors);
    if (role !== undefined) {
      plannedNodes.push([
        role,
        {
          ...(options === undefined ? {} : { options }),
          ...(plugins === undefined ? {} : { plugins }),
        },
      ]);
    }
  }
  if (nodes) plan.settings.nodes = Object.fromEntries(plannedNodes);
  return plan;
}

function differsFrom(
  masks: ReplicationProfileFirewallMasks,
  base: ReplicationProfileFirewallMasks,
): boolean {
  return (
    (masks.options !== undefined && masks.options !== base.options) ||
    (masks.plugins !== undefined && masks.plugins !== base.plugins)
  );
}

function assignNodeSettings(
  nodes: Record<string, ReplicationProfileFirewallMasks>,
  rows: FirewallSettingsRow[],
  mapping: Record<string, number>,
  topology: unknown,
  errors: string[],
): Map<number, [string, ReplicationProfileFirewallMasks]> {
  const topologyNodes = asReplicationProfileRecord(topology)?.nodes;
  const order = new Map<string, number>();
  if (Array.isArray(topologyNodes)) {
    topologyNodes.forEach((node, index) => {
      const definition = asReplicationProfileRecord(node);
      const role = definition?.role ?? definition?.name ?? node;
      if (typeof role === 'string') order.set(role, definition?.master === true ? -1 : index);
    });
  }
  const entries = Object.entries(nodes).sort(
    ([a], [b]) =>
      (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity) ||
      a.localeCompare(b, 'en', { numeric: true }),
  );
  const targetIds = new Set(rows.map(({ id }) => id));
  const assignments = new Map<number, [string, ReplicationProfileFirewallMasks]>();
  const unassigned: typeof entries = [];
  for (const entry of entries) {
    const [role, masks] = entry;
    const id = Object.prototype.hasOwnProperty.call(mapping, role) ? mapping[role] : undefined;
    if (id === undefined) {
      unassigned.push(entry);
      continue;
    }
    const assigned = assignments.get(id)?.[1];
    if (
      !targetIds.has(id) ||
      (assigned && (masks.options !== assigned.options || masks.plugins !== assigned.plugins))
    ) {
      errors.push(
        `Firewall settings for cluster node "${role}" require a distinct node of the target cluster.`,
      );
    } else if (assigned) {
      unassigned.push(entry);
    } else {
      assignments.set(id, entry);
    }
  }
  // By default use the same order as capture, with the master first.
  const reserved = new Set(Object.values(mapping));
  const available = rows.filter(({ id }) => !reserved.has(id));
  for (const [index, entry] of unassigned.entries()) {
    const row = available[index];
    if (row) assignments.set(row.id, entry);
    else if (differsFrom(entry[1], entries[0][1])) {
      errors.push(`Firewall settings for cluster node "${entry[0]}" require another target node.`);
    }
  }
  return assignments;
}

function planFirewallOptions(
  row: FirewallSettingsRow,
  options: number | undefined,
  ownsPolicy: boolean,
  label: string,
  plan: FirewallSettingsPlan,
): void {
  if (options === undefined) return;
  const unknown = options & ~OPTIONS_MASK;
  if (unknown) plan.errors.push(`${label}: unsupported firewall options ${hex(unknown)}.`);
  const compiler = Firewall.getCompilerFromOptions(options);
  if (!compiler) {
    plan.errors.push(
      `${label}: unsupported firewall compiler ${hex(options & Firewall.COMPILER_OPTIONS_MASK)}.`,
    );
  } else if (compiler === 'VyOS') {
    if (row.install_communication !== FirewallInstallCommunication.SSH) {
      plan.errors.push(`${label}: the VyOS firewall compiler requires SSH communication.`);
    }
    if (Firewall.getPolicyCompilationModeFromOptions(options) === 'optimized') {
      plan.errors.push(
        `${label}: the VyOS firewall compiler does not support optimized compilation.`,
      );
    }
  }
  if (row.options !== options) {
    plan.changes.push({ id: row.id, previous: row.options, options, ownsPolicy });
  }
}

function validatePlugins(
  desired: number | undefined,
  current: number,
  label: string,
  errors: string[],
): void {
  if (desired === undefined) return;
  const unknown = desired & ~PLUGINS_MASK;
  if (unknown) errors.push(`${label}: unsupported plugin flags ${hex(unknown)}.`);
  const different = desired ^ current;
  for (const [name, flag] of PLUGIN_FLAGS) {
    if ((different & flag) === 0) continue;
    errors.push(
      desired & flag
        ? `${label}: plugin "${name}" is unavailable or disabled on the destination.`
        : `${label}: plugin "${name}" must be disabled on the destination to match the template.`,
    );
  }
  const extraUnknown = current & ~desired & ~PLUGINS_MASK;
  if (extraUnknown)
    errors.push(`${label}: the destination has unmatched plugin flags ${hex(extraUnknown)}.`);
}

function hex(mask: number): string {
  return `0x${(mask >>> 0).toString(16)}`;
}

/** Apply global options before replicating policy, with compensation if policy application fails. */
export async function applyFirewallSettings(
  model: ReplicationProfileModel,
  request: PolicyReplicationRequest,
  fwCloudId: number,
): Promise<FirewallSettingsPlan | undefined> {
  const source = db.getSource();
  return source.transaction(async (manager) => {
    const plan = await planFirewallSettings(model, request, fwCloudId, manager);
    if (!plan || plan.errors.length || plan.changes.length === 0) return plan;
    const { changes } = plan;
    const { target } = request;
    const clusterId = target.kind === 'cluster' ? target.id : null;

    // The row locks keep the destination settings stable through the option and special-rule writes.
    await writeFirewallOptions(manager, fwCloudId, clusterId, changes);
    plan.rollback = async (errors) => {
      try {
        await source.transaction((manager) =>
          writeFirewallOptions(manager, fwCloudId, clusterId, changes, errors),
        );
      } catch (error) {
        errors.push(
          `Firewall settings rollback failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    };
    return plan;
  });
}

async function writeFirewallOptions(
  manager: EntityManager,
  fwCloudId: number,
  clusterId: number | null,
  changes: FirewallOptionsChange[],
  rollbackErrors?: string[],
): Promise<void> {
  type QueryCallback = (error: unknown, result?: unknown) => void;
  const connection = {
    query(sql: string, values: SqlValue | QueryCallback, callback?: QueryCallback) {
      const done = typeof values === 'function' ? values : callback;
      // The native method uses INSERT ... SET ?. TypeORM stringifies object parameters.
      manager.query(typeof values === 'function' ? sql : format(sql, [values], false)).then(
        (result) => done(null, result),
        (error) => done(error),
      );
    },
  };
  for (const { id, previous, options, ownsPolicy } of changes) {
    const [from, to] = rollbackErrors ? [options, previous] : [previous, options];
    const result = await manager.query(
      'UPDATE firewall SET options = ?, status = status | 3 WHERE id = ? AND fwcloud = ? AND cluster <=> ? AND options = ?',
      [to, id, fwCloudId, clusterId, from],
    );
    if (!result.affectedRows) {
      if (!rollbackErrors)
        throw new Error(`Firewall ${id} changed before its options could be applied.`);
      rollbackErrors.push(`Firewall ${id} changed before its options could be restored.`);
      continue;
    }
    if (ownsPolicy) await PolicyRule.checkFirewallOptionRules(connection, id, to);
  }
}
