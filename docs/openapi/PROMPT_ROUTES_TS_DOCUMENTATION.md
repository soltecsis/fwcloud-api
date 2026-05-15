# Prompt reutilizable: documentación de rutas en `routes.ts` con TSOA

Copia y pega este prompt cuando quieras documentar endpoints no-legacy:

```md
Quiero que documentes endpoints definidos en `src/routes/routes.ts` con TSOA.

Reglas:
1. Primero mapea cada endpoint en `routes.ts` para localizar su controlador/método real en `src/controllers/*`.
2. No crees controladores nuevos para documentar: aplica decoradores directamente en el controlador real.
3. No cambies lógica de negocio; solo documentación y tipado/decoradores necesarios.
4. Usa alias de Express en controladores: `import { Request as ExpressRequest } from 'express';`
5. Aplica decoradores TSOA completos:
   - clase: `@Route`, `@Tags`
   - método: `@OperationId`, `@Get/@Post/@Put/@Delete`, `@SuccessResponse`, `@Response`, `@Example`
   - parámetros: `@Request`, `@Body`, `@Path`, `@Query`
6. Ajusta `@Route` y paths para evitar duplicidades de prefijo.
7. Infiere ejemplos de request/response desde DTOs, servicios y comentarios del propio código.
8. Si aplica, actualiza `tsoa.json` (`controllerPathGlobs`, `tags`, `x-tagGroups`) manteniendo coherencia.
9. Al terminar, ejecuta:
   - `npm run openapi:tsoa:spec`
   - `npm run openapi:tsoa:routes`
   - `npm run build`
10. Devuélveme resumen con:
   - endpoints documentados,
   - ficheros modificados,
   - estado de validaciones y posibles warnings.
```
