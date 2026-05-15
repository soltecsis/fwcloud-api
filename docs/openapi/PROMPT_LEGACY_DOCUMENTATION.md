# Prompt reutilizable: documentación Legacy con TSOA

Copia y pega este prompt cuando quieras que se documente la parte legacy:

```md
Quiero que documentes endpoints legacy con TSOA en este repo.

Reglas:
1. No inventes endpoints nuevos: usa endpoints legacy reales ya existentes en `src/routes/**` (archivos `.js`).
2. Extrae ejemplos, payloads y errores desde el código/comentarios legacy (no desde `openapi.json`).
3. Crea/edita los controladores de documentación legacy en `src/controllers/legacy/*.legacy.controller.ts`.
4. Usa decoradores TSOA completos: `@Route`, `@Tags`, `@OperationId`, `@Get/@Post/@Put/@Delete`, `@SuccessResponse`, `@Response`, `@Example`.
5. Usa `operationId` legibles y descriptivos.
6. Mantén naming de tags consistente con la estructura legacy (por ejemplo `user`, `customer`, `firewall`, `cluster`, etc.).
7. Si hace falta, actualiza `tsoa.json` (`controllerPathGlobs`, `tags`, `x-tagGroups`) sin romper lo existente.
8. Al terminar, ejecuta:
   - `npm run openapi:tsoa:spec`
   - `npm run openapi:tsoa:routes`
   - `npm run build`
9. Devuélveme resumen con:
   - ficheros modificados,
   - endpoints documentados,
   - validaciones ejecutadas y resultado.
```
