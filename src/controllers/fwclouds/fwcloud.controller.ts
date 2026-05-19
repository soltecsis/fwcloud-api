/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Controller } from '../../fonaments/http/controller';
import { Request as ExpressRequest } from 'express';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { FwCloudService } from '../../models/fwcloud/fwcloud.service';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { colorUsage } from '../../models/fwcloud/FwCloud-colors';
import { Validate } from '../../decorators/validate.decorator';
import { FwCloudPolicy } from '../../policies/fwcloud.policy';
import { FwCloudControllerStoreDto } from './dtos/store.dto';
import { FwCloudControllerUpdateDto } from './dtos/update.dto';
import {
  Body,
  Example,
  Get,
  OperationId,
  Path,
  Post,
  Put,
  Request,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';

const fwcError = require('../../utils/error_table');

interface FwCloudLimitErrorResponse {
  fwcErr?: number;
  msg?: string;
}

interface FwCloudNotFoundResponse {
  message: string;
}

interface FwCloudDataResponse {
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

interface FwCloudColorsResponse {
  color: string;
  count: number;
}

interface FwCloudConfigDataResponse {
  availablecommunications: string[];
  auditLogs: {
    internal: {
      enabled: boolean;
      cron: {
        enabled: boolean;
      };
      worker: {
        enabled: boolean;
      };
      importer: {
        enabled: boolean;
      };
    };
  };
}

interface FwCloudApiEnvelopeResponse<TData> {
  status: number;
  response: string;
  message: string;
  data: TData;
}

@Route('')
@Tags('fwclouds')
@Security('sessionCookie')
export class FwCloudController extends Controller {
  protected _fwCloudService: FwCloudService;

  public async make(request: ExpressRequest): Promise<void> {
    this._fwCloudService = await this._app.getService<FwCloudService>(FwCloudService.name);
  }

  /**
   * Create a new FWCloud.
   * @example requestBody { "name": "FWCloud-01", "image": "", "comment": "Main customer cloud" }
   */
  @OperationId('New FwCloud.')
  @Post('fwclouds')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('201', 'Created')
  @Example<FwCloudApiEnvelopeResponse<FwCloudDataResponse>>({
    status: 201,
    response: 'Created',
    message: '',
    data: {
      id: 1,
      name: 'FWCloud-01',
      created_at: '2019-05-14T11:37:19.000Z',
      updated_at: '2019-05-14T11:37:19.000Z',
      created_by: 0,
      updated_by: 0,
      locked_at: null,
      locked_by: null,
      locked: 0,
      image: '',
      comment: 'Main customer cloud',
    },
  })
  @Response<FwCloudLimitErrorResponse>(403, 'FWCloud limit reached', {
    fwcErr: 7000,
    msg: 'FWCloud limit reached',
  })
  @Validate(FwCloudControllerStoreDto)
  public async store(
    @Request() request: ExpressRequest,
    @Body() requestBody: FwCloudControllerStoreDto,
  ): Promise<ResponseBuilder> {
    let errorLimit: boolean = false;

    (await FwCloudPolicy.store(request.session.user)).authorize();

    await FwCloud.getFwclouds(request.dbCon, request.session.user_id).then((result: FwCloud[]) => {
      errorLimit =
        this._app.config.get('limits').fwclouds > 0 &&
        result.length >= this._app.config.get('limits').fwclouds;
    });

    if (errorLimit) {
      return ResponseBuilder.buildResponse().status(403).body(fwcError.LIMIT_FWCLOUDS);
    } else {
      const fwCloud: FwCloud = await this._fwCloudService.store({
        name: request.body.name,
        image: request.body.image,
        comment: request.body.comment,
      });

      return ResponseBuilder.buildResponse().status(201).body(fwCloud);
    }
  }

  /**
   * Update an existing FWCloud.
   * @example requestBody { "name": "FWCloud-01-Updated", "image": "", "comment": "Updated description" }
   */
  @OperationId('Update FwCloud.')
  @Put('fwclouds/{fwcloud}')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('200', 'Updated')
  @Example<FwCloudApiEnvelopeResponse<FwCloudDataResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      id: 1,
      name: 'FWCloud-01-Updated',
      created_at: '2019-05-14T11:37:19.000Z',
      updated_at: '2019-05-14T11:57:06.000Z',
      created_by: 0,
      updated_by: 0,
      locked_at: null,
      locked_by: null,
      locked: 0,
      image: '',
      comment: 'Updated description',
    },
  })
  @Response<FwCloudNotFoundResponse>(404, 'FWCloud not found', {
    message: 'FWCloud not found',
  })
  @Validate(FwCloudControllerUpdateDto)
  public async update(
    @Request() request: ExpressRequest,
    @Body() requestBody: FwCloudControllerUpdateDto,
    @Path() fwcloud: number,
  ): Promise<ResponseBuilder> {
    (await FwCloudPolicy.update(request.session.user)).authorize();

    let fwCloud: FwCloud = await FwCloud.findOneOrFail({
      where: { id: parseInt(String(request.params.fwcloud)) },
    });

    fwCloud = await this._fwCloudService.update(fwCloud, {
      name: request.body.name,
      image: request.body.image,
      comment: request.body.comment,
    });

    return ResponseBuilder.buildResponse().status(200).body(fwCloud);
  }

  /**
   * Get FWCloud color usage details.
   */
  @OperationId('Get FwCloud Colors.')
  @Get('fwclouds/{fwcloud}/colors')
  @SuccessResponse('200', 'Color usage')
  @Example<FwCloudApiEnvelopeResponse<FwCloudColorsResponse[]>>({
    status: 200,
    response: 'OK',
    message: '',
    data: [
      { color: '#4CAF50', count: 14 },
      { color: '#2196F3', count: 6 },
      { color: '#FF9800', count: 2 },
    ],
  })
  @Response<FwCloudNotFoundResponse>(404, 'FWCloud not found', {
    message: 'FWCloud not found',
  })
  @Validate()
  public async colors(
    @Request() request: ExpressRequest,
    @Path() fwcloud: number,
  ): Promise<ResponseBuilder> {
    const fwCloud: FwCloud = await FwCloud.findOneOrFail({
      where: { id: parseInt(String(request.params.fwcloud)) },
    });

    (await FwCloudPolicy.colors(request.session.user, fwCloud)).authorize();

    const colors: colorUsage[] = await this._fwCloudService.colors(fwCloud);

    return ResponseBuilder.buildResponse().status(200).body(colors);
  }

  /**
   * Get global FWCloud-related configuration.
   */
  @OperationId('Get FwCloud Config.')
  @Get('config')
  @SuccessResponse('200', 'Configuration')
  @Example<FwCloudApiEnvelopeResponse<FwCloudConfigDataResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      availablecommunications: ['agent', 'ssh'],
      auditLogs: {
        internal: {
          enabled: true,
          cron: { enabled: true },
          worker: { enabled: true },
          importer: { enabled: true },
        },
      },
    },
  })
  @Validate()
  public async getConfig(): Promise<ResponseBuilder> {
    let availablecommunications: string[] = ['agent'];

    if (this._app.config.get('firewall_communication').ssh_enable) {
      availablecommunications = ['agent', 'ssh'];
    }

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        availablecommunications,
        auditLogs: {
          internal: {
            enabled: this._app.config.get('auditLogs.internal.enabled'),
            cron: {
              enabled: this._app.config.get('auditLogs.internal.cron.enabled'),
            },
            worker: {
              enabled: this._app.config.get('auditLogs.internal.worker.enabled'),
            },
            importer: {
              enabled: this._app.config.get('auditLogs.internal.importer.enabled'),
            },
          },
        },
      });
  }
}
