/*!
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

import { Body, Example, Get, Put, Response, Route, SuccessResponse, Tags } from 'tsoa';

interface LegacyFwcloudErrorResponse {
  fwcErr?: number;
  msg?: string;
}

interface LegacyFwcloudRequest {
  fwcloud: number;
}

interface LegacyFwcloudResponse {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
  locked_at: string | null;
  locked_by: number | null;
  locked: number;
  image: string;
  comment: string;
}

interface LegacyFwcloudLockInfo {
  locked_by: number;
  ip_user: string;
  ip_name: string;
  locked_at: string;
}

interface LegacyFwcloudLockResponse {
  result: boolean;
  message: string;
  info?: LegacyFwcloudLockInfo;
}

@Route('fwcloud')
@Tags('fwcloud')
export class FwcloudLegacyController {
  /**
   * Get fwcloud data for all the fwclouds to which the logged user has access.
   * @summary Get allowed fwclouds.
   */
  @Get('all/get')
  @SuccessResponse('200', 'Get allowed fwclouds')
  @Example<LegacyFwcloudResponse[]>([
    {
      id: 4,
      name: 'FWCloud-02',
      created_at: '2019-05-14T11:37:19.000Z',
      updated_at: '2019-05-14T11:37:19.000Z',
      created_by: 0,
      updated_by: 0,
      locked_at: null,
      locked_by: null,
      locked: 0,
      image: '',
      comment: '',
    },
    {
      id: 5,
      name: 'FWCloud-03',
      created_at: '2019-05-14T11:37:24.000Z',
      updated_at: '2019-05-14T11:57:06.000Z',
      created_by: 0,
      updated_by: 0,
      locked_at: '2019-05-14T11:57:06.000Z',
      locked_by: 1,
      locked: 1,
      image: '',
      comment: '',
    },
  ])
  @Response<void>(204, 'No allowed fwclouds')
  @Response<LegacyFwcloudErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7000,
    msg: 'FWCloud access not allowed',
  })
  public async getAllowed(): Promise<LegacyFwcloudResponse[]> {
    return [
      {
        id: 4,
        name: 'FWCloud-02',
        created_at: '2019-05-14T11:37:19.000Z',
        updated_at: '2019-05-14T11:37:19.000Z',
        created_by: 0,
        updated_by: 0,
        locked_at: null,
        locked_by: null,
        locked: 0,
        image: '',
        comment: '',
      },
      {
        id: 5,
        name: 'FWCloud-03',
        created_at: '2019-05-14T11:37:24.000Z',
        updated_at: '2019-05-14T11:57:06.000Z',
        created_by: 0,
        updated_by: 0,
        locked_at: '2019-05-14T11:57:06.000Z',
        locked_by: 1,
        locked: 1,
        image: '',
        comment: '',
      },
    ];
  }

  /**
   * Get fwcloud data.
   * @summary Get fwcloud data.
   * @example requestBody { "fwcloud": 3 }
   */
  @Put('get')
  @SuccessResponse('200', 'Get fwcloud data')
  @Example<LegacyFwcloudResponse>({
    id: 3,
    name: 'FWCloud-Updated',
    created_at: '2019-05-14T11:37:15.000Z',
    updated_at: '2019-05-14T11:37:54.000Z',
    created_by: 0,
    updated_by: 0,
    locked_at: '2019-05-14T11:37:51.000Z',
    locked_by: 1,
    locked: 1,
    image: '',
    comment: 'Comment for the updated fwcloud.',
  })
  @Response<LegacyFwcloudErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7000,
    msg: 'FWCloud access not allowed',
  })
  public async get(@Body() requestBody?: LegacyFwcloudRequest): Promise<LegacyFwcloudResponse> {
    return {
      id: 3,
      name: 'FWCloud-Updated',
      created_at: '2019-05-14T11:37:15.000Z',
      updated_at: '2019-05-14T11:37:54.000Z',
      created_by: 0,
      updated_by: 0,
      locked_at: '2019-05-14T11:37:51.000Z',
      locked_by: 1,
      locked: 1,
      image: '',
      comment: 'Comment for the updated fwcloud.',
    };
  }

  /**
   * Check if the fwcloud indicated as a parameter has any deletion restriction.
   * @summary Check delete restrictions.
   * @example requestBody { "fwcloud": 2 }
   */
  @Put('restricted')
  @SuccessResponse('204', 'No deletion restrictions')
  @Response<LegacyFwcloudErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7000,
    msg: 'FWCloud access not allowed',
  })
  public async restricted(@Body() requestBody?: LegacyFwcloudRequest): Promise<void> {
    return;
  }

  /**
   * Delete the firewall cloud indicated in the request body.
   * @summary Delete fwcloud.
   * @example requestBody { "fwcloud": 2 }
   */
  @Put('del')
  @SuccessResponse('204', 'Delete fwcloud')
  @Response<LegacyFwcloudErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7000,
    msg: 'FWCloud access not allowed',
  })
  public async delete(@Body() requestBody?: LegacyFwcloudRequest): Promise<void> {
    return;
  }

  /**
   * Lock fwcloud status.
   * @summary Lock fwcloud.
   * @example requestBody { "fwcloud": 2 }
   */
  @Put('lock')
  @SuccessResponse('200', 'Lock result')
  @Example<LegacyFwcloudLockResponse>({
    result: true,
    message: 'FWCLOUD LOCKED OK',
  })
  @Response<LegacyFwcloudLockResponse>(200, 'Lock denied example', {
    result: false,
    message: 'NOT ACCESS FOR LOCKING',
    info: {
      locked_by: 1,
      ip_user: '192.168.1.10',
      ip_name: 'fwcloud-ui.local',
      locked_at: '2019-05-14T11:57:06.000Z',
    },
  })
  public async lock(
    @Body() requestBody?: LegacyFwcloudRequest,
  ): Promise<LegacyFwcloudLockResponse> {
    return {
      result: true,
      message: 'FWCLOUD LOCKED OK',
    };
  }

  /**
   * Unlock fwcloud status.
   * @summary Unlock fwcloud.
   * @example requestBody { "fwcloud": 2 }
   */
  @Put('unlock')
  @SuccessResponse('200', 'Unlock result')
  @Example<LegacyFwcloudLockResponse>({
    result: true,
    message: 'FWCLOUD UNLOCKED OK',
  })
  @Response<LegacyFwcloudLockResponse>(200, 'Unlock denied example', {
    result: false,
    message: 'NOT ACCESS FOR UNLOCKING',
  })
  public async unlock(
    @Body() requestBody?: LegacyFwcloudRequest,
  ): Promise<LegacyFwcloudLockResponse> {
    return {
      result: true,
      message: 'FWCLOUD UNLOCKED OK',
    };
  }

  /**
   * Force unlock fwcloud status.
   * @summary Force unlock fwcloud.
   * @example requestBody { "fwcloud": 2 }
   */
  @Put('forcelock')
  @SuccessResponse('200', 'Force unlock result')
  @Example<LegacyFwcloudLockResponse>({
    result: true,
    message: 'FWCLOUD FORCE UNLOCKED OK',
  })
  @Response<LegacyFwcloudLockResponse>(200, 'Force unlock denied example', {
    result: false,
    message: 'NOT ACCESS FOR FORCE UNLOCKING',
  })
  public async forceUnlock(
    @Body() requestBody?: LegacyFwcloudRequest,
  ): Promise<LegacyFwcloudLockResponse> {
    return {
      result: true,
      message: 'FWCLOUD FORCE UNLOCKED OK',
    };
  }
}
