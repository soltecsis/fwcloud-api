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
| Última actualización | 2026-09-24 |

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
| 3 | Detección de secretos con Gitleaks | Implementada localmente; revisión histórica y validación en Actions pendientes | Alcance inicial e incremental comprobado, redacción de secretos y política de excepciones |
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
| `test` / `FWCloud-API Test (Node ..., ...)` | Instalación, conexión a BD, build y pruebas en nueve combinaciones | Valor predeterminado de GitHub (360 minutos); límite explícito comentado |
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
- Cada combinación arranca únicamente su base de datos. Las imágenes de los otros
  servicios se resuelven a una cadena vacía, conservando los puertos de la matriz.

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

### 4.5.1. Reinicio de la base de datos de pruebas

`tests/utils/database-reset.ts` conserva en memoria una copia de los datos justo
después de ejecutar todas las migraciones y las semillas. La copia incluye las
tablas sin entidad, los registros creados por migraciones, el historial de
migraciones y los contadores de autoincremento; no depende del directorio
`tests/playground`, que se vacía entre pruebas.

- `testSuite.resetDatabaseData()` vacía las tablas y restaura esa copia sin repetir
  las migraciones ni leer de nuevo los archivos de semillas.
- `testSuite.resetDatabaseData({ rebuildSchema: true })` elimina las tablas,
  ejecuta las migraciones y semillas y renueva la copia. Se utiliza al iniciar la
  suite y para limpiar las pruebas que modifican el esquema o restauran backups.
- Una nueva prueba que borre tablas/columnas o ejecute migraciones debe solicitar
  una reconstrucción completa en su limpieza (`after`, `afterEach` o `finally`),
  incluso si falla una aserción. El reinicio rápido no repara cambios de esquema.
- Las operaciones de restauración comparten una conexión. Sus ajustes de claves
  foráneas y modo SQL se restauran en `finally`; un error hace fallar la prueba e
  invalida la copia para que el siguiente reinicio reconstruya la base de datos.
- Los borrados e inserciones comparten una transacción para evitar reconstruir
  físicamente cada tabla mediante `TRUNCATE`. Los contadores se restauran después
  del commit, porque `ALTER TABLE` realiza un commit implícito en MySQL/MariaDB.
- Las pruebas siguen ejecutándose en serie y cada job conserva su propia BD.

Se registran número de llamadas, tiempo total y máximo en milisegundos para
`drop`, `migrate`, `seed`, `snapshot`, `rebuild` y `restore`. `rebuild` incluye las
cuatro primeras fases; sus tiempos no deben sumarse de nuevo. Las mediciones se
imprimen cada 50 reinicios y al finalizar. En CI también se guardan en
`reports/tests/database-reset.json`, dentro del artefacto de pruebas, para
comparar la restauración con la reconstrucción y conservar avances ante un corte.

La validación en GitHub debe comprobar las nueve combinaciones, el mismo conjunto
de pruebas y los informes de cobertura. Las mediciones locales no predicen los
tiempos del runner alojado en GitHub.

Validación local de esta optimización (Node 20.20.2):

| Comprobación | Resultado |
| --- | --- |
| Compilación TypeScript, ESLint y Prettier | Correctos |
| Actionlint 1.7.7 | Correcto |
| Recolector de informes | 6 pruebas correctas |
| MySQL 8.0.32: restauración y cambios de esquema | 10 pruebas correctas |
| MariaDB 10.1: restauración, migraciones, importador y cambios de esquema | 20 pruebas correctas |

En la muestra de MySQL 8, seis restauraciones sumaron 1.506 ms (251 ms de media),
frente a 45.356 ms para tres reconstrucciones completas (15.119 ms de media).
En MariaDB, seis restauraciones sumaron 581 ms frente a 57.474 ms para ocho
reconstrucciones. Son mediciones del reinicio, no de la suite completa.

La suite completa con Node 24 / MySQL 5.7 se inició, pero su resultado final no
pudo recuperarse tras el cambio de sesión. No se considera validada. Quedan
pendientes esa ejecución completa y la matriz de GitHub Actions.

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

#### Métricas de cobertura e interpretación

| Métrica | Qué mide | Qué permite identificar |
| --- | --- | --- |
| Líneas (`lines`) | Porcentaje de líneas ejecutables recorridas durante las pruebas | Zonas del código que no se han ejecutado |
| Funciones (`functions`) | Porcentaje de funciones que se han llamado | Funciones que ninguna prueba está ejercitando |
| Ramas (`branches`) | Porcentaje de alternativas recorridas, como los caminos de un `if/else` o un ternario | Decisiones de las que solo se prueba una parte de los caminos posibles |
| Sentencias (`statements`) | Porcentaje de instrucciones ejecutadas; una línea puede contener varias instrucciones | Instrucciones sin ejecutar, con mayor detalle que el recuento por líneas |

#### Alcance de la medición

- Las pruebas se ejecutan en las nueve combinaciones de Node y base de datos.
- La cobertura se recoge únicamente en Node 22 / MySQL 8.0, como referencia inicial.
- En esa combinación, la suite se ejecuta una sola vez con la recogida de cobertura
  activada.
- En las otras ocho combinaciones, `Upload coverage evidence` aparece omitido
  intencionadamente.
- La combinación de referencia puede cambiar para alinearse con producción.
- Los caminos exclusivos de otras versiones o bases de datos pueden no aparecer
  cubiertos en este informe, aunque se ejecuten en otras combinaciones.

#### Interpretación y límites

Un 60 % de cobertura de líneas significa que las pruebas han ejecutado el 60 % de
las líneas consideradas. No significa que el código sea un 60 % correcto o seguro.

La cobertura no demuestra por sí sola que las pruebas comprueben correctamente los
resultados, que se hayan probado todas las entradas posibles o que la autenticación,
autorización y lógica de negocio sean seguras. En esta fase no se exige un porcentaje
mínimo: se establece una línea base para identificar carencias y priorizar pruebas,
especialmente en funciones críticas.

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

## 6. Fase 3 — Detección de secretos con Gitleaks

### 6.1. Objetivo y herramienta

Se incorpora Gitleaks `8.30.1` como control independiente para detectar secretos en
el historial Git introducido por cada cambio. No se añade como dependencia npm ni
se utiliza la GitHub Action comercial.

El binario oficial para Linux x64 se descarga durante el job `secrets`. La versión
y el SHA-256 esperado quedan fijados en el workflow:

```text
Versión: 8.30.1
Archivo: gitleaks_8.30.1_linux_x64.tar.gz
SHA-256: 551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb
```

El checksum se comprueba antes de extraer y ejecutar el binario. Un fallo de
descarga, integridad, instalación, determinación del rango o ejecución impide que
el job termine correctamente.

### 6.2. Configuración y alcance

`.gitleaks.toml` extiende las reglas predeterminadas incluidas en esa versión. En
esta entrega no se añaden exclusiones, allowlists ni línea base.

| Evento | Historial analizado |
| --- | --- |
| `pull_request` | Commits entre el ancestro común con la rama de destino y el SHA real de la rama origen |
| `push` | Commits comprendidos entre `before` y el SHA recibido |
| Primer push de una rama | Todo el historial alcanzable desde el SHA recibido |
| `workflow_dispatch` | Todo el historial disponible, mediante `--all` |

El checkout del job utiliza `fetch-depth: 0`. Se comprueba que los objetos Git
necesarios existen y, en PR, que puede determinarse un ancestro común. El escaneo
de PR detecta también un secreto añadido en un commit y eliminado en otro posterior:
no se limita al estado final de los archivos.

El modo `git` analiza contenido registrado en commits. Archivos locales ignorados,
artefactos de ejecución y datos no versionados no forman parte del control de PR.

### 6.3. Resultados y evidencias

Gitleaks se ejecuta con redacción completa (`--redact=100`) y sin salida detallada.
El informe completo se utiliza temporalmente para clasificar el resultado, pero se
elimina antes de subir evidencias. Esto evita publicar rutas, líneas, autores o
contexto sensible, especialmente en repositorios públicos.

El artefacto conservado contiene únicamente `reports/secrets/metadata.json`:

- commit, evento, referencia, ejecución e intento;
- versión de Gitleaks y alcance del análisis;
- estado y código de salida;
- número de coincidencias y reglas activadas;
- errores de consistencia, sin valores secretos ni ubicaciones.

El nombre del artefacto es:

```text
backend-secrets-<RUN_ID>-<ATTEMPT>
```

Se solicitan 90 días de retención. El resumen de GitHub muestra solo datos
agregados. Ante coincidencias, la reproducción local por personal autorizado debe
utilizar el mismo binario, configuración y rango para revisar el detalle.

El recolector distingue tres estados:

| Estado | Interpretación |
| --- | --- |
| `success` | Escaneo completo sin coincidencias |
| `findings` | Coincidencias que deben revisarse y tratarse |
| `error` | Informe ausente, ejecución fallida o resultado inconsistente |

Tanto `findings` como `error` bloquean el job. `backend-ci` depende ahora de
`quality`, la matriz `test` y `secrets`.

### 6.4. Revisión inicial del historial

La revisión local inicial se ejecutó sobre todo el historial disponible con Gitleaks
8.30.1, la configuración versionada y redacción completa:

```text
Commits analizados: 4567
Volumen aproximado: 62,84 MB
Coincidencias: 369
Regla: generic-api-key
```

Estas coincidencias no se consideran automáticamente secretos confirmados ni falsos
positivos. El análisis local, sin publicar valores, rutas ni contexto, permite esta
clasificación preliminar:

| Grupo | Coincidencias | Clasificación preliminar |
| --- | ---: | --- |
| Artefacto de log eliminado en 2018 | 360 | 276 valores con forma de token; requieren confirmar expiración o revocación |
| Cuatro artefactos de configuración eliminados en 2018 | 6 | Valores asociados a contraseñas o secretos; requieren revisión de seguridad |
| Fixture de prueba eliminado en 2026 | 1 | Valor de prueba con forma de token de acceso |
| Fixture de prueba vigente | 1 | Secreto determinista usado exclusivamente por una prueba de doble factor |
| Script de terceros vigente | 1 | Falso positivo provocado por concatenación de variables de shell |

Los 366 hallazgos de 2018 deben tratarse como potencialmente sensibles hasta que el
responsable confirme que nunca fueron credenciales funcionales o que están
invalidadas. Si una credencial siguiera siendo válida, se revocará o rotará;
eliminarla de la revisión actual no la elimina del historial.

No se ha creado una línea base para silenciarlas. Cualquier excepción futura deberá
ser concreta, estar justificada y ser revisable. Una ejecución manual de historial
completo seguirá fallando hasta tratar o exceptuar de manera aprobada los hallazgos.

### 6.5. Verificaciones locales

| Verificación | Resultado |
| --- | --- |
| Descarga de Gitleaks 8.30.1 y comprobación del SHA-256 | Correcta |
| Carga de `.gitleaks.toml` y revisión completa del historial | Correcta; clasificación preliminar agregada, con 366 hallazgos de 2018 pendientes de decisión de seguridad |
| Repositorio sintético con secreto añadido y eliminado en commits sucesivos | El rango detecta una coincidencia aunque el archivo final esté limpio |
| Redacción del valor sintético en el informe JSON | Correcta; el valor no aparece |
| Commit temporal con los cambios completos de la fase 3 | Escaneo incremental correcto, sin coincidencias |
| Recolector de evidencia | Cuatro pruebas correctas: limpio, hallazgo, informe ausente e inconsistencias |
| Resumen y metadatos ante hallazgo sintético | No contienen el valor secreto |
| Actionlint `1.7.7` sobre el workflow | Correcto |
| `git diff --check` | Correcto |

La revisión sintética utiliza una credencial ficticia generada exclusivamente para
validar el detector. No se ha empleado ninguna credencial funcional.

### 6.6. Cierre pendiente

- [ ] Publicar la rama y enlazar la PR y el commit de esta fase.
- [ ] Verificar un escaneo incremental limpio en GitHub Actions.
- [ ] Comprobar que `backend-ci` exige el éxito de `FWCloud-API Secrets`.
- [ ] Descargar y revisar el artefacto agregado y sus 90 días de retención efectiva.
- [ ] Confirmar que logs, resumen y artefacto no exponen valores ni contexto sensible.
- [ ] Confirmar el tratamiento de los 366 hallazgos potencialmente sensibles de 2018.
- [ ] Aprobar cualquier excepción necesaria con alcance y justificación concretos.
- [ ] Ejecutar de nuevo el historial completo y registrar el resultado aceptado.
- [ ] Registrar validación, fecha y responsable.

## 7. Pendientes transversales

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

## 8. Procedimiento de actualización del informe

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
