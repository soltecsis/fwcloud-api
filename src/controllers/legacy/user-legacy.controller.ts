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

import {
  Body,
  Example,
  NoSecurity,
  Post,
  Put,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';

interface LegacyErrorResponse {
  fwcErr?: number;
  msg?: string;
}

interface LegacyLoginRequest {
  customer: number;
  username: string;
  password: string;
}

interface LegacyUserUpsertRequest {
  customer: number;
  name: string;
  email: string;
  username: string;
  password: string;
  enabled: number;
  role: number;
  allowed_from: string;
}

interface LegacyChangePasswordRequest {
  password: string;
}

interface LegacyUserGetRequest {
  customer: number;
  user: number;
}

interface LegacyUserDeleteRequest {
  customer: number;
}

interface LegacyUserRestrictedRequest {
  customer: number;
  user: number;
}

interface LegacyUserFwCloudAccessRequest {
  user: number;
  fwcloud: number;
}

interface LegacyUserFwCloudAccessListRequest {
  user: number;
}

interface LegacyLoginResponse {
  user: number;
  role: number;
}

interface LegacyUserCreatedResponse {
  user: number;
}

interface LegacyUserResponse {
  id: number;
  customer: number;
  name: string;
  email: string;
  username: string;
  password: string;
  enabled: number;
  role: number;
  allowed_from: string;
  last_login: string | null;
  confirmation_token: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}

interface LegacyRestrictionDetailsResponse {
  response: {
    respStatus: boolean;
    respCode: string;
    respCodeMsg: string;
    respMsg: string;
    errorCode: string;
    errorMsg: string;
  };
  data: Record<string, unknown>;
}

interface LegacyRestrictionDeniedResponse {
  result: boolean;
  restrictions: Record<string, boolean>;
}

interface LegacyFwCloudAccessItem {
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

@Route('user')
@Tags('user')
@Security('sessionCookie')
export class UserLegacyController {
  /**
   * Validate the user credentials and initialize data in the session file.
   * @summary Log into the API.
   * @example requestBody { "customer": 1, "username": "fwcadmin", "password": "fwcadmin" }
   */
  @Post('login')
  @NoSecurity()
  @SuccessResponse('200', 'Log into the API')
  @Example<LegacyLoginResponse>({ user: 1, role: 1 })
  @Response<LegacyErrorResponse>(401, 'Legacy endpoint error', {
    fwcErr: 1001,
    msg: 'Bad username or password',
  })
  public async login(@Body() requestBody?: LegacyLoginRequest): Promise<LegacyLoginResponse> {
    return {
      user: 1,
      role: 1,
    };
  }

  /**
   * Close a previous created user session.
   * @summary Log out the API.
   */
  @Post('logout')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('204', 'Log out the API')
  public async logout(): Promise<void> {
    return;
  }

  /**
   * Create new user.
   * @summary New user.
   * @example requestBody { "customer": 2, "name": "My Personal Name", "email": "info@fwcloud.net", "username": "fwcusr", "password": "mysecret", "enabled": 1, "role": 1, "allowed_from": "10.99.4.10,192.168.1.1" }
   */
  @Post('/')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('200', 'New user')
  @Example<LegacyUserCreatedResponse>({ user: 5 })
  @Response<LegacyErrorResponse>(400, 'Legacy endpoint error', { fwcErr: 1002, msg: 'Not found' })
  @Response<LegacyErrorResponse>('default', 'Legacy endpoint error', {
    fwcErr: 1003,
    msg: 'Already exists',
  })
  public async store(
    @Body() requestBody?: LegacyUserUpsertRequest,
  ): Promise<LegacyUserCreatedResponse> {
    return {
      user: 5,
    };
  }

  /**
   * Update user's data.
   * @summary Update user.
   * @example requestBody { "customer": 2, "name": "My Personal Name", "email": "info@fwcloud.net", "username": "fwcloud", "password": "mysecret", "enabled": 1, "role": 1, "allowed_from": "10.99.4.10,192.168.1.1" }
   */
  @Put('/')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('204', 'Update user')
  @Response<LegacyErrorResponse>(400, 'Legacy endpoint error', { fwcErr: 1002, msg: 'Not found' })
  public async update(@Body() requestBody?: LegacyUserUpsertRequest): Promise<void> {
    return;
  }

  /**
   * Modify the password of the logged user.
   * @summary Modify logged user password.
   * @example requestBody { "password": "mynewsecrec" }
   */
  @Put('changepass')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('204', 'Modify logged user password')
  @Response<LegacyErrorResponse>(400, 'Legacy endpoint error', { fwcErr: 1002, msg: 'Not found' })
  public async changePass(@Body() requestBody?: LegacyChangePasswordRequest): Promise<void> {
    return;
  }

  /**
   * Get user data.
   * @summary Get user data.
   * @example requestBody { "customer": 2, "user": 1 }
   */
  @Put('get')
  @SuccessResponse('200', 'Get user data')
  @Example<LegacyUserResponse>({
    id: 2,
    customer: 2,
    name: 'My Personal Name',
    email: 'info@fwcloud.net',
    username: 'fwcusr',
    password: 'mysecret',
    enabled: 1,
    role: 1,
    allowed_from: '10.99.4.10,192.168.1.1',
    last_login: null,
    confirmation_token: null,
    created_at: '2019-05-13T15:11:20.000Z',
    updated_at: '2019-05-13T15:11:20.000Z',
    created_by: 0,
    updated_by: 0,
  })
  @Response<LegacyErrorResponse>(400, 'Legacy endpoint error', { fwcErr: 1002, msg: 'Not found' })
  public async get(@Body() requestBody?: LegacyUserGetRequest): Promise<LegacyUserResponse> {
    return {
      id: 2,
      customer: 2,
      name: 'My Personal Name',
      email: 'info@fwcloud.net',
      username: 'fwcusr',
      password: 'mysecret',
      enabled: 1,
      role: 1,
      allowed_from: '10.99.4.10,192.168.1.1',
      last_login: null,
      confirmation_token: null,
      created_at: '2019-05-13T15:11:20.000Z',
      updated_at: '2019-05-13T15:11:20.000Z',
      created_by: 0,
      updated_by: 0,
    };
  }

  /**
   * Delete user from the database.
   * @summary Delete user.
   * @example requestBody { "customer": 2 }
   */
  @Put('del')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('204', 'Delete user')
  @Response<LegacyErrorResponse>(400, 'Legacy endpoint error', { fwcErr: 1002, msg: 'Not found' })
  public async delete(@Body() requestBody?: LegacyUserDeleteRequest): Promise<void> {
    return;
  }

  /**
   * Check that there are no restrictions for user deletion.
   * @summary Restrictions for user deletion.
   * @example requestBody { "customer": 10, "user": 5 }
   */
  @Put('restricted')
  @SuccessResponse('204', 'No deletion restrictions')
  @Response<LegacyRestrictionDetailsResponse>(200, 'Restriction details', {
    response: {
      respStatus: true,
      respCode: 'ACR_OK',
      respCodeMsg: 'Ok',
      respMsg: '',
      errorCode: '',
      errorMsg: '',
    },
    data: {},
  })
  @Response<LegacyRestrictionDeniedResponse>(403, 'Legacy endpoint error', {
    result: true,
    restrictions: {
      CustomerHasUsers: true,
    },
  })
  public async restricted(@Body() requestBody?: LegacyUserRestrictedRequest): Promise<void> {
    return;
  }

  /**
   * Allow a user the access to a fwcloud.
   * @summary Enable cloud access.
   * @example requestBody { "user": 5, "fwcloud": 2 }
   */
  @Post('fwcloud')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('204', 'Enable cloud access')
  public async enableFwCloudAccess(
    @Body() requestBody?: LegacyUserFwCloudAccessRequest,
  ): Promise<void> {
    return;
  }

  /**
   * Disable user access to a fwcloud.
   * @summary Disable cloud access.
   * @example requestBody { "user": 5, "fwcloud": 2 }
   */
  @Put('fwcloud/del')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('204', 'Disable cloud access')
  public async disableFwCloudAccess(
    @Body() requestBody?: LegacyUserFwCloudAccessRequest,
  ): Promise<void> {
    return;
  }

  /**
   * List of fwclouds to which the indicated user has access to.
   * @summary List of fwclouds with access.
   * @example requestBody { "user": 5 }
   */
  @Put('fwcloud/get')
  @SuccessResponse('200', 'List of fwclouds with access')
  @Example<LegacyFwCloudAccessItem[]>([
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
  public async listFwCloudAccess(
    @Body() requestBody?: LegacyUserFwCloudAccessListRequest,
  ): Promise<LegacyFwCloudAccessItem[]> {
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
}
