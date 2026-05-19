# Reusable prompt: Legacy documentation with TSOA

Copy and paste this prompt whenever you want legacy endpoints to be documented:

```md
I want you to document legacy endpoints with TSOA in this repo.

Rules:
1. Do not invent new endpoints: use real existing legacy endpoints under `src/routes/**` (`.js` files).
2. Extract examples, payloads, and errors from legacy code/comments (not from `openapi.json`).
3. Create/edit legacy documentation controllers in `src/controllers/legacy/*.legacy.controller.ts`.
4. Use complete TSOA decorators: `@Route`, `@Tags`, `@OperationId`, `@Get/@Post/@Put/@Delete`, `@SuccessResponse`, `@Response`, `@Example`.
5. Use readable, descriptive `operationId` values.
6. Keep tag naming consistent with the legacy structure (for example `user`, `customer`, `firewall`, `cluster`, etc.).
7. If needed, update `tsoa.json` (`controllerPathGlobs`, `tags`, `x-tagGroups`) without breaking existing coverage.
8. At the end, run:
   - `npm run openapi:tsoa:spec`
   - `npm run openapi:tsoa:routes`
   - `npm run build`
9. Return a summary with:
   - modified files,
   - documented endpoints,
   - executed validations and result.
```
