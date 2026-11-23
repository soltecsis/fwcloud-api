import { RequestHandler, Router } from 'express';
import { OperationPolicy } from './operation-policy';
import { OperationRegistry } from './operation-registry';

type LegacyMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'all' | 'head' | 'options';
interface LegacyOperation {
  method: LegacyMethod;
  path: string | string[];
  policy?: Readonly<OperationPolicy>;
}
const declarations = new WeakMap<Router, LegacyOperation[]>();

/** Records all declarations, including unclassified routes, in Express order. */
export function createOperationRouter(): Router {
  const router = Router();
  const operations: LegacyOperation[] = [];
  declarations.set(router, operations);
  const methods: LegacyMethod[] = [
    'get',
    'post',
    'put',
    'patch',
    'delete',
    'all',
    'head',
    'options',
  ];
  for (const method of methods) {
    const register = router[method].bind(router);
    router[method] = ((path: string | string[], ...handlers: RequestHandler[]) => {
      operations.push({ method, path });
      return register(path, ...handlers);
    }) as (typeof router)[typeof method];
  }
  return router;
}

/** Register handler and policy together, using Express's public router API. */
export function legacyOperation(
  router: Router,
  method: LegacyMethod,
  path: string,
  policy: OperationPolicy,
  ...handlers: RequestHandler[]
): void {
  const operations = declarations.get(router);
  if (!operations) throw new Error('Use createOperationRouter before declaring operation policies');
  const index = operations.length;
  router[method](path, ...handlers);
  operations[index].policy = Object.freeze({ ...policy });
}

export function registerLegacyOperations(
  registry: OperationRegistry,
  prefix: string,
  router: Router,
): void {
  for (const operation of declarations.get(router) ?? []) {
    const paths = Array.isArray(operation.path) ? operation.path : [operation.path];
    for (const path of paths)
      registry.register(operation.method, `${prefix}${path}`, operation.policy);
  }
}
