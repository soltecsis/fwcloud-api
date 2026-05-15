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

import { Body, Example, Post, Put, Response, Route, Security, SuccessResponse, Tags } from 'tsoa';

interface LegacyFirewallErrorResponse {
  fwcErr?: number;
  msg?: string;
}

interface LegacyFirewallStoreRequest {
  fwcloud: number;
  name: string;
  save_user_pass: number;
  install_port: number;
  fwmaster: number;
  options: number;
  node_id: number;
}

interface LegacyFirewallUpdateRequest {
  fwcloud: number;
  firewall: number;
  name: string;
  comment: string;
  save_user_pass: number;
  install_port: number;
  fwmaster: number;
  options: number;
}

interface LegacyFirewallCloudRequest {
  fwcloud: number;
}

interface LegacyFirewallGetRequest {
  fwcloud: number;
  firewall: number;
}

interface LegacyFirewallClusterRequest {
  fwcloud: number;
  cluster: number;
}

interface LegacyFirewallCloneRequest {
  fwcloud: number;
  firewall: number;
  name: string;
  comment: string;
  node_id: number;
}

interface LegacyFirewallInsertResponse {
  insertId: number;
}

interface LegacyFirewallResponse {
  id: number;
  cluster: number | null;
  fwcloud: number;
  name: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
  compiled_at: string | null;
  installed_at: string | null;
  by_user: number;
  status: number;
  install_user: string;
  install_pass: string;
  save_user_pass: number;
  install_interface: string | null;
  install_ipobj: string | null;
  fwmaster: number;
  install_port: number;
  options: number;
  interface_name: string | null;
  ip_name: string | null;
  ip: string | null;
  id_fwmaster: number | null;
}

@Route('firewall')
@Tags('firewall')
@Security('sessionCookie')
export class FirewallLegacyController {
  /**
   * Create a new firewall.
   * @summary New firewall.
   * @example requestBody { "fwcloud": 1, "name": "Firewall-01", "save_user_pass": 0, "install_port": 22, "fwmaster": 0, "options": 0, "node_id": 1 }
   */
  @Post('/')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('200', 'New firewall')
  @Example<LegacyFirewallInsertResponse>({ insertId: 1 })
  @Response<LegacyFirewallErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 1002,
    msg: 'Not found',
  })
  @Response<LegacyFirewallErrorResponse>('default', 'Legacy endpoint error', {
    fwcErr: 7002,
    msg: 'Tree node access not allowed',
  })
  public async store(
    @Body() requestBody?: LegacyFirewallStoreRequest,
  ): Promise<LegacyFirewallInsertResponse> {
    return { insertId: 1 };
  }

  /**
   * Update firewall information.
   * @summary Update firewall.
   * @example requestBody { "fwcloud": 1, "firewall": 5, "name": "Firewall-UPDATED", "comment": "Comment for the updated firewall.", "save_user_pass": 0, "install_port": 22, "fwmaster": 0, "options": 3 }
   */
  @Put('/')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('204', 'Update firewall')
  @Response<LegacyFirewallErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7001,
    msg: 'Firewall access not allowed',
  })
  public async update(@Body() requestBody?: LegacyFirewallUpdateRequest): Promise<void> {
    return;
  }

  /**
   * Get firewall data.
   * @summary Get firewall data.
   * @example requestBody { "fwcloud": 1, "firewall": 5 }
   */
  @Put('get')
  @SuccessResponse('200', 'Get firewall data')
  @Example<LegacyFirewallResponse>({
    id: 5,
    cluster: null,
    fwcloud: 1,
    name: 'Firewall-05',
    comment: null,
    created_at: '2019-05-15T10:34:46.000Z',
    updated_at: '2019-05-15T10:34:47.000Z',
    compiled_at: null,
    installed_at: null,
    by_user: 1,
    status: 3,
    install_user: '',
    install_pass: '',
    save_user_pass: 0,
    install_interface: null,
    install_ipobj: null,
    fwmaster: 0,
    install_port: 22,
    options: 0,
    interface_name: null,
    ip_name: null,
    ip: null,
    id_fwmaster: null,
  })
  @Response<LegacyFirewallErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7001,
    msg: 'Firewall access not allowed',
  })
  public async get(
    @Body() requestBody?: LegacyFirewallGetRequest,
  ): Promise<LegacyFirewallResponse> {
    return {
      id: 5,
      cluster: null,
      fwcloud: 1,
      name: 'Firewall-05',
      comment: null,
      created_at: '2019-05-15T10:34:46.000Z',
      updated_at: '2019-05-15T10:34:47.000Z',
      compiled_at: null,
      installed_at: null,
      by_user: 1,
      status: 3,
      install_user: '',
      install_pass: '',
      save_user_pass: 0,
      install_interface: null,
      install_ipobj: null,
      fwmaster: 0,
      install_port: 22,
      options: 0,
      interface_name: null,
      ip_name: null,
      ip: null,
      id_fwmaster: null,
    };
  }

  /**
   * Get firewalls data by fwcloud.
   * @summary Get firewalls in cloud.
   * @example requestBody { "fwcloud": 1 }
   */
  @Put('cloud/get')
  @SuccessResponse('200', 'Get firewalls in cloud')
  @Example<LegacyFirewallResponse[]>([
    {
      id: 1,
      cluster: null,
      fwcloud: 1,
      name: 'Firewall-01',
      comment: null,
      created_at: '2019-05-15T10:34:46.000Z',
      updated_at: '2019-05-15T10:34:47.000Z',
      compiled_at: null,
      installed_at: null,
      by_user: 1,
      status: 3,
      install_user: '',
      install_pass: '',
      save_user_pass: 0,
      install_interface: null,
      install_ipobj: null,
      fwmaster: 0,
      install_port: 22,
      options: 0,
      interface_name: null,
      ip_name: null,
      ip: null,
      id_fwmaster: null,
    },
    {
      id: 2,
      cluster: null,
      fwcloud: 1,
      name: 'Firewall-02',
      comment: null,
      created_at: '2019-05-15T10:34:46.000Z',
      updated_at: '2019-05-15T10:34:47.000Z',
      compiled_at: null,
      installed_at: null,
      by_user: 1,
      status: 3,
      install_user: '',
      install_pass: '',
      save_user_pass: 0,
      install_interface: null,
      install_ipobj: null,
      fwmaster: 0,
      install_port: 22,
      options: 0,
      interface_name: null,
      ip_name: null,
      ip: null,
      id_fwmaster: null,
    },
  ])
  @Response<LegacyFirewallErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7001,
    msg: 'Firewall access not allowed',
  })
  public async getByCloud(
    @Body() requestBody?: LegacyFirewallCloudRequest,
  ): Promise<LegacyFirewallResponse[]> {
    return [
      {
        id: 1,
        cluster: null,
        fwcloud: 1,
        name: 'Firewall-01',
        comment: null,
        created_at: '2019-05-15T10:34:46.000Z',
        updated_at: '2019-05-15T10:34:47.000Z',
        compiled_at: null,
        installed_at: null,
        by_user: 1,
        status: 3,
        install_user: '',
        install_pass: '',
        save_user_pass: 0,
        install_interface: null,
        install_ipobj: null,
        fwmaster: 0,
        install_port: 22,
        options: 0,
        interface_name: null,
        ip_name: null,
        ip: null,
        id_fwmaster: null,
      },
      {
        id: 2,
        cluster: null,
        fwcloud: 1,
        name: 'Firewall-02',
        comment: null,
        created_at: '2019-05-15T10:34:46.000Z',
        updated_at: '2019-05-15T10:34:47.000Z',
        compiled_at: null,
        installed_at: null,
        by_user: 1,
        status: 3,
        install_user: '',
        install_pass: '',
        save_user_pass: 0,
        install_interface: null,
        install_ipobj: null,
        fwmaster: 0,
        install_port: 22,
        options: 0,
        interface_name: null,
        ip_name: null,
        ip: null,
        id_fwmaster: null,
      },
    ];
  }

  /**
   * Get firewalls data by cluster.
   * @summary Get firewalls in cluster.
   * @example requestBody { "fwcloud": 1, "cluster": 2 }
   */
  @Put('cluster/get')
  @SuccessResponse('200', 'Get firewalls in cluster')
  @Example<LegacyFirewallResponse[]>([
    {
      id: 1,
      cluster: 2,
      fwcloud: 1,
      name: 'Firewall-01',
      comment: null,
      created_at: '2019-05-15T10:34:46.000Z',
      updated_at: '2019-05-15T10:34:47.000Z',
      compiled_at: null,
      installed_at: null,
      by_user: 1,
      status: 3,
      install_user: '',
      install_pass: '',
      save_user_pass: 0,
      install_interface: null,
      install_ipobj: null,
      fwmaster: 1,
      install_port: 22,
      options: 0,
      interface_name: null,
      ip_name: null,
      ip: null,
      id_fwmaster: null,
    },
    {
      id: 2,
      cluster: 2,
      fwcloud: 1,
      name: 'Firewall-02',
      comment: null,
      created_at: '2019-05-15T10:34:46.000Z',
      updated_at: '2019-05-15T10:34:47.000Z',
      compiled_at: null,
      installed_at: null,
      by_user: 1,
      status: 3,
      install_user: '',
      install_pass: '',
      save_user_pass: 0,
      install_interface: null,
      install_ipobj: null,
      fwmaster: 0,
      install_port: 22,
      options: 0,
      interface_name: null,
      ip_name: null,
      ip: null,
      id_fwmaster: null,
    },
  ])
  @Response<LegacyFirewallErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7001,
    msg: 'Firewall access not allowed',
  })
  public async getByCluster(
    @Body() requestBody?: LegacyFirewallClusterRequest,
  ): Promise<LegacyFirewallResponse[]> {
    return [
      {
        id: 1,
        cluster: 2,
        fwcloud: 1,
        name: 'Firewall-01',
        comment: null,
        created_at: '2019-05-15T10:34:46.000Z',
        updated_at: '2019-05-15T10:34:47.000Z',
        compiled_at: null,
        installed_at: null,
        by_user: 1,
        status: 3,
        install_user: '',
        install_pass: '',
        save_user_pass: 0,
        install_interface: null,
        install_ipobj: null,
        fwmaster: 1,
        install_port: 22,
        options: 0,
        interface_name: null,
        ip_name: null,
        ip: null,
        id_fwmaster: null,
      },
      {
        id: 2,
        cluster: 2,
        fwcloud: 1,
        name: 'Firewall-02',
        comment: null,
        created_at: '2019-05-15T10:34:46.000Z',
        updated_at: '2019-05-15T10:34:47.000Z',
        compiled_at: null,
        installed_at: null,
        by_user: 1,
        status: 3,
        install_user: '',
        install_pass: '',
        save_user_pass: 0,
        install_interface: null,
        install_ipobj: null,
        fwmaster: 0,
        install_port: 22,
        options: 0,
        interface_name: null,
        ip_name: null,
        ip: null,
        id_fwmaster: null,
      },
    ];
  }

  /**
   * Create a new firewall cloning the one indicated in the request's parameters.
   * @summary Clone firewall.
   * @example requestBody { "fwcloud": 1, "firewall": 5, "name": "Firewall-CLONED", "comment": "Comment for the cloned firewall.", "node_id": 1 }
   */
  @Put('clone')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('200', 'Clone firewall')
  @Example<LegacyFirewallInsertResponse>({ insertId: 7 })
  @Response<LegacyFirewallErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7001,
    msg: 'Firewall access not allowed',
  })
  public async clone(
    @Body() requestBody?: LegacyFirewallCloneRequest,
  ): Promise<LegacyFirewallInsertResponse> {
    return { insertId: 7 };
  }

  /**
   * Delete a firewall.
   * @summary Delete firewall.
   * @example requestBody { "fwcloud": 1, "firewall": 7 }
   */
  @Put('del')
  @Security({ sessionCookie: [], confirmToken: [] })
  @SuccessResponse('204', 'Delete firewall')
  @Response<LegacyFirewallErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7001,
    msg: 'Firewall access not allowed',
  })
  public async destroy(@Body() requestBody?: LegacyFirewallGetRequest): Promise<void> {
    return;
  }
}
