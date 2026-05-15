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

import { Body, Example, Post, Put, Response, Route, SuccessResponse, Tags } from 'tsoa';

interface LegacyCustomerErrorResponse {
  fwcErr?: number;
  msg?: string;
}

interface LegacyCustomerUpsertRequest {
  customer: number;
  name: string;
  addr: string;
  phone: string;
  email: string;
  web: string;
}

interface LegacyCustomerRequest {
  customer: number;
}

interface LegacyCustomerResponse {
  id: number;
  name: string;
  addr: string;
  phone: string;
  email: string;
  web: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}

interface LegacyCustomerSummary {
  id: number;
  name: string;
}

interface LegacyCustomerRestrictionResponse {
  result: boolean;
  restrictions: Record<string, boolean>;
}

type LegacyCustomerGetResponse = LegacyCustomerResponse | LegacyCustomerSummary[];

@Route('customer')
@Tags('customer')
export class CustomerLegacyController {
  /**
   * Create new customer. Customers allow group users.
   * @summary New customer.
   * @example requestBody { "customer": 1, "name": "FWCloud.net", "addr": "C/Carrasca, 7 - 03590 Altea (Alicante) - Spain", "phone": "+34 966 446 046", "email": "info@fwcloud.net", "web": "https://fwcloud.net" }
   */
  @Post('/')
  @SuccessResponse('204', 'New customer')
  @Response<LegacyCustomerErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 1004,
    msg: 'Already exists with the same id',
  })
  @Response<LegacyCustomerErrorResponse>('default', 'Legacy endpoint error', {
    fwcErr: 1005,
    msg: 'Already exists with the same name',
  })
  public async store(@Body() requestBody?: LegacyCustomerUpsertRequest): Promise<void> {
    return;
  }

  /**
   * Update customer's information.
   * @summary Update customer.
   * @example requestBody { "customer": 2, "name": "FWCloud.net", "addr": "C/Carrasca, 7 - 03590 Altea (Alicante) - Spain", "phone": "+34 966 446 046", "email": "info@fwcloud.net", "web": "https://www.fwcloud.net" }
   */
  @Put('/')
  @SuccessResponse('204', 'Update customer')
  @Response<LegacyCustomerErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 1002,
    msg: 'Not found',
  })
  @Response<LegacyCustomerErrorResponse>('default', 'Legacy endpoint error', {
    fwcErr: 1005,
    msg: 'Already exists with the same name',
  })
  public async update(@Body() requestBody?: LegacyCustomerUpsertRequest): Promise<void> {
    return;
  }

  /**
   * Get customer data. If `customer` is empty, returns all customers with id and name.
   * @summary Get customer data.
   * @example requestBody { "customer": 2 }
   */
  @Put('get')
  @SuccessResponse('200', 'Get customer data')
  @Example<LegacyCustomerResponse>({
    id: 2,
    name: 'FWCloud.net',
    addr: 'C/Carrasca, 7 - 03590 Altea (Alicante) - Spain',
    phone: '+34 966 446 046',
    email: 'info@fwcloud.net',
    web: 'https://fwcloud.net',
    created_at: '2019-05-13T10:40:36.000Z',
    updated_at: '2019-05-13T10:40:36.000Z',
    created_by: 0,
    updated_by: 0,
  })
  @Response<LegacyCustomerSummary[]>(200, 'Get all customers example', [
    {
      id: 1,
      name: 'SOLTECSIS, S.L.',
    },
    {
      id: 2,
      name: 'FWCloud.net',
    },
  ])
  @Response<LegacyCustomerErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 1002,
    msg: 'Not found',
  })
  public async get(
    @Body() requestBody?: LegacyCustomerRequest,
  ): Promise<LegacyCustomerGetResponse> {
    return {
      id: 2,
      name: 'FWCloud.net',
      addr: 'C/Carrasca, 7 - 03590 Altea (Alicante) - Spain',
      phone: '+34 966 446 046',
      email: 'info@fwcloud.net',
      web: 'https://fwcloud.net',
      created_at: '2019-05-13T10:40:36.000Z',
      updated_at: '2019-05-13T10:40:36.000Z',
      created_by: 0,
      updated_by: 0,
    };
  }

  /**
   * Delete customer from the database.
   * @summary Delete customer.
   * @example requestBody { "customer": 1 }
   */
  @Put('del')
  @SuccessResponse('204', 'Delete customer')
  @Response<LegacyCustomerErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 1002,
    msg: 'Not found',
  })
  @Response<LegacyCustomerRestrictionResponse>(403, 'Legacy endpoint restriction', {
    result: true,
    restrictions: {
      CustomerHasUsers: true,
    },
  })
  public async delete(@Body() requestBody?: LegacyCustomerRequest): Promise<void> {
    return;
  }

  /**
   * Check that there are no restrictions for customer deletion.
   * @summary Restrictions for customer deletion.
   * @example requestBody { "customer": 10 }
   */
  @Put('restricted')
  @SuccessResponse('204', 'No deletion restrictions')
  @Response<LegacyCustomerRestrictionResponse>(403, 'Legacy endpoint restriction', {
    result: true,
    restrictions: {
      CustomerHasUsers: true,
    },
  })
  public async restricted(@Body() requestBody?: LegacyCustomerRequest): Promise<void> {
    return;
  }
}
