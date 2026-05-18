# Process to Document the API with TSOA (Legacy + routes.ts)

## Goal
Document project endpoints with TSOA without breaking existing logic:
- `legacy` endpoints (routes under `src/routes/*/*.js`).
- Modern endpoints defined in `src/routes/routes.ts` and handled by TypeScript controllers in `src/controllers/*`.

## Project baseline
- TSOA configuration: `tsoa.json`
- Generated spec: `docs/openapi/openapi.json`
- Generated TSOA routes: `docs/openapi/routes/routes.ts`
- Spec script: `npm run openapi:tsoa:spec`
- Routes script: `npm run openapi:tsoa:routes`

## Recommended workflow
1. Identify real routes first.
2. Annotate controllers (`@Route`, `@Tags`, `@OperationId`, `@SuccessResponse`, `@Response`, `@Example`, etc.).
3. Generate spec and routes.
4. Validate the build.
5. Review paths and tags in `openapi.json`.

## Part 1: Legacy
### 1) Map the legacy endpoint
- Search legacy files (`src/routes/**.js`) for method, path, payload, and examples.
- Reuse existing endpoints (do not invent new endpoints).

### 2) Create/edit the legacy documentation controller
- Location: `src/controllers/legacy/*.legacy.controller.ts` (or the equivalent structure already used in the repo).
- Add:
  - `@Route(...)` with the legacy base route.
  - `@Tags(...)` for grouping.
  - `@OperationId(...)` descriptive and readable.
  - `@Post/@Put/@Get/@Delete(...)`.
  - `@SuccessResponse(...)`, `@Response(...)`.
  - `@Example<...>(...)` with examples inferred from comments and real endpoint usage.

### 3) Types and examples
- Define local request/response interfaces in the controller.
- Avoid `Object`; use `Record<string, unknown>` or explicit interfaces.
- Keep examples consistent with real legacy data (`fwcErr`, `msg`, etc. when applicable).

## Part 2: routes.ts (non-legacy)
### 1) Locate the real controller
- Always start from `src/routes/routes.ts`.
- For each endpoint, identify the exact class and method (e.g. `FirewallController`, `ping`, etc.).
- Apply decorators in that real controller under `src/controllers/*`.

### 2) Add decorators without changing business logic
- Keep existing behavior.
- Recommended pattern:
  - `import { Request as ExpressRequest } from 'express';`
  - `import { ...decorators... } from 'tsoa';`
  - `@Route(...)` aligned with the real prefix.
  - `@Tags(...)` based on functional grouping.
  - Method decorators (`@Get/@Post/...`, `@OperationId`, `@SuccessResponse`, `@Response`, `@Example`).
  - Decorated parameters (`@Request`, `@Body`, `@Path`, `@Query`) to improve schema and docs.

### 3) Path best practices
- Check that `@Route` + method path do not duplicate prefixes.
- Typical issue to avoid: `@Route('fwclouds')` + `@Post('fwclouds')` -> generates `/fwclouds/fwclouds`.
- Fix by using an empty base or correct relative paths, depending on the controller.

## Tags and visual grouping
- Define/adjust tags in `tsoa.json` (`spec.spec.tags`).
- Group sections using `x-tagGroups` in `tsoa.json`.
- In both non-legacy and legacy, use names consistent with the functional structure (`user`, `customer`, `firewall`, `fwclouds`, etc.).

## Registration in `tsoa.json`
- Verify all documented controllers are included in `controllerPathGlobs`.
- Example: add new non-legacy controllers under `src/controllers/...`.

## Final validation
Always run:
1. `npm run openapi:tsoa:spec`
2. `npm run openapi:tsoa:routes`
3. `npm run build`

Check in `docs/openapi/openapi.json`:
- correct paths (no duplicated prefixes),
- readable `operationId` values,
- correct tags,
- request/response examples present.

## Quick checklist
- Route mapped from a real source (`legacy` or `routes.ts`).
- Complete TSOA decorators.
- Examples inferred from real code/comments.
- `controllerPathGlobs` updated.
- Spec and routes regenerated.
- Build passes.
