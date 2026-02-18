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

import { expect } from 'chai';
import { HTTPApplication } from '../../../../../src/fonaments/http-application';
import { Route } from '../../../../../src/fonaments/http/router/route';
import { HttpMethod, RouterService } from '../../../../../src/fonaments/http/router/router.service';
import {
  INTERNAL_MUTATING_ROUTE_EXCEPTIONS,
  auditRouteExpectationManifest,
} from './audit-expectations';

type ControllerRouteIndexEntry = {
  key: string;
  method: HttpMethod;
  path: string;
  controller: string;
  action: string;
  name: string | null;
};

const mutatingMethods: ReadonlySet<HttpMethod> = new Set<HttpMethod>([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

const nonMutatingMethods: ReadonlySet<HttpMethod> = new Set<HttpMethod>(['GET', 'HEAD', 'OPTIONS']);

let cachedControllerRoutes: ControllerRouteIndexEntry[] | null = null;

class RouteInspectionApplication extends HTTPApplication {
  constructor() {
    super(process.cwd());
  }

  protected providers(): Array<any> {
    return [];
  }

  protected beforeMiddlewares(): Array<any> {
    return [];
  }

  protected afterMiddlewares(): Array<any> {
    return [];
  }
}

const normalizePath = (pathParams: Route['pathParams']): string => {
  const sourcePath =
    typeof pathParams === 'string'
      ? pathParams
      : pathParams instanceof RegExp
        ? pathParams.source
        : String(pathParams);

  const normalized = sourcePath
    .replace(/:([A-Za-z0-9_]+)\([^/)]*\)/g, ':$1')
    .replace(/\/+/g, '/')
    .replace(/\/$/, '');

  return normalized.length > 0 ? normalized : '/';
};

const formatRouteForFailure = (route: ControllerRouteIndexEntry): string => {
  const routeName = route.name ? `, name: ${route.name}` : '';
  return `${route.key} (${route.controller}@${route.action}${routeName})`;
};

const findDuplicateKeys = (keys: string[]): string[] => {
  const counts = new Map<string, number>();

  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key)
    .sort((left, right) => left.localeCompare(right));
};

const collectControllerRoutes = async (): Promise<ControllerRouteIndexEntry[]> => {
  if (cachedControllerRoutes !== null) {
    return cachedControllerRoutes;
  }

  const app = new RouteInspectionApplication();
  const routerService: RouterService = await RouterService.make(app);
  routerService.registerRoutes();

  cachedControllerRoutes = routerService
    .getRoutes()
    .filter((route) => route.isControllerHandler())
    .map((route) => {
      const method = route.httpMethod;
      const path = normalizePath(route.pathParams);

      return {
        key: `${method} ${path}`,
        method,
        path,
        controller: route.controllerSignature.controller.name,
        action: route.controllerSignature.method,
        name: route.name ?? null,
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));

  return cachedControllerRoutes;
};

describe('Controller route audit expectations coverage', () => {
  it('builds a deterministic controller route index', async () => {
    const routes = await collectControllerRoutes();
    const routeKeys = routes.map((route) => route.key);
    const sortedRouteKeys = [...routeKeys].sort((left, right) => left.localeCompare(right));

    expect(routes.length).to.be.greaterThan(0);
    expect(routeKeys).to.deep.equal(sortedRouteKeys);

    const duplicateRouteKeys = findDuplicateKeys(routeKeys);
    expect(duplicateRouteKeys).to.deep.equal([]);
  });

  it('requires explicit audit expectations for mutating controller routes', async () => {
    const routes = await collectControllerRoutes();
    const mutatingRoutes = routes.filter(
      (route) =>
        mutatingMethods.has(route.method) && !INTERNAL_MUTATING_ROUTE_EXCEPTIONS.has(route.key),
    );

    const manifestKeys = Object.keys(auditRouteExpectationManifest).sort((left, right) =>
      left.localeCompare(right),
    );
    const manifestKeySet = new Set(manifestKeys);
    const runtimeMutatingRouteKeys = new Set(mutatingRoutes.map((route) => route.key));

    const missingRoutes = mutatingRoutes.filter((route) => !manifestKeySet.has(route.key));
    const staleManifestRoutes = manifestKeys.filter((key) => !runtimeMutatingRouteKeys.has(key));

    if (missingRoutes.length > 0 || staleManifestRoutes.length > 0) {
      const failureSections: string[] = [
        'Audit expectations manifest is out of sync with mutating controller routes.',
      ];

      if (missingRoutes.length > 0) {
        failureSections.push('Missing expectations (add these keys):');
        failureSections.push(...missingRoutes.map((route) => `- ${formatRouteForFailure(route)}`));
      }

      if (staleManifestRoutes.length > 0) {
        failureSections.push('Stale expectations (remove or update these keys):');
        failureSections.push(...staleManifestRoutes.map((key) => `- ${key}`));
      }

      failureSections.push(
        'Update tests/Unit/fonaments/http/router/audit-expectations.ts when adding or removing mutating controller routes.',
      );

      expect.fail(failureSections.join('\n'));
    }
  });

  it('keeps non-mutating routes out of this manifest by policy', async () => {
    const routes = await collectControllerRoutes();
    const nonMutatingRouteKeys = new Set(
      routes.filter((route) => nonMutatingMethods.has(route.method)).map((route) => route.key),
    );

    const expectationsForNonMutatingRoutes = Object.keys(auditRouteExpectationManifest).filter(
      (key) => nonMutatingRouteKeys.has(key),
    );

    expect(expectationsForNonMutatingRoutes).to.deep.equal([]);
  });
});
