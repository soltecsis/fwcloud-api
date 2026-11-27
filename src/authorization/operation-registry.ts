import { OperationPolicy } from './operation-policy';

interface RegisteredOperation {
  method: string;
  path: RegExp;
  policy?: Readonly<OperationPolicy>;
}

/** Built from route declarations at startup, not from a second URL allowlist. */
export class OperationRegistry {
  private readonly operations: RegisteredOperation[] = [];

  clear(): void {
    this.operations.length = 0;
  }

  register(method: string, template: string, policy?: OperationPolicy): void {
    const segments = template
      .replace(/\/$/, '')
      .split('/')
      .map((segment) => {
        if (/^:[A-Za-z][A-Za-z0-9_]*$/.test(segment)) return '[^/]+';
        // No inferred permissions for wildcard/optional routes. Add explicit support
        // before declaring a policy on such a route.
        if (/[():*?+{}]/.test(segment)) throw new Error(`Unsupported operation route: ${template}`);
        return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      });
    this.operations.push({
      method: method.toUpperCase(),
      path: new RegExp(`^${segments.join('/')}/?$`, 'i'),
      policy: policy ? Object.freeze({ ...policy }) : undefined,
    });
  }

  resolve(method: string, path: string): Readonly<OperationPolicy> | undefined {
    // Preserve declaration order, including unclassified routes: a later query
    // annotation must never authorize an earlier, overlapping mutation handler.
    return this.operations.find(
      (operation) =>
        (operation.method === method || operation.method === 'ALL') && operation.path.test(path),
    )?.policy;
  }
}
