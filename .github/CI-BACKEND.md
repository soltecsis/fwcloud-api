# Implantación progresiva del CI de FWCloud-API

## 1. Objetivo y alcance

Este documento registra las decisiones, cambios y verificaciones de la mejora del CI
de `fwcloud-api`. Se actualizará en la misma rama y PR que cada entrega, de forma
que la documentación evolucione junto con la configuración.

| Campo | Valor |
| --- | --- |
| Repositorio | `fwcloud-api` |
| Rama de trabajo | `ciBackendHardering` |
| Base inicial | `upstream/fixes`, commit `6e6a964c` |
| Destino de la PR | `fixes` |
| Ejecución del CI | GitHub Actions, runners alojados en GitHub |
| Conservación prevista de evidencias | GitHub, con visibilidad y retención por configurar |
| Última actualización | 2026-09-21 |

El informe documenta la implantación técnica. No constituye una Declaración de
Aplicabilidad completa ni acredita por sí mismo conformidad con el ENS.

### Flujo de integración acordado

```text
Rama de trabajo → PR hacia fixes → CI y validación manual
    → promoción a main → despliegue → alineación de devel
```

La versión aceptada debe identificarse por commit y, cuando se incorporen las
evidencias de construcción, por el hash del artefacto. Las pruebas de una revisión
anterior no acreditan automáticamente revisiones posteriores.

## 2. Decisiones vigentes

- Mantener inicialmente la matriz de Node 20, 22 y 24.
- Mantener inicialmente MySQL 5.7, MySQL 8.0 y MariaDB 10.1. Esta continuidad no
  supone aprobar su uso en producción ni definir la política definitiva de soporte.
- Ejecutar lint y formato una vez, con Node 22.
- Aplazar SonarQube; no incorporar Semgrep como solución provisional.
- Conservar ESLint y Prettier. No considerar el lint actual una cobertura SAST
  completa: el comando existente excluye archivos JavaScript.
- Incorporar cambios en entregas pequeñas y verificables.
- Utilizar los repositorios y servicios existentes de GitHub para la documentación
  y evidencias, sin crear por ahora un repositorio documental independiente.
- Registrar por separado la implementación local y su validación en GitHub.

## 3. Plan de entregas

| Fase | Contenido | Estado | Criterio de cierre |
| --- | --- | --- | --- |
| 1 | Instalación reproducible, separación de calidad/pruebas y controles de ejecución | Implementada localmente; pendiente de validación completa en Actions | PR hacia `fixes` con calidad y matriz completas correctas; protección configurada |
| 2 | Informes de pruebas y cobertura | Implementada localmente; pendiente de validación completa en Actions | Informes por ejecución, también ante fallos; cobertura verificada sobre fuentes TypeScript |
| 3 | Detección de secretos con Gitleaks | Pendiente | Alcance inicial e incremental comprobado, redacción de secretos y política de excepciones |
| 4 | SCA y SBOM con Trivy | Pendiente | Dependencias inventariadas, hallazgos revisados, informes y criterios de bloqueo definidos |
| 5 | Pruebas negativas de autenticación y autorización | Pendiente | Casos por rol/recurso, denegaciones y aislamiento documentados y ejecutados |
| 6 | Laboratorio efímero y DAST con ZAP | Pendiente | Entorno sintético aislado, autenticación y cobertura verificadas, resultados revisados |
| Posterior | SonarQube | Aplazada | Integración y política de análisis acordadas; sin SAST provisional |

El orden puede ajustarse mediante una decisión registrada aquí. Ninguna fase
pendiente debe describirse como implantada por disponer únicamente de un plan.

## 4. Fase 1 — Base reproducible del CI

### 4.1. Archivos modificados

- [Workflow del backend](workflows/nodejs.yml).
- [`package.json`](../package.json): nuevo script `test:ci`.

No se han añadido dependencias ni cambiado las versiones del lockfile en esta fase.

### 4.2. Instalación y entorno

- Sustitución de `npm install` por `npm ci`.
- Caché de descargas npm mediante `actions/setup-node`, vinculada a
  `package-lock.json`.
- `HUSKY=0` para evitar la instalación de hooks locales en CI.
- `CI=true` a nivel de workflow.
- Registro de las versiones efectivas de Node y npm.
- Permisos explícitos de GitHub: `contents: read`.

### 4.3. Jobs y ejecución

| Job | Función | Tiempo máximo |
| --- | --- | --- |
| `quality` / `FWCloud-API Quality` | Instalación, ESLint y Prettier con Node 22 | 20 minutos |
| `test` / `FWCloud-API Test (Node ..., ...)` | Instalación, conexión a BD, build y pruebas en nueve combinaciones | 45 minutos por combinación |
| `backend-ci` | Exigir éxito de calidad y de la matriz completa | 5 minutos |

- Calidad se ejecuta una vez, en lugar de repetirse en la matriz.
- El build es obligatorio y se realiza una sola vez por combinación de pruebas.
- `fail-fast: false` permite observar los resultados de las demás combinaciones
  cuando una falla.
- El check final usa `always()` y exige resultados `success`: un fallo,
  cancelación u omisión de un job requerido no satisface la aceptación.
- Se cancela la ejecución anterior de una misma PR cuando llega una nueva revisión.
- Se elimina la restricción al propietario `soltecsis` para permitir comprobar
  cambios en los forks.

### 4.4. Bases de datos

- Se añaden health checks a los tres servicios.
- Antes de compilar se verifica la conexión con el usuario de pruebas y se ejecuta
  `SELECT 1` sobre la base seleccionada por la matriz.
- Las credenciales del workflow son datos del servicio de pruebas efímero, no
  credenciales de producción.
- Se conserva por ahora el arranque de los tres servicios en cada combinación.
  Arrancar solo el servicio necesario queda como optimización posterior.

### 4.5. Comando de pruebas

```bash
npm run build
npm run test:ci
```

`test:ci` ejecuta Mocha sobre los archivos ya compilados, con `NODE_ENV=test`:

- `--forbid-only`: rechaza suites o casos marcados con `.only`.
- `--fail-zero`: rechaza una ejecución sin pruebas.
- Patrón de archivos entre comillas para que Mocha resuelva el conjunto de pruebas.

`npm test` conserva su comportamiento previo, incluida la compilación.

La suite utiliza una base de datos de pruebas y puede reiniciarla. Para reproducir
la ejecución completa deben utilizarse servicios desechables y configuración de
pruebas, nunca una conexión a datos operativos.

### 4.6. Eventos

| Evento | Ramas / comportamiento |
| --- | --- |
| `push` | `main`, `fixes` |
| `pull_request` | Destino `devel`, `fixes`, `auditlogs` |
| `workflow_dispatch` | Ejecución manual, cuando el workflow esté disponible para ese evento en GitHub |

Los eventos previos se conservan; se añaden el push a `fixes` y la ejecución manual.
La rama de trabajo se comprobará al abrir una PR hacia `fixes`.

### 4.7. Verificaciones locales realizadas

Se utilizó un worktree temporal del commit base con los cambios de esta entrega.
Se eliminó al finalizar. Las dependencias del directorio habitual de desarrollo no
se sustituyeron.

Entorno local: Node `20.20.2`, npm `10.8.2`.

| Comprobación | Resultado |
| --- | --- |
| `HUSKY=0 npm ci --no-audit --no-fund` | Correcto, con advertencia de motor descrita abajo |
| `npm run lint:check` | Correcto |
| `npm run format:check` | Correcto |
| `npm run build` | Correcto |
| Actionlint `1.7.7` sobre `nodejs.yml` | Correcto |
| Comando `test:ci` contra suite sintética temporal | Salida 0 con éxito; salida 1 con prueba fallida, `.only` y cero pruebas |
| `git diff --check` | Correcto |

La comprobación sintética sustituyó únicamente el patrón de archivos del comando
por una suite temporal para verificar sus opciones. No ejecutó la suite de negocio.

**Pendiente:** ejecutar en GitHub la suite completa con bases de datos y las nueve
combinaciones. La validación local no acredita el resultado en Node 22/24 ni la
operación completa de los servicios del runner.

Los resultados anteriores se observaron durante la implantación local. Este
registro no equivale a informes adjuntos: los enlaces a ejecuciones de Actions se
añadirán cuando existan.

### 4.8. Hallazgo de compatibilidad

La dependencia existente `openai@7.4.0` declara Node `>=22.0.0`. La instalación en
Node 20 muestra `EBADENGINE`, aunque instalación, lint y build finalizaron bien.

- La matriz 20/22/24 se conserva conforme a lo acordado.
- No se considera confirmada la compatibilidad completa con Node 20.
- Pendiente: identificar Node en producción y decidir soporte o tratamiento de la
  dependencia antes de cerrar la política de versiones.

### 4.9. Cierre pendiente en GitHub

- [ ] Revisar y registrar el commit de esta entrega.
- [ ] Publicar la rama y abrir PR hacia `fixes`.
- [ ] Enlazar la PR y la ejecución de Actions en este documento.
- [ ] Comprobar calidad y las nueve combinaciones de pruebas.
- [ ] Configurar `backend-ci` como check obligatorio de `fixes`.
- [ ] Revisar checks antiguos requeridos para evitar referencias a nombres obsoletos.
- [ ] Registrar quién valida y el resultado de la aceptación.

| Evidencia | Referencia |
| --- | --- |
| Commit de implementación | Pendiente |
| PR hacia `fixes` | Pendiente |
| Ejecución completa de Actions | Pendiente |
| Protección de rama | Pendiente de configuración y verificación |
| Validación / responsable | Pendiente |

## 5. Fase 2 — Informes de pruebas y cobertura

### 5.1. Alcance y dependencias

Se incorpora JUnit y un resumen JSON de estadísticas en todas las combinaciones.
La cobertura se mide solo en Node 22 / MySQL 8.0, como referencia inicial de
medición, sin definir por ello la plataforma de producción.

Dependencias de desarrollo fijadas en `package.json` y `package-lock.json`:

- `mocha-junit-reporter@2.2.1`: informe XML JUnit con pruebas pendientes.
- `mocha-multi-reporters@1.5.2`: salida simultánea a consola y archivos.
- `c8@12.0.0`: cobertura mediante V8.

No se requiere una cuenta externa ni nuevos secretos de GitHub.

### 5.2. Archivos y comandos

| Archivo | Función |
| --- | --- |
| `.github/mocha-reporters.json` | Reporters de consola, JUnit y estadísticas |
| `.github/c8.json` | Alcance, formatos y exclusiones de cobertura |
| `scripts/mocha-stats-reporter.cjs` | Estadísticas agregadas sin nombres ni errores de pruebas |
| `scripts/ci-reports.cjs` | Verificación, metadatos y resumen de GitHub |
| `scripts/ci-reports.test.cjs` | Pruebas automatizadas del recolector, ejecutadas en el job de calidad |
| `.github/workflows/nodejs.yml` | Cobertura de referencia y conservación de informes |
| `.gitignore` | Exclusión del directorio generado `reports/` |

```bash
# Requiere servicios de prueba desechables y configuración de BD adecuada.
npm run build
npm run test:ci

# Alternativa: la misma suite una sola vez, con cobertura.
npm run test:coverage:ci
```

`test:ci` conserva `--forbid-only` y `--fail-zero`. `test:coverage:ci` lo ejecuta
mediante c8, sin reconstruir ni ejecutar una segunda vez las pruebas.

Para revisar informes ya generados, el workflow ejecuta `npm run ci:reports` con
`TEST_OUTCOME`, `TEST_DATABASE`, `TEST_DATABASE_IMAGE` y `COVERAGE_EXPECTED`.
La ausencia de un resultado de pruebas conocido no se interpreta como éxito.

### 5.3. Cobertura

- Se incluyen archivos propios de `src/**/*.ts` y `src/**/*.js`, también los no
  ejecutados, con `all: true`.
- Se excluyen declaraciones TypeScript, pruebas y dependencias.
- Se utilizan los source maps existentes y se aplican exclusiones tras remapear.
- Se generan LCOV, JSON, HTML y un resumen en consola.
- No se impone un porcentaje mínimo en esta fase. Sí se exige un informe válido,
  no vacío y con líneas de fuente cuando la combinación requiere cobertura.
- Esta medición no acredita cobertura de seguridad ni de código propio que pudiera
  quedar fuera de `src/`; cualquier ampliación del alcance deberá documentarse.

```text
reports/
├── tests/
│   ├── junit.xml
│   └── results.json
├── metadata.json
└── coverage/
    ├── lcov.info
    ├── coverage-summary.json
    └── index.html (y recursos HTML)
```

Los temporales de V8 quedan en `reports/.c8-tmp` y no se suben como evidencia.

### 5.4. Recogida y aceptación de resultados

- El paso de pruebas no utiliza `continue-on-error`.
- Si se intentaron ejecutar pruebas, la verificación y subida se intentan también
  tras un fallo, mediante `always()`.
- Si instalación, conexión o build fallan antes, no se inventa un informe de pruebas.
- El recolector falla si faltan informes obligatorios, hay cero pruebas, se informan
  fallos o el paso de pruebas no terminó correctamente.
- El manifiesto incluye el commit realmente comprobado mediante `git rev-parse HEAD`
  (puede ser el merge sintético de una PR), evento, referencia, ejecución/intento,
  versiones de Node/npm, imagen de BD seleccionada y estadísticas.
- El resumen de Actions solo muestra datos agregados; el XML puede contener nombres
  de pruebas, errores y trazas. Revisar su contenido antes de publicar ejecuciones
  en repositorios públicos. El HTML de cobertura también contiene código fuente.
- Un cierre forzoso del proceso o del runner puede impedir obtener resultados:
  esos casos siguen siendo fallidos/incompletos.

Se utiliza `actions/upload-artifact@v4.6.2`, fijada por SHA
`ea165f8d65b6e75b540449e92b4886f43607fa02`, con retención solicitada de 90 días y
`if-no-files-found: error`. La configuración del repositorio debe permitir esa
retención; los artefactos no constituyen un archivo indefinido de releases.

Nombres de los artefactos:

```text
backend-tests-node<NODE>-<BD>-<RUN_ID>-<ATTEMPT>
backend-coverage-node22-mysql8-<RUN_ID>-<ATTEMPT>
```

### 5.5. Verificaciones locales

Entorno: Node 20.20.2, npm 10.8.2. Instalación limpia y build en worktree temporal.

| Verificación | Resultado |
| --- | --- |
| Instalación limpia con `npm ci` y build | Correctos; persiste la advertencia conocida de `openai` / Node 20 |
| ESLint y Prettier del proyecto | Correctos |
| Pruebas del recolector (`node --test scripts/ci-reports.test.cjs`) | Seis casos correctos: éxito, informes ausentes, fallo del proceso, fallos declarados y cobertura ausente/completa |
| Reporters con suite sintética compilada | Éxito/fallo y pruebas omitidas reflejados en JSON/JUnit |
| `.only` y cero pruebas | Código de salida 1 |
| Cobertura con fuentes sintéticas TypeScript | Rutas originales verificadas; archivo no ejecutado incluido a 0; sin duplicados de `dist` ni pruebas |
| Formatos LCOV, JSON, HTML y lectura por el recolector | Correctos |
| Actionlint `1.7.7` y `git diff --check` | Correctos |

Durante la validación se detectó que el reporter JSON nativo de Mocha no recibía
la opción de archivo a través del adaptador multi-reporters. Se utiliza en su lugar
un reporter de estadísticas agregado; JUnit conserva el detalle de las pruebas.

Las verificaciones sintéticas no ejecutan la suite de negocio ni establecen su
porcentaje de cobertura real. La matriz completa y la descarga de artefactos deben
comprobarse en GitHub antes de cerrar esta fase.

### 5.6. Cierre pendiente

- [ ] Enlazar commit y PR de esta entrega.
- [ ] Verificar las nueve combinaciones en Actions.
- [ ] Descargar y abrir JUnit y cobertura de la combinación de referencia.
- [ ] Registrar la línea base de cobertura real y revisar sus exclusiones.
- [ ] Verificar la retención y la visibilidad de informes en el repositorio.
- [ ] Registrar validación y responsable.

## 6. Pendientes transversales

1. Concretar versiones soportadas de Node y bases de datos frente a las usadas en
   producción.
2. Definir retención y ubicación de informes en GitHub. Los artefactos de Actions
   caducan; no debe asumirse conservación indefinida por defecto.
3. Ajustar la visibilidad de los informes: en repositorios públicos no publicar
   secretos, sesiones o información sensible de vulnerabilidades.
4. Mantener trazabilidad del código probado al artefacto publicado. Los flujos de
   empaquetado/publicación que descargan `main` necesitan una revisión específica;
   esta fase no modifica `pack.yml` ni `docker.yml`.
5. Registrar revisiones manuales y excepciones con responsable, motivo y caducidad.

## 7. Procedimiento de actualización del informe

En cada entrega:

1. Actualizar la tabla de fases sin anticipar resultados.
2. Añadir una sección con la plantilla siguiente.
3. Documentar archivos y configuración de GitHub afectados.
4. Registrar verificaciones, entorno y limitaciones.
5. Enlazar PR, ejecuciones e informes, evitando incluir valores de secretos.
6. Cerrar la fase solo al satisfacer su criterio de cierre.

Si la configuración cambia después de validarse, identificar qué resultados siguen
siendo válidos y qué verificaciones deben repetirse. Los mensajes de commit y la
historia de Git complementan este informe; no sustituyen los resultados de pruebas.

### Plantilla para las siguientes fases

```markdown
## Fase N — Título

### Objetivo y estado
- Fecha:
- Estado: pendiente / en implantación / validación pendiente / validada
- Responsable:

### Cambios
- Archivos:
- Instalaciones y versiones:
- Configuración de GitHub:
- Motivo de las decisiones:

### Verificación
| Comprobación | Entorno / versión | Resultado | Evidencia |
| --- | --- | --- | --- |
| ... | ... | ... | ... |

### Hallazgos y limitaciones
- ...

### Cierre
- PR:
- Commit o rango de cambios:
- Ejecución de Actions:
- Informes y retención:
- Validación y responsable:
- Pendientes:
```
