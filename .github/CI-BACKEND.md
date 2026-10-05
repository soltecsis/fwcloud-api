# Implantación progresiva del CI de FWCloud-API

## 1. Objetivo y alcance

Este documento registra las decisiones, cambios y verificaciones de la mejora del CI
de `fwcloud-api`. Se actualizará en la misma rama y PR que cada entrega, de forma
que la documentación evolucione junto con la configuración.

| Campo | Valor |
| --- | --- |
| Repositorio | `fwcloud-api` |
| Rama de trabajo actual | `testAuthSecurity` |
| Base inicial | `upstream/fixes`, commit `6e6a964c` |
| Destino actual de la PR | `ENS` |
| Ejecución del CI | GitHub Actions, runners alojados en GitHub |
| Conservación prevista de evidencias | GitHub, con visibilidad y retención por configurar |
| Última actualización | 2026-10-05 |

El informe documenta la implantación técnica. No constituye una Declaración de
Aplicabilidad completa ni acredita por sí mismo conformidad con el ENS.

### Flujo de integración acordado

```text
Rama de trabajo → PR hacia ENS → CI y validación manual
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
| 3 | Detección de secretos con Gitleaks | Validada en Actions e integrada mediante la PR #1563; revisión histórica pendiente | Alcance inicial e incremental comprobado, redacción de secretos y política de excepciones |
| 4 | SCA y SBOM con Trivy | Publicada y validada en Actions; referencias y revisión de artefactos pendientes de registro | Dependencias inventariadas, hallazgos revisados, informes y criterios de bloqueo definidos |
| 5 | Pruebas negativas de autenticación y autorización | Publicada y validada en Actions; referencias y evidencias pendientes de registro | Casos por rol/recurso, denegaciones y aislamiento documentados y ejecutados |
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

- [x] Publicar la rama y enlazar la PR y el commit de esta fase: PR #1563,
      commit `78dd3345` y merge `735e5f0a`.
- [x] Verificar un escaneo incremental limpio en GitHub Actions.
- [x] Comprobar que `backend-ci` exige el éxito de `FWCloud-API Secrets`.
- [ ] Descargar y revisar el artefacto agregado y sus 90 días de retención efectiva.
- [ ] Confirmar que logs, resumen y artefacto no exponen valores ni contexto sensible.
- [ ] Confirmar el tratamiento de los 366 hallazgos potencialmente sensibles de 2018.
- [ ] Aprobar cualquier excepción necesaria con alcance y justificación concretos.
- [ ] Ejecutar de nuevo el historial completo y registrar el resultado aceptado.
- [ ] Registrar validación, fecha y responsable.

## 7. Fase 4 — SCA y SBOM con Trivy

### 7.1. Objetivo y alcance

Se incorpora Trivy `0.74.0` para inventariar el árbol npm fijado por
`package-lock.json`, detectar vulnerabilidades conocidas y generar un SBOM
CycloneDX. El análisis incluye dependencias directas, transitivas, de ejecución,
desarrollo y opcionales detectadas por Trivy.

Esta fase analiza el repositorio asociado al commit del CI. No acredita todavía las
dependencias efectivamente incluidas en las imágenes Docker ni en los paquetes DEB y
RPM; sus procesos de construcción descargan una rama móvil y requieren una revisión
posterior de trazabilidad.

El escáner de secretos de Trivy se deshabilita expresamente para no duplicar el
control de Gitleaks. Tampoco se ejecuta `npm ci` ni ningún script de ciclo de vida
para realizar el inventario.

### 7.2. Instalación e integridad

El job `sca` descarga el archivo oficial para Linux x64 y comprueba su SHA-256 antes
de extraerlo:

```text
Versión: 0.74.0
Archivo: trivy_0.74.0_Linux-64bit.tar.gz
SHA-256: 2ae6fe3ee734b7fdf11335663e18c75ea12dccc76062f09f164a3b0f8be4371a
```

La versión ejecutada y la fecha de la base de vulnerabilidades se obtienen de
Trivy después del análisis. El recolector exige que la versión coincida con la
configurada y que exista una fecha válida de actualización de la base.

### 7.3. Línea base y remediación

La revisión inicial se realizó con Trivy 0.74.0 sobre el lockfile de la rama
`integrateTrivy`:

| Métrica inicial | Resultado |
| --- | ---: |
| Componentes npm inventariados | 630 |
| Dependencias directas / indirectas | 83 / 547 |
| Dependencias de ejecución / desarrollo | 413 / 217 |
| Vulnerabilidades `CRITICAL` | 0 |
| Vulnerabilidades `HIGH` | 1 |
| Vulnerabilidades `MEDIUM` | 2 |

El hallazgo `HIGH` correspondía a `js-yaml@4.3.1`, dependencia de desarrollo
transitiva de ESLint y Mocha. Se actualizó únicamente el lockfile a `4.3.2`, versión
corregida admitida por las restricciones existentes. Después de la actualización:

| Severidad | Resultado |
| --- | ---: |
| `CRITICAL` | 0 |
| `HIGH` | 0 |
| `MEDIUM` | 2 |
| `LOW` / `UNKNOWN` | 0 |

Los dos hallazgos `MEDIUM` de esta revisión inicial afectaban a `qs@6.15.3`,
dependencia transitiva del runtime de TSOA, y disponían de corrección en `6.16.0`.
Las restricciones transitivas de aquel lockfile no seleccionaban esa versión. Se
mantuvieron visibles sin bloquear la política inicial. La actualización posterior
de `qs` y sus dependencias superiores está registrada en 7.8. No se crearon
excepciones ni un archivo `.trivyignore`.

Como comprobación complementaria, `npm audit` pasa de un `HIGH` y tres `MODERATE` a
tres `MODERATE`. Las cantidades no tienen por qué coincidir con Trivy: las fuentes y
la forma de agrupar cadenas afectadas son diferentes.

### 7.4. Política de bloqueo

| Condición | Resultado del job |
| --- | --- |
| Vulnerabilidad `CRITICAL` o `HIGH` | Bloqueo |
| Vulnerabilidad `MEDIUM`, `LOW` o `UNKNOWN` | Se informa sin bloquear |
| Error de instalación, base de datos, escaneo o SBOM | Bloqueo |
| Informe ausente, vacío, malformado o inconsistente | Bloqueo |
| Lockfile no detectado o inventario npm vacío | Bloqueo |
| Versión de Trivy distinta de la configurada | Bloqueo |

No se utiliza `--ignore-unfixed`. También se deshabilita la carga implícita de
`.trivyignore` y `trivy.yaml` para impedir que una configuración futura silencie
hallazgos o incorpore vulnerabilidades al SBOM sin pasar por el recolector. Una
vulnerabilidad bloqueante sin corrección debe revisarse y, si procede, exceptuarse
de forma explícita, limitada, temporal y auditable. Las excepciones futuras deberán
identificar el hallazgo concreto, justificar el riesgo, indicar responsable y tener
fecha de revisión o caducidad.

### 7.5. Job y evidencias

El nuevo job `FWCloud-API SCA and SBOM` realiza:

1. checkout del commit;
2. descarga y verificación de Trivy;
3. escaneo `vuln` del árbol npm, incluyendo dependencias de desarrollo;
4. generación independiente del SBOM CycloneDX;
5. registro de versión de Trivy y base de vulnerabilidades;
6. validación cerrada mediante `scripts/trivy-report.cjs`;
7. eliminación del informe detallado de vulnerabilidades;
8. subida de evidencia agregada y del SBOM.

El artefacto se denomina:

```text
backend-sca-sbom-<RUN_ID>-<ATTEMPT>
```

Se solicitan 90 días de retención. Contiene:

```text
reports/dependencies/metadata.json
reports/dependencies/sbom.cdx.json
```

El informe detallado `trivy.json` se utiliza solo durante el job y se elimina antes
de publicar el artefacto. El resumen de Actions y `metadata.json` contienen conteos,
versiones, estado, hash SHA-256 del lockfile y metadatos de ejecución, pero no
descripciones de vulnerabilidades ni rutas detalladas.

El SBOM es CycloneDX 1.7. La generación local produjo 631 componentes totales, de
los cuales 630 son componentes npm, y 632 relaciones. El recolector comprueba que
los componentes npm coincidan con los paquetes del informe de vulnerabilidades.

`backend-ci` depende ahora de `quality`, la matriz `test`, `secrets` y `sca`. Se
mantiene su nombre para conservar estable el check utilizado por la protección de
ramas.

### 7.6. Recolector y pruebas

`scripts/trivy-report.cjs` falla ante análisis incompletos, evidencia inválida o
hallazgos bloqueantes y genera evidencia incluso cuando el resultado no es
aceptable. `scripts/trivy-report.test.cjs` cubre doce escenarios:

- análisis limpio con dependencias de ejecución y desarrollo;
- vulnerabilidad media informativa;
- vulnerabilidad alta bloqueante sin exposición de detalle;
- informe o SBOM ausente;
- error operativo de cualquiera de los dos comandos;
- inventario vacío;
- cantidades o identidades inconsistentes entre informe y SBOM;
- estructura de vulnerabilidades malformada;
- entradas nulas con conservación de metadatos de error;
- versión inesperada o metadatos de base ausentes;
- versión CycloneDX o fecha de base de vulnerabilidades inválidas.

### 7.7. Verificaciones locales

| Verificación | Resultado |
| --- | --- |
| Descarga de Trivy 0.74.0 y comprobación SHA-256 | Correcta |
| Inventario de `package-lock.json` con dependencias de desarrollo | Correcto; 630 paquetes npm |
| SBOM CycloneDX y relaciones | Correcto; 631 componentes y 632 relaciones |
| Política antes de remediar `js-yaml` | Bloqueo por un hallazgo `HIGH` |
| Política después de remediar `js-yaml` | Correcta; dos `MEDIUM` informativos |
| Pruebas de los tres recolectores | 22 pruebas correctas |
| Actionlint `1.7.7` | Correcto |
| `git diff --check` | Correcto |

### 7.8. Validación en CI y cierre

La fase 4 está publicada en `origin/integrateTrivy`. La ejecución correcta en
GitHub Actions y la integración del control en el CI fueron confirmadas por el
responsable de la entrega en esta conversación el 2026-10-02. Esta confirmación
registra la validación comunicada; las referencias a la PR y ejecución concreta
quedan pendientes de incorporación al informe.

| Entrega | Commit |
| --- | --- |
| Job SCA/SBOM, recolector y remediación inicial | `df57ae42` |
| Comandos locales, configuración compartida y actualización de dependencias | `6df43611` |

El segundo commit incorpora la remediación de los hallazgos observados durante la
validación local del lanzador, mediante actualizaciones de dependencias directas y
transitivas:

| Dependencia | Versión anterior | Versión publicada |
| --- | --- | --- |
| `joi` | `18.2.5` | `18.2.9` |
| `moment` | `2.30.1` | `2.31.0` |
| `engine.io` | `6.6.9` | `6.6.11` |
| `brace-expansion` | `1.1.18` / `2.1.4` / `5.0.9` | `1.1.21` / `2.1.7` / `5.0.12` |
| `qs` | `6.15.3` | `6.16.0` |
| `body-parser` transitivo de TSOA | `1.20.6` | `1.20.8` |
| `express` transitivo de TSOA | `4.22.2` | `4.22.3` |

La ejecución aceptada satisface la política bloqueante de 7.4. Los conteos de las
revisiones anteriores se conservan como evidencia histórica; no se presenta un
nuevo conteo sin el informe de la ejecución validada. La base de vulnerabilidades
puede introducir nuevos hallazgos en ejecuciones posteriores del mismo commit.

- [x] Publicar la rama y registrar los commits de la entrega.
- [x] Verificar `FWCloud-API SCA and SBOM` en GitHub Actions, según confirmación del responsable.
- [x] Integrar `sca` como dependencia obligatoria de `backend-ci`.
- [x] Actualizar las dependencias afectadas en `package.json` y `package-lock.json`.
- [ ] Enlazar la PR y la ejecución de Actions validada.
- [ ] Descargar y validar `metadata.json` y el SBOM CycloneDX.
- [ ] Confirmar la retención efectiva de 90 días.
- [ ] Confirmar que el informe detallado no se publica.
- [ ] Completar la identificación del responsable y las referencias de evidencia.

### 7.9. Integración local mediante Docker

Se incorporan los comandos `npm run security:scan`, `npm run security:check` y
`npm run security:sbom`, disponibles sin instalación de Trivy ni dependencias npm.
Requieren Node/npm y Docker arrancado. La [guía local](../docs/SECURITY-DEPENDENCIES.md)
describe los requisitos, informes y resolución de hallazgos.

`scripts/trivy-config.json` centraliza versión, checksum del binario, digest de la
imagen Docker, parámetros y severidades bloqueantes. `scripts/trivy-run.cjs` ejecuta
los mismos comandos mediante Docker en local y mediante el binario verificado en
Actions. El recolector consume también la política compartida.

La imagen local queda fijada como:

```text
aquasec/trivy:0.74.0@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969
```

El repositorio se monta en lectura y la salida se escribe desde Node en el
anfitrión, evitando archivos propiedad de root. La caché se conserva en el volumen
Docker `fwcloud-trivy-cache`. El análisis local conserva el JSON detallado; el CI
mantiene la eliminación previa a la publicación de artefactos.

Verificación del 2026-10-02: `security:scan` muestra 14 hallazgos (8 `HIGH`,
6 `MEDIUM`) con la base actualizada; `security:check` los bloquea y conserva la
evidencia. `security:sbom` genera correctamente el inventario CycloneDX. Estos datos
actualizan la observación del día, sin sustituir la línea base histórica de 7.3.
Estos hallazgos corresponden al lockfile anterior a la remediación publicada en
`6df43611`. Las actualizaciones posteriores y la validación correcta comunicada
del CI se registran en 7.8.

Verificaciones de esta integración:

| Verificación | Resultado |
| --- | --- |
| `security:scan` y `security:sbom` con Docker | Correctos |
| `security:check` con Docker | Código 1 por los ocho hallazgos `HIGH`, sin errores de evidencia |
| Lanzador nativo y recolector utilizados por CI | Mismos 630 paquetes y 14 hallazgos; bloqueo correcto |
| Permisos de informes locales | Escritos por el usuario del anfitrión |
| Pruebas de recolectores y lanzador | 27 pruebas correctas |
| Actionlint `1.7.7`, ESLint y Prettier del proyecto | Correctos |
| `git diff --check` | Correcto |

## 8. Fase 5 — Pruebas negativas de autenticación y autorización

### 8.1. Objetivo y entorno

La entrega parte del merge `53d7347c` de la fase 4 en `ENS` y utiliza la rama
`testAuthSecurity`. Se incorporan pruebas TypeScript para verificar rechazo de
credenciales y sesiones inválidas, permisos por rol, aislamiento de recursos y
ausencia de modificaciones no autorizadas.

La aplicación utiliza `AuthorizationTest` cuando `NODE_ENV=test`. Los nuevos casos
de seguridad delegan de forma acotada en el método real de `Authorization`, con
el contexto del middleware de pruebas y el almacén real de sesiones de Express.
Se conserva la configuración de pruebas: no se carga el entorno de producción.

`tests/utils/production-auth-harness.ts` restaura el middleware y la configuración
tras cada caso y comprueba que el handler real se ha ejecutado. Las pruebas
existentes siguen utilizando su mecanismo de sesiones sintéticas.

### 8.2. Fixtures y aislamiento

`tests/utils/security-fixtures.ts` crea cuentas sintéticas con contraseñas bcrypt
compatibles con el login real. Los casos obtienen la cookie firmada mediante
`POST /user/login`; no sustituyen el login por `attachSession`.

Los escenarios utilizan los roles admitidos por la API:

- administrador (`role: 1`), con las facultades globales actuales;
- manager (`role: 2`), con acceso mediante pertenencia a una FWCloud.

Para aislar recursos se crean dos managers, dos FWClouds, sus firewalls, tablas de
routing y rutas. Cada manager se asigna únicamente a su cloud. No se asume que
customer y FWCloud representen la misma frontera de autorización.

Los datos se restablecen antes de cada caso y al finalizar cada suite. Se generan
contraseñas, tokens y secretos TOTP exclusivamente para pruebas, sin incluir sus
valores en nombres de casos ni en las nuevas aserciones. La ejecución local utiliza
un contenedor MySQL desechable, distinto de la base habitual de desarrollo.

### 8.3. Cobertura añadida

| Suite | Casos | Comprobaciones principales |
| --- | ---: | --- |
| `authentication.e2e.spec.ts` | 18 | Login real, credenciales incorrectas, rutas protegidas, firma de cookie, sesiones eliminadas/incompletas, inactividad, logout y cuenta eliminada |
| `function-permissions.e2e.spec.ts` | 13 | Gestión de usuarios/customers, escalada de rol, permisos de cloud, funciones administrativas y cambio de contraseña propia |
| `resource-isolation.e2e.spec.ts` | 13 | Dos managers/clouds, objetos existentes ajenos, padres e hijos incompatibles, colecciones filtradas, revocación y operaciones masivas sin cambios parciales |
| `confirmation-token.e2e.spec.ts` | 7 | Token ausente, incorrecto, ajeno o anterior; token válido sin privilegios y ausencia de efectos sobre el recurso |
| `profile-tfa.e2e.spec.ts` | 9 | Propiedad de la configuración 2FA, verificación TOTP real, códigos inválidos/ausentes y actualización/borrado limitado a la cuenta actual |
| `Unit/gates/is-logged-in.spec.ts` | 4 | Rechazo de usuario nulo/indefinido o sesión ausente, y control positivo |
| **Total nuevo** | **64** | Controles positivos y negativos, con comprobación del estado persistido |

Las modificaciones y eliminaciones rechazadas se comprueban también en la base de
datos. Las pruebas masivas mezclan una ruta propia y otra existente ajena y exigen
que ninguna se modifique o elimine. Expiración y logout comprueban además la
liberación del lock asociado a la sesión.

### 8.4. Contratos HTTP

Se conservan los contratos existentes, distinguiendo la capa que rechaza:

| Control | Respuesta verificada |
| --- | --- |
| Credenciales incorrectas | `401`, `BAD_LOGIN` |
| Entrada de login malformada | `400` |
| Sesión inválida o incompleta | `400`, `SESSION_BAD` |
| Inactividad superior al límite | `400`, `SESSION_EXPIRED` |
| Gestión legacy reservada al administrador | `400`, `NOT_ADMIN_USER` |
| Cloud o firewall ajeno en acceso legacy | `400`, `ACC_FWCLOUD` / `ACC_FIREWALL` |
| Política o gate nuevo sin permisos | `401` |
| Token de confirmación inválido | `403` |
| Recurso ajeno mezclado con un padre distinto | `404` |

Las peticiones de autorización utilizan datos válidos y un token de confirmación
correcto cuando corresponde, para alcanzar el control de permisos. El caso de
creación de usuario utiliza también cifrado PGP válido para la sesión.

### 8.5. Fallos reproducidos y corregidos

1. **Gate `isLoggedIn`:** su condición con `OR` admitía usuarios nulos e indefinidos,
   y una sesión ausente provocaba una excepción. Se reemplaza por una comprobación
   segura de presencia de usuario. Las cuatro pruebas unitarias verifican el
   comportamiento, además de las denegaciones HTTP con el middleware real.
2. **Setup 2FA de otra cuenta:** el endpoint de perfil admitía un `body.user` ajeno.
   Ahora exige el usuario de la sesión y persiste la configuración antes de
   devolver éxito, eliminando el callback asíncrono no esperado.
3. **Verificación 2FA de otra cuenta:** se aceptaba un secreto temporal ajeno y un
   código válido. El controlador verifica la pertenencia del setup y el servicio
   limita el `UPDATE` por usuario además del secreto temporal. Una regresión con
   el mismo secreto en dos cuentas comprueba esa limitación de la actualización.

Las pruebas existentes del perfil pasan a utilizar códigos TOTP reales y fixtures
independientes, eliminando el stub global de verificación y las dependencias de
orden entre casos. Las suites de perfil fijan y restauran únicamente `Date` para
evitar fallos aleatorios al cambiar de ventana TOTP, manteniendo los temporizadores
de E/S reales. La suite existente de tokens restaura la configuración tras cada
prueba para evitar contaminación de otras suites.

### 8.6. Ejecución e integración en CI

El nuevo comando local reconstruye la aplicación y ejecuta los 64 casos:

```bash
npm run test:security
```

Se debe configurar una base desechable: el setup de pruebas reconstruye y carga
datos en la base seleccionada por `TYPEORM_*`. No deben utilizarse datos operativos.
La suite comparte aplicación, base de datos y almacén de sesiones y se ejecuta en
serie, sin el modo paralelo de Mocha.

`test:ci` y `test:coverage:ci` descubren automáticamente los nuevos `*spec.js` tras
el build. Los casos forman parte de la matriz existente de Node 20/22/24 y
MySQL/MySQL8/MariaDB, sus informes JUnit y la cobertura de referencia.
`backend-ci` ya exige el éxito de `test`, por lo que los fallos de esta fase bloquean
el check agregado sin añadir un job ni repetir la suite en el workflow.

### 8.7. Verificaciones locales

| Verificación | Resultado |
| --- | --- |
| Build TypeScript | Correcto |
| `test:security` con Node 20.20.2 y MySQL 8.0.46 desechable | 64 pruebas correctas |
| Casos nuevos junto a suites existentes de perfil y tokens, con reporteros de CI | 80 pruebas correctas |
| Suites de perfil tras estabilizar la ventana TOTP | 20 pruebas correctas |
| Validación enfocada adicional con reporteros de CI | 82 pruebas correctas |
| Recolector de JUnit y resultados de la última ejecución enfocada | Evidencia completa; 82 correctas, 0 fallos y 0 pendientes |
| Regresiones de gate y propiedad 2FA antes de corregir | Fallos reproducidos |
| ESLint y Prettier | Correctos |
| Gitleaks 8.30.1 sobre las suites y fixtures nuevos de seguridad | Sin hallazgos |
| `git diff --check` | Correcto |
| Suite completa local | Incompleta por límite de ejecución de 15 minutos; no acredita el resultado completo |
| Ampliación local a más suites de API | Incompleta por límite de ejecución de 6 minutos |

Las ejecuciones ampliadas se registran como incompletas, no como validaciones
correctas de toda la API. La validación posterior en Actions se registra en 8.9,
separada de estos resultados locales.

### 8.8. Límites y requisitos pendientes

- La cobertura es representativa de los mecanismos y recursos indicados; no
  acredita automáticamente todas las rutas de la API ni WebSockets.
- Se verifica el 2FA personal del perfil. La obligatoriedad del 2FA persistido
  durante el login requiere concretar su contrato y revisar su enlace con la sesión;
  esta entrega no acredita esa obligatoriedad.
- No se redefine la duración, consumo único ni vinculación por sesión de los tokens
  de confirmación; las pruebas verifican el mecanismo actual por usuario.
- Políticas de cuentas deshabilitadas, restricciones por IP y revocación global de
  sesiones tras cambio de contraseña requieren requisitos específicos.
- El DAST y el laboratorio desplegado corresponden a la fase 6.

### 8.9. Validación en CI y cierre

La fase 5 está publicada en `origin/testAuthSecurity`. La ejecución correcta en
GitHub Actions y la comprobación de sus resultados fueron confirmadas por el
responsable de la entrega en esta conversación el 2026-10-05. Se registra esta
validación comunicada; las referencias a la PR y a la ejecución concreta quedan
pendientes de incorporación al informe.

| Entrega | Commit |
| --- | --- |
| Pruebas de autenticación, autorización y aislamiento; endurecimiento de gate y perfil 2FA | `19802b5d` |
| Última revisión publicada y validada | `d0489910` |

Los resultados locales de 8.7 se conservan como evidencia histórica y no se
presentan como conteos de la ejecución de Actions. Los límites y requisitos de
8.8 siguen identificados para posteriores entregas.

- [x] Publicar la rama y registrar los commits de la entrega.
- [x] Completar la matriz en Actions, según confirmación del responsable.
- [x] Comprobar los resultados de CI, según confirmación del responsable.
- [ ] Enlazar la PR y la ejecución de Actions validada.
- [ ] Verificar la inclusión de las suites de seguridad en JUnit y cobertura.
- [ ] Confirmar que un fallo de seguridad bloquea `backend-ci`.
- [ ] Registrar la revisión de las correcciones de gate y propiedad 2FA.
- [ ] Completar la identificación del responsable y las referencias de evidencia.

## 9. Pendientes transversales

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

## 10. Procedimiento de actualización del informe

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
