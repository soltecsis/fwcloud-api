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

interface LegacyClusterErrorResponse {
  fwcErr?: number;
  msg?: string;
}

interface LegacyClusterNodePayload {
  name: string;
  comment: string | null;
  install_user: string | null;
  install_pass: string | null;
  save_user_pass: number;
  install_interface: string | null;
  install_ipobj: string | null;
  fwmaster: number;
  install_port: number;
}

interface LegacyClusterStoreRequest {
  fwcloud: number;
  node_id: number;
  clusterData: {
    name: string;
    options: number;
    fwnodes: LegacyClusterNodePayload[];
  };
}

interface LegacyClusterGetRequest {
  fwcloud: number;
  cluster: number;
}

interface LegacyClusterGetByCloudRequest {
  fwcloud: number;
}

interface LegacyClusterUpdateRequest {
  fwcloud: number;
  clusterData: {
    cluster: number;
    name: string;
    options: number;
  };
}

interface LegacyClusterFirewallToClusterRequest {
  fwcloud: number;
  firewall: number;
  node_id: number;
}

interface LegacyClusterClusterToFirewallRequest {
  fwcloud: number;
  cluster: number;
  node_id: number;
}

interface LegacyClusterCloneRequest {
  fwcloud: number;
  cluster: number;
  name: string;
  comment: string;
  node_id: number;
}

interface LegacyClusterStoreResponse {
  insertId: number;
  loData: Record<string, unknown>;
}

interface LegacyClusterNodeResponse {
  id: number;
  cluster: number;
  name: string;
  comment: string | null;
  status: number;
  install_user: string;
  install_pass: string;
  save_user_pass: number;
  install_interface: string | null;
  install_ipobj: string | null;
  fwmaster: number;
  install_port: number;
  interface_name: string | null;
  ip_name: string | null;
  ip: string | null;
  options: number;
}

interface LegacyClusterResponse {
  id: number;
  fwcloud: number;
  name: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
  nodes: LegacyClusterNodeResponse[];
}

interface LegacyClusterSummary {
  id: number;
  fwcloud: number;
  name: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
  created_by: number;
  updated_by: number;
}

interface LegacyClusterConvertResponse {
  result: boolean;
  insertId: number;
}

interface LegacyClusterCloneResponse {
  insertId: number;
}

interface LegacyClusterRestrictionsResponse {
  result: boolean;
  restrictions: Record<string, boolean>;
}

@Route('cluster')
@Tags('cluster')
export class ClusterLegacyController {
  /**
   * Create a new cluster of firewalls.
   * @summary New cluster.
   * @example requestBody { "fwcloud": 3, "node_id": 391, "clusterData": { "name": "Cluster-01", "options": 3, "fwnodes": [ { "name": "node1", "comment": null, "install_user": null, "install_pass": null, "save_user_pass": 1, "install_interface": null, "install_ipobj": null, "fwmaster": 1, "install_port": 22 }, { "name": "node2", "comment": null, "install_user": null, "install_pass": null, "save_user_pass": 1, "install_interface": null, "install_ipobj": null, "fwmaster": 0, "install_port": 22 }, { "name": "node3", "comment": null, "install_user": null, "install_pass": null, "save_user_pass": 1, "install_interface": null, "install_ipobj": null, "fwmaster": 0, "install_port": 22 } ] } }
   */
  @Post('/')
  @SuccessResponse('200', 'New cluster')
  @Example<LegacyClusterStoreResponse>({
    insertId: 1,
    loData: {},
  })
  @Response<LegacyClusterErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 1002,
    msg: 'Not found',
  })
  @Response<LegacyClusterErrorResponse>('default', 'Legacy endpoint error', {
    fwcErr: 7002,
    msg: 'Tree node access not allowed',
  })
  public async store(
    @Body() requestBody?: LegacyClusterStoreRequest,
  ): Promise<LegacyClusterStoreResponse> {
    return {
      insertId: 1,
      loData: {},
    };
  }

  /**
   * Get cluster data.
   * @summary Get cluster data.
   * @example requestBody { "fwcloud": 2, "cluster": 5 }
   */
  @Put('get')
  @SuccessResponse('200', 'Get cluster data')
  @Example<LegacyClusterResponse>({
    id: 2,
    fwcloud: 2,
    name: 'Cluster-02',
    comment: null,
    created_at: '2019-05-17T11:47:00.000Z',
    updated_at: '2019-05-17T11:47:00.000Z',
    created_by: 0,
    updated_by: 0,
    nodes: [
      {
        id: 10,
        cluster: 2,
        name: 'node1',
        comment: null,
        status: 3,
        install_user: '',
        install_pass: '',
        save_user_pass: 1,
        install_interface: null,
        install_ipobj: null,
        fwmaster: 1,
        install_port: 22,
        interface_name: null,
        ip_name: null,
        ip: null,
        options: 3,
      },
    ],
  })
  @Response<LegacyClusterErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7002,
    msg: 'Cluster access not allowed',
  })
  public async get(@Body() requestBody?: LegacyClusterGetRequest): Promise<LegacyClusterResponse> {
    return {
      id: 2,
      fwcloud: 2,
      name: 'Cluster-02',
      comment: null,
      created_at: '2019-05-17T11:47:00.000Z',
      updated_at: '2019-05-17T11:47:00.000Z',
      created_by: 0,
      updated_by: 0,
      nodes: [
        {
          id: 10,
          cluster: 2,
          name: 'node1',
          comment: null,
          status: 3,
          install_user: '',
          install_pass: '',
          save_user_pass: 1,
          install_interface: null,
          install_ipobj: null,
          fwmaster: 1,
          install_port: 22,
          interface_name: null,
          ip_name: null,
          ip: null,
          options: 3,
        },
      ],
    };
  }

  /**
   * Get all the cluster data for the indicated fwcloud.
   * @summary Get cloud clusters.
   * @example requestBody { "fwcloud": 2 }
   */
  @Put('cloud/get')
  @SuccessResponse('200', 'Get cloud clusters')
  @Example<LegacyClusterSummary[]>([
    {
      id: 1,
      fwcloud: 2,
      name: 'Cluster-01',
      comment: null,
      created_at: '2019-05-17T11:46:57.000Z',
      updated_at: '2019-05-17T11:46:57.000Z',
      created_by: 0,
      updated_by: 0,
    },
    {
      id: 2,
      fwcloud: 2,
      name: 'Cluster-02',
      comment: null,
      created_at: '2019-05-17T11:47:00.000Z',
      updated_at: '2019-05-17T11:47:00.000Z',
      created_by: 0,
      updated_by: 0,
    },
  ])
  @Response<LegacyClusterErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7002,
    msg: 'Cluster access not allowed',
  })
  public async getByCloud(
    @Body() requestBody?: LegacyClusterGetByCloudRequest,
  ): Promise<LegacyClusterSummary[]> {
    return [
      {
        id: 1,
        fwcloud: 2,
        name: 'Cluster-01',
        comment: null,
        created_at: '2019-05-17T11:46:57.000Z',
        updated_at: '2019-05-17T11:46:57.000Z',
        created_by: 0,
        updated_by: 0,
      },
      {
        id: 2,
        fwcloud: 2,
        name: 'Cluster-02',
        comment: null,
        created_at: '2019-05-17T11:47:00.000Z',
        updated_at: '2019-05-17T11:47:00.000Z',
        created_by: 0,
        updated_by: 0,
      },
    ];
  }

  /**
   * Update cluster data.
   * @summary Update cluster.
   * @example requestBody { "fwcloud": 2, "clusterData": { "cluster": 5, "name": "Cluster-UPDATED", "options": 3 } }
   */
  @Put('/')
  @SuccessResponse('204', 'Update cluster')
  @Response<LegacyClusterErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 1002,
    msg: 'Not found',
  })
  public async update(@Body() requestBody?: LegacyClusterUpdateRequest): Promise<void> {
    return;
  }

  /**
   * Convert a firewall into a new cluster.
   * @summary Firewall to cluster.
   * @example requestBody { "fwcloud": 2, "firewall": 5, "node_id": 391 }
   */
  @Put('fwtocluster')
  @SuccessResponse('200', 'Firewall converted to cluster')
  @Example<LegacyClusterConvertResponse>({
    result: true,
    insertId: 6,
  })
  @Response<LegacyClusterErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 1002,
    msg: 'Not found',
  })
  public async firewallToCluster(
    @Body() requestBody?: LegacyClusterFirewallToClusterRequest,
  ): Promise<LegacyClusterConvertResponse> {
    return {
      result: true,
      insertId: 6,
    };
  }

  /**
   * Convert a cluster into a single firewall.
   * @summary Cluster to firewall.
   * @example requestBody { "fwcloud": 2, "cluster": 6, "node_id": 391 }
   */
  @Put('clustertofw')
  @SuccessResponse('200', 'Cluster converted to firewall')
  @Example<LegacyClusterConvertResponse>({
    result: true,
    insertId: 12,
  })
  @Response<LegacyClusterErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 1002,
    msg: 'Not found',
  })
  public async clusterToFirewall(
    @Body() requestBody?: LegacyClusterClusterToFirewallRequest,
  ): Promise<LegacyClusterConvertResponse> {
    return {
      result: true,
      insertId: 12,
    };
  }

  /**
   * Clone an existing cluster.
   * @summary Clone cluster.
   * @example requestBody { "fwcloud": 2, "cluster": 5, "name": "Cluster-CLONED", "comment": "Comment for cloned cluster.", "node_id": 391 }
   */
  @Put('clone')
  @SuccessResponse('200', 'Clone cluster')
  @Example<LegacyClusterCloneResponse>({
    insertId: 7,
  })
  @Response<LegacyClusterErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 7002,
    msg: 'Tree node access not allowed',
  })
  public async clone(
    @Body() requestBody?: LegacyClusterCloneRequest,
  ): Promise<LegacyClusterCloneResponse> {
    return {
      insertId: 7,
    };
  }

  /**
   * Check if there are restrictions for cluster deletion.
   * @summary Restrictions for cluster deletion.
   * @example requestBody { "fwcloud": 2, "cluster": 5 }
   */
  @Put('restricted')
  @SuccessResponse('204', 'No deletion restrictions')
  @Response<LegacyClusterRestrictionsResponse>(403, 'Legacy endpoint restriction', {
    result: true,
    restrictions: {
      FirewallHasInterfaces: true,
    },
  })
  public async restricted(@Body() requestBody?: LegacyClusterGetRequest): Promise<void> {
    return;
  }

  /**
   * Delete cluster.
   * @summary Delete cluster.
   * @example requestBody { "fwcloud": 2, "cluster": 5 }
   */
  @Put('del')
  @SuccessResponse('204', 'Delete cluster')
  @Response<LegacyClusterErrorResponse>(400, 'Legacy endpoint error', {
    fwcErr: 1002,
    msg: 'Not found',
  })
  public async delete(@Body() requestBody?: LegacyClusterGetRequest): Promise<void> {
    return;
  }
}
