# Reusable prompt: `routes.ts` route documentation with TSOA

Copy and paste this prompt whenever you want to document non-legacy endpoints:

```md
I want you to document endpoints defined in `src/routes/routes.ts` using TSOA.

Rules:
1. First map each endpoint in `routes.ts` to locate its real controller/method in `src/controllers/*`.
2. Do not create new documentation-only controllers: apply decorators directly in the real controller.
3. Do not change business logic; only apply documentation and the necessary typing/decorators.
4. Use the Express alias in controllers: `import { Request as ExpressRequest } from 'express';`
5. Apply complete TSOA decorators:
   - class: `@Route`, `@Tags`
   - method: `@OperationId`, `@Get/@Post/@Put/@Delete`, `@SuccessResponse`, `@Response`, `@Example`
   - parameters: `@Request()`, `@Body()`, `@Path()`, `@Query()`
6. For request payloads, always model the body with TSOA decorator syntax and DTO typing (for example: `@Body() requestBody: CreateXDto`).
7. Keep `@Request() request: ExpressRequest` only for context/session/db access, and avoid documenting payloads through `req.body` alone.
8. If the controller already uses a body helper pattern (for example `this.getBody(request, requestBody)`), keep that pattern and wire `@Body()` into it.
9. Adjust `@Route` and method paths to avoid duplicated prefixes.
10. Infer request/response examples from DTOs, services, and comments in the codebase itself.
11. If needed, update `tsoa.json` (`controllerPathGlobs`, `tags`, `x-tagGroups`) while keeping consistency.
12. At the end, run:
   - `npm run openapi:tsoa:spec`
   - `npm run openapi:tsoa:routes`
   - `npm run build`
13. Return a summary with:
   - documented endpoints,
   - modified files,
   - validation status and possible warnings.
```
