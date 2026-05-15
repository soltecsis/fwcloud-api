# Proceso para documentar API con TSOA (Legacy + routes.ts)

## Objetivo
Documentar endpoints del proyecto con TSOA sin romper la lógica existente:
- Endpoints `legacy` (rutas bajo `src/routes/*/*.js`).
- Endpoints modernos definidos en `src/routes/routes.ts` y ejecutados por controladores TypeScript en `src/controllers/*`.

## Base del proyecto
- Configuración TSOA: `tsoa.json`
- Spec generado: `docs/openapi/openapi.json`
- Routes de TSOA generadas: `docs/openapi/routes/routes.ts`
- Script spec: `npm run openapi:tsoa:spec`
- Script routes: `npm run openapi:tsoa:routes`

## Flujo recomendado
1. Identificar rutas reales primero.
2. Decorar controladores (`@Route`, `@Tags`, `@OperationId`, `@SuccessResponse`, `@Response`, `@Example`, etc.).
3. Generar spec y routes.
4. Validar build.
5. Revisar que los paths y tags sean correctos en `openapi.json`.

## Parte 1: Legacy
### 1) Mapear endpoint legacy
- Buscar en los ficheros legacy (`src/routes/**.js`) el método, path, payload y ejemplos.
- Reutilizar endpoints existentes (no inventar endpoints nuevos).

### 2) Crear/editar controlador legacy de documentación
- Ubicación: `src/controllers/legacy/*.legacy.controller.ts` (o estructura equivalente ya usada en el repo).
- Añadir:
  - `@Route(...)` con la ruta base legacy.
  - `@Tags(...)` para agrupar.
  - `@OperationId(...)` descriptivo y legible.
  - `@Post/@Put/@Get/@Delete(...)`.
  - `@SuccessResponse(...)`, `@Response(...)`.
  - `@Example<...>(...)` con ejemplos inferidos desde comentarios y uso real del endpoint.

### 3) Tipos y ejemplos
- Definir interfaces locales para request/response en el controlador.
- Evitar `Object`; usar `Record<string, unknown>` o interfaces explícitas.
- Mantener ejemplos consistentes con datos reales legacy (`fwcErr`, `msg`, etc. cuando aplique).

## Parte 2: routes.ts (no legacy)
### 1) Localizar controlador real
- Partir siempre de `src/routes/routes.ts`.
- Para cada endpoint, identificar exactamente clase y método (ej. `FirewallController`, `ping`, etc.).
- Aplicar decoradores en ese controlador real dentro de `src/controllers/*`.

### 2) Decorar sin cambiar lógica de negocio
- Mantener comportamiento existente.
- Patrón recomendado:
  - `import { Request as ExpressRequest } from 'express';`
  - `import { ...decorators... } from 'tsoa';`
  - `@Route(...)` ajustado al prefijo real.
  - `@Tags(...)` según agrupación funcional.
  - Decoradores por método (`@Get/@Post/...`, `@OperationId`, `@SuccessResponse`, `@Response`, `@Example`).
  - Parámetros decorados (`@Request`, `@Body`, `@Path`, `@Query`) para mejorar schema y docs.

### 3) Buenas prácticas de paths
- Revisar que `@Route` + path del método no dupliquen prefijos.
- Ejemplo típico a evitar: `@Route('fwclouds')` + `@Post('fwclouds')` -> genera `/fwclouds/fwclouds`.
- Corregir usando base vacía o paths relativos correctos, según el controlador.

## Tags y agrupación visual
- Definir/ajustar tags en `tsoa.json` (`spec.spec.tags`).
- Agrupar secciones con `x-tagGroups` en `tsoa.json`.
- En no-legacy y legacy usar nombres consistentes con la estructura funcional (user, customer, firewall, fwclouds, etc.).

## Registro en `tsoa.json`
- Verificar que todos los controladores documentados estén en `controllerPathGlobs`.
- Ejemplo: añadir nuevos controladores no-legacy en `src/controllers/...`.

## Validación final
Ejecutar siempre:
1. `npm run openapi:tsoa:spec`
2. `npm run openapi:tsoa:routes`
3. `npm run build`

Comprobar en `docs/openapi/openapi.json`:
- paths correctos (sin duplicados de prefijo),
- `operationId` legibles,
- tags correctos,
- ejemplos de request/response presentes.

## Checklist rápido
- Ruta mapeada desde fuente real (`legacy` o `routes.ts`).
- Decoradores TSOA completos.
- Ejemplos inferidos de código/comentarios reales.
- `controllerPathGlobs` actualizado.
- Spec y routes regenerados.
- Build en verde.
