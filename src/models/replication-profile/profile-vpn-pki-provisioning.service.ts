/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Ca } from '../vpn/pki/Ca';
import { Crt } from '../vpn/pki/Crt';
import { CaPrefix } from '../vpn/pki/CaPrefix';
import { Tree } from '../tree/Tree';
import { ProfileVpnRollback } from './profile-vpn-rollback';
import { queryRows } from './replication-sql.helpers';
import config from '../../config/config';
const utilsModel = require('../../utils/utils');

/** Template-only shapes; mirrors the UI's ProfileCertificateAuthority/ProfileCertificate. */
export interface ProfileVpnCaTemplate {
  id: string;
  name: string;
  commonName?: string;
  validityDays: number;
}

export interface ProfileVpnCertificateTemplate {
  id: string;
  name: string;
  caId: string;
  kind: 'server' | 'client';
  commonName?: string;
  validityDays: number;
}

/** Template id -> real database id, so VPN config creation and rule resolution can look them up. */
export interface ProvisionedVpnPki {
  caIds: Map<string, number>;
  certificateIds: Map<string, number>;
  rollback: ProfileVpnRollback;
}

/** Reserved caIds key for the auto-generated CA created by ensureWireGuardTechnicalCertificate(). */
const TECHNICAL_CA_KEY = '__wireguard_technical_ca__';

/**
 * Real CAs/certificates a VPN template describes have no keys of their own (the guarantee behind
 * "template only, no secrets"): applying the profile is the one place they get generated, using
 * the exact same model methods (and easy-rsa invocation) as the interactive PKI panel, so the
 * result is indistinguishable from one a user built by hand.
 */
export async function provisionVpnTemplatePki(
  dbCon: any,
  fwCloudId: number,
  cas: ProfileVpnCaTemplate[],
  certificates: ProfileVpnCertificateTemplate[],
  errors: string[],
  rollback = new ProfileVpnRollback(),
): Promise<ProvisionedVpnPki> {
  const caIds = new Map<string, number>();
  const certificateIds = new Map<string, number>();

  if (cas.length === 0 && certificates.length === 0) {
    return { caIds, certificateIds, rollback };
  }

  const pkiRootNodeId = await findPkiRootNodeId(dbCon, fwCloudId);

  if (pkiRootNodeId === null) {
    errors.push('VPN template: could not find this FWCloud\'s PKI tree root (node type "FCA").');
    return { caIds, certificateIds, rollback };
  }

  for (const ca of cas) {
    const cn = (ca.commonName || '').trim() || ca.name;

    try {
      const realCaId = await createOneCa(
        dbCon,
        fwCloudId,
        pkiRootNodeId,
        cn,
        ca.validityDays,
        `Replication profile: ${ca.name}`,
        rollback,
      );
      caIds.set(ca.id, realCaId);
    } catch (error) {
      errors.push(`VPN CA "${ca.name}": ${describeVpnProvisionError(error)}`);
    }
  }

  for (const cert of certificates) {
    const realCaId = caIds.get(cert.caId);

    if (realCaId === undefined) {
      errors.push(
        `VPN certificate "${cert.name}": its CA was not created, so the certificate was skipped.`,
      );
      continue;
    }

    const cn = (cert.commonName || '').trim() || cert.name;

    try {
      const id = await createOneCertificate(
        dbCon,
        fwCloudId,
        realCaId,
        cn,
        cert.validityDays,
        cert.kind,
        `Replication profile: ${cert.name}`,
        rollback,
      );
      certificateIds.set(cert.id, id);
    } catch (error) {
      errors.push(`VPN certificate "${cert.name}": ${describeVpnProvisionError(error)}`);
    }
  }

  return { caIds, certificateIds, rollback };
}

/**
 * WireGuard's own cryptography is an independent X25519 key pair it generates itself
 * (WireGuard.addCfg()); the certificate is only there to satisfy the `crt` foreign key every
 * OpenVPN/WireGuard/IPsec config row shares. A WireGuard connection may declare a certificateId in
 * the template, and then that one is used; this is only for the connections that do not. It
 * reuses the first CA the template already created, or lazily creates one dedicated technical CA
 * (cached in `pki.caIds` so every WireGuard connection in the same apply shares it) when the
 * template declares none.
 */
export async function ensureWireGuardTechnicalCertificate(
  dbCon: any,
  fwCloudId: number,
  pki: ProvisionedVpnPki,
  role: 'server' | 'client',
  cn: string,
  errors: string[],
): Promise<number | null> {
  try {
    const reusableCaId = [...pki.caIds.entries()].find(
      ([templateId]) => templateId !== TECHNICAL_CA_KEY,
    )?.[1];
    let realCaId = reusableCaId ?? pki.caIds.get(TECHNICAL_CA_KEY);

    if (realCaId === undefined) {
      const pkiRootNodeId = await findPkiRootNodeId(dbCon, fwCloudId);

      if (pkiRootNodeId === null) {
        errors.push(
          'WireGuard technical certificate: could not find this FWCloud\'s PKI tree root (node type "FCA").',
        );
        return null;
      }

      realCaId = await createOneCa(
        dbCon,
        fwCloudId,
        pkiRootNodeId,
        'WireGuard technical CA',
        3650,
        "Auto-generated by the replication profile engine: satisfies WireGuard configs' crt foreign key only.",
        pki.rollback,
      );
      pki.caIds.set(TECHNICAL_CA_KEY, realCaId);
    }

    return await createOneCertificate(
      dbCon,
      fwCloudId,
      realCaId,
      cn,
      3650,
      role,
      "Auto-generated by the replication profile engine: satisfies this WireGuard config's crt foreign key only.",
      pki.rollback,
    );
  } catch (error) {
    errors.push(`WireGuard technical certificate "${cn}": ${describeVpnProvisionError(error)}`);
    return null;
  }
}

async function createOneCa(
  dbCon: any,
  fwCloudId: number,
  pkiRootNodeId: number,
  cn: string,
  days: number,
  comment: string,
  rollback: ProfileVpnRollback,
): Promise<number> {
  const req: any = { body: { fwcloud: fwCloudId, cn, days, comment }, dbCon };

  req.caId = await Ca.createCA(req);
  // Register before EasyRSA: init-pki/build-ca/gen-dh can fail after the row or files exist.
  rollback.add(`CA ${req.caId}`, async () => {
    await Ca.deleteCA({ dbCon, body: { fwcloud: fwCloudId, ca: req.caId } });
    const cleanup = await Promise.allSettled([
      Tree.deleteObjFromTree(fwCloudId, req.caId, 300),
      utilsModel.deleteFolder(`${config.get('pki').data_dir}/${fwCloudId}/${req.caId}`),
    ]);
    const failure = cleanup.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  });
  await Ca.runEasyRsaCmd(req, 'init-pki');
  await Ca.runEasyRsaCmd(req, 'build-ca');
  await Ca.runEasyRsaCmd(req, 'gen-crl');
  // The interactive panel fires this in the background (it can take minutes); a profile
  // application is already an offline/batch operation, so awaiting it keeps the result complete
  // and avoids reporting success before the CA is actually usable.
  await Ca.runEasyRsaCmd(req, 'gen-dh');
  await Tree.newNode(dbCon, fwCloudId, cn, pkiRootNodeId, 'CA', req.caId, 300);

  return req.caId;
}

async function createOneCertificate(
  dbCon: any,
  fwCloudId: number,
  realCaId: number,
  cn: string,
  days: number,
  kind: 'server' | 'client',
  comment: string,
  rollback: ProfileVpnRollback,
): Promise<number> {
  if (await Crt.existsCRT(dbCon, realCaId, cn)) {
    throw new Error(`a certificate named "${cn}" already exists in that CA.`);
  }

  const req: any = {
    body: { fwcloud: fwCloudId, ca: realCaId, cn, days, type: kind === 'client' ? 1 : 2, comment },
    dbCon,
  };

  const id = (await Crt.createCRT(req)) as number;
  rollback.add(`certificate ${id}`, async () => {
    await Crt.deleteCRT({ dbCon, body: { fwcloud: fwCloudId, ca: realCaId, crt: id } });
    await Tree.deleteObjFromTree(fwCloudId, id, kind === 'client' ? 301 : 302);
    // Every CA used here belongs to this attempt; its rollback removes all PKI files together.
  });
  req.caId = realCaId;
  await Ca.runEasyRsaCmd(req, kind === 'client' ? 'build-client-full' : 'build-server-full');
  // Rebuilds this CA's certificate tree nodes (the panel calls this after every certificate too).
  await CaPrefix.applyCrtPrefixes(req, realCaId);

  return id;
}

export function describeVpnProvisionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    // Preserve the legacy fallback for non-JSON values, including circular objects.
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(error);
  }
}

/** Every FWCloud is seeded with exactly one top-level 'FCA' node (see Tree.ts) — CAs are created under it. */
async function findPkiRootNodeId(dbCon: any, fwCloudId: number): Promise<number | null> {
  const rows = await queryRows<{ id: number }>(
    dbCon,
    'SELECT id FROM fwc_tree WHERE fwcloud = ? AND node_type = ? LIMIT 1',
    [fwCloudId, 'FCA'],
  );
  return rows.length > 0 ? rows[0].id : null;
}
