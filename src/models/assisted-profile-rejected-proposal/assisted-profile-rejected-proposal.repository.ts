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

import { DataSource, In, LessThanOrEqual } from 'typeorm';
import type { AbstractApplication } from '../../fonaments/abstract-application';
import { DatabaseService } from '../../database/database.service';
import { AssistedProfileRejectedProposal } from './assisted-profile-rejected-proposal.model';
import type { AssistedProfileRejectionCategory } from './assisted-profile-rejected-proposal.types';

/**
 * Everything the persistence layer accepts. There is no field for the original
 * proposal, by design: the raw rejected payload must be unreachable from here,
 * so an accidental `save({ rawProposal, anonymizedProposal })` cannot even be
 * expressed.
 */
export interface PersistRejectedProposalInput {
  readonly rejectionCategory: AssistedProfileRejectionCategory;
  readonly rejectionCode: string | null;
  readonly contractVersion: string | null;
  readonly anonymizedProposal: unknown;
  readonly anonymizationVersion: string;
  readonly proposalFingerprint: string | null;
  readonly requestId: string | null;
  readonly capturedAt: Date;
  readonly expiresAt: Date;
}

export interface ExpiredRejectedProposalRef {
  readonly id: number;
}

/**
 * Internal persistence abstraction for the rejected-proposal corpus. It is
 * deliberately not exposed through any HTTP route: extraction for evaluation
 * has to be designed separately, with its own authorization and privacy
 * controls.
 */
export interface AssistedProfileRejectedProposalRepository {
  persist(input: PersistRejectedProposalInput): Promise<AssistedProfileRejectedProposal>;
  /** Records whose `expires_at` is at or before `now`, bounded by `limit`. */
  findExpired(now: Date, limit: number): Promise<ExpiredRejectedProposalRef[]>;
  /** Physical delete. Returns how many rows were actually removed. */
  deleteByIds(ids: readonly number[]): Promise<number>;
}

/** TypeORM-backed implementation used everywhere outside tests. */
export class TypeOrmAssistedProfileRejectedProposalRepository implements AssistedProfileRejectedProposalRepository {
  constructor(private readonly _dataSource: DataSource) {}

  public async persist(
    input: PersistRejectedProposalInput,
  ): Promise<AssistedProfileRejectedProposal> {
    const repository = this._dataSource.getRepository(AssistedProfileRejectedProposal);
    return repository.save(repository.create({ ...input }));
  }

  public async findExpired(now: Date, limit: number): Promise<ExpiredRejectedProposalRef[]> {
    return this._dataSource.getRepository(AssistedProfileRejectedProposal).find({
      select: { id: true },
      // `expired when now >= expires_at`: the single definition of expiry.
      where: { expiresAt: LessThanOrEqual(now) },
      order: { expiresAt: 'ASC' },
      take: limit,
    });
  }

  public async deleteByIds(ids: readonly number[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this._dataSource
      .getRepository(AssistedProfileRejectedProposal)
      .delete({ id: In([...ids]) });

    return result.affected ?? 0;
  }
}

/**
 * Resolves the application-wired repository. Shared by the capture service and
 * the retention job, which are the only two consumers and both reach it the
 * same way.
 */
export async function resolveAssistedProfileRejectedProposalRepository(
  app: AbstractApplication,
): Promise<AssistedProfileRejectedProposalRepository> {
  const databaseService = await app.getService<DatabaseService>(DatabaseService.name);
  return new TypeOrmAssistedProfileRejectedProposalRepository(databaseService.dataSource);
}
