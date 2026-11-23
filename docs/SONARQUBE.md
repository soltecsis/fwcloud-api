# Fase 7 — SonarQube Cloud en GitHub Actions

## Estado actual

Estado de la integración oficial (2026-10-16): el responsable confirma que los cambios
están desplegados en CI y conectan con SonarQube Cloud. La importación del LCOV,
el resultado del Quality Gate, la protección efectiva del merge y el rerun parcial
siguen pendientes de verificar y documentar. El registro de entregas, evidencias
y cierre se mantiene en el apartado 10.4 de [CI-BACKEND.md](../.github/CI-BACKEND.md).

El ajuste posterior de simplificación de helpers (apartado 11 del registro) está
implementado y validado localmente, pendiente de despliegue en Actions. Incluye
`scripts/ci-context.cjs` para compartir contexto y publicación de evidencia;
conserva las validaciones de cobertura y la política de reruns descritas aquí.

El análisis previo al merge desde forks personales reutiliza el proyecto oficial
y un token limitado que permanece en `soltecsis/fwcloud-api`. Su activación y
validación en GitHub Actions y SonarQube Cloud están pendientes.

## Integración

El CI `FWCloud-API CI` instala, compila y prueba el SHA de la PR (`head.sha`) o
del push/dispatch. La celda Node 22 + MySQL 8.0 genera el LCOV existente y añade
`analysis.json` al artefacto de cobertura: pruebas, revisión, datos de la PR,
ejecución/intento y SHA-256 de `lcov.info`. No se repiten las pruebas para Sonar.

El job **`FWCloud-API SonarQube`** está dentro de `.github/workflows/nodejs.yml` y
depende de `quality`, `test`, `secrets`, `sca` y `dast`. Se ejecuta después de que
estos jobs pasen y `backend-ci` comprueba también su resultado:

```text
PR del fork a fixes → CI sin secreto Sonar → LCOV de esa ejecución
                    → workflow central → SonarQube oficial → gate del SHA de la PR
Push en fixes / PR interna → CI con SonarQube en el mismo workflow
```

El job del mismo workflow funciona en `fixes` sin publicar previamente archivos
en `main`. Usa la configuración y fuentes del mismo checkout. El análisis de
PR de forks sí usa un `workflow_run` independiente, que debe estar en la rama
predeterminada. Ambos consumen el artefacto por su nombre estable por `run_id`:
`backend-coverage-node22-mysql8-<RUN_ID>`. La publicación usa `overwrite: true`:
si se repite la celda de cobertura, reemplaza el artefacto de esa misma ejecución;
si solo se repite otro job, se conserva el artefacto ya publicado.

| Evento | SonarQube | Resultado exigido por `backend-ci` |
| --- | --- | --- |
| Push a `main` o `fixes` en el repositorio oficial, salvo actor Dependabot | En el mismo workflow | `success` |
| PR entre ramas del repositorio oficial hacia `main`, `devel`, `fixes` o `auditlogs`, salvo autor o actor Dependabot | En el mismo workflow | `success` |
| Ejecución manual del CI oficial, salvo actor Dependabot | En el mismo workflow | `success` |
| PR de un fork a `soltecsis/fwcloud-api:fixes`, salvo autor o actor Dependabot | Solo en el workflow central, tras éxito del CI | `skipped` en el CI de origen |
| Otras PR entre repositorios, ejecuciones dentro de forks o de Dependabot | Omitido | `skipped`, con motivo en el resumen |

En las PR externas siguen siendo obligatorios todos los controles anteriores.
El proyecto oficial sigue analizando también el push posterior al merge en
`fixes`. Un token ausente en una ejecución elegible falla.

El job no reinstala dependencias ni repite build/pruebas. Rechaza symlinks en los
árboles analizados, usa `contents: read` y no conserva credenciales en su checkout.
El valor del token se entrega únicamente al paso de la acción oficial.

El helper valida metadata/hash y archivos de cobertura; **no es un scanner ni un
driver de SonarQube**. La acción oficial realiza análisis y espera del gate.
El contexto compartido obtiene el SHA del checkout con Git y lo contrasta con
`ANALYSIS_COMMIT`; no utiliza el merge sintético de `GITHUB_SHA` para etiquetar
las evidencias. La suite `npm run test:ci-tools` conserva las regresiones de Sonar
y c8 y los `.cjs` quedan incluidos en los checks de ESLint/Prettier del CI.
El hash vincula los bytes del artefacto, no certifica por sí mismo la veracidad de
pruebas o cobertura generadas por código de una PR: su revisión sigue siendo parte
del control de cambios.

## Herramientas y alcance

- Acción oficial v8.3.0:
  `SonarSource/sonarqube-scan-action@d209202bc7d53ff1cc128f7f907dac145c9d6ae9`.
- SonarScanner CLI `8.1.0.6389`, con verificación de firma habilitada.
- Cloud UE: `https://sonarcloud.io`.
- Fuentes `src/`: TypeScript **y JavaScript legacy**. Declaraciones `.d.ts` excluidas.
- Pruebas `tests/` identificadas separadamente.
- `reports/coverage/lcov.info`: rutas relativas a fuentes originales, no `dist/`.
- c8 filtra antes del remapeo y captura `dist/src/**/*.js` además de las fuentes
  originales. Sus source maps mantienen la atribución a `src/`; las dependencias
  quedan excluidas antes de que sus mapas puedan introducir rutas de otras fuentes.
- Exclusiones SCM deshabilitadas para que una modificación de `.gitignore` no
  oculte fuentes explícitamente incluidas.
- `tsconfig.sonar.json` no modifica el build del producto. La precisión y
  compatibilidad siguen pendientes de revisar en los resultados del analizador,
  especialmente la inferencia de tipos sin dependencias instaladas en el job de
  análisis. La documentación consultada durante la implantación declara
  TypeScript hasta 5.9.3; el proyecto compila con TypeScript 6.

## Alta e instalación en SonarQube Cloud

Este procedimiento describe cómo reproducir o migrar la configuración. El
despliegue y la conexión ya están confirmados; el estado de aceptación figura
en «Estado actual» y en el registro de CI-BACKEND.md.

1. Entrar en [sonarcloud.io](https://sonarcloud.io/) mediante GitHub. No se instala
   un servidor, base de datos o Java en el equipo de desarrollo.
2. Configurar la integración con la organización GitHub que recibirá las PR.
   Para el repositorio principal es `soltecsis`. La vinculación efectiva del
   proyecto y la decoración de PR siguen pendientes de verificar.
3. Instalar la [GitHub App SonarQube Cloud](https://github.com/marketplace/sonarcloud)
   y autorizar únicamente los repositorios necesarios, inicialmente `fwcloud-api`.
   La instalación en una organización puede necesitar su propietario.
4. La organización utiliza el plan **Team** para analizar distintas ramas y PR.
   El Free genérico solo cubre la rama principal y PR hacia ella;
   no asumir cobertura de `fixes`, `devel` o `auditlogs` en ese plan. La
   visibilidad de código/resultados y el procesamiento en Cloud deben encajar con
   el sistema evaluado. UE es la región elegida para esta integración.
5. Importar `fwcloud-api`. Los identificadores oficiales se leen de
   `sonar-project.properties`:

   ```properties
   sonar.organization=soltecsis
   sonar.projectKey=soltecsis_fwcloud-api
   ```

6. En **Administration → Analysis Method**, elegir GitHub Actions y desactivar
   **Automatic Analysis**. No combinar ambos métodos para este proyecto. El
   análisis automático no importa LCOV ni analiza ramas independientes.
7. Generar el token: preferir Scoped Organization Token limitado al proyecto si
   el plan lo ofrece. Si se usa token personal, emplear una cuenta con permisos
   mínimos de análisis. Desde **My Account → Access Tokens**, asignar nombre,
   caducidad y responsable de renovación; copiar el valor al generarlo.
8. En el **repositorio oficial**, abrir
   **Settings → Secrets and variables → Actions → Repository secrets**:

   | Tipo | Nombre | Valor |
   | --- | --- | --- |
   | Secret | `SONAR_TOKEN` | Token de SonarQube, equivalente funcionalmente a una API key |

   También puede utilizarse un secret de organización limitado al repositorio
   oficial. No copiar este token a los forks. El workflow oficial lee los
   identificadores de la configuración versionada, no de variables de Actions.

   No se necesita un PAT de GitHub: Actions proporciona `GITHUB_TOKEN`. No usar
   `sonar.token` en archivos, argumentos, artefactos o logs. La URL Cloud está
   fijada en el workflow; no hace falta crear `SONAR_HOST_URL` en GitHub.
9. Integrar **CI, helper y configuración en `fixes`** y lanzar un push a esa rama.
   El job aparecerá dentro de `FWCloud-API CI` tras pasar los jobs previos. No es
   necesario integrar primero en `main`. Para usar **Run workflow** desde la UI,
   GitHub puede exigir que el workflow manual ya esté registrado en la rama
   predeterminada; el push a `fixes` no tiene ese requisito.
10. Ejecutar el CI actualizado en las ramas base para
     obtener cobertura/análisis inicial. Configurar como ramas de larga duración
     las bases utilizadas (`main`, `fixes`, `devel`, `auditlogs`) según el
      plan y las opciones de Branches/Pull Requests del proyecto. Para una base sin
      trigger de push, lanzar **Run workflow** del CI seleccionando esa rama. En
      PR el código nuevo se compara con su rama destino.
11. Asignar el perfil oficial JS/TS y **Sonar way** inicialmente. Registrar perfil,
    gate y definición de código nuevo utilizados y revisar el inventario inicial.
12. Configurar y validar la protección descrita a continuación.

La falta de claves, secret, LCOV o un resultado operativo no se interpreta como
análisis exitoso. Se admiten reruns parciales: la cobertura puede proceder de un
intento anterior de la **misma ejecución y commit**, con intento productor entero
positivo y no posterior al análisis. Se mantienen repositorio/evento, pruebas
correctas de Node 22/MySQL 8.0 y SHA-256 exacto del LCOV. No se buscan artefactos
de otras ejecuciones ni se acepta un intento futuro o inválido.

Para regenerar la cobertura, usar **Re-run all jobs** o repetir la celda productora.
Si se cambia el código, iniciar una ejecución sobre el nuevo commit. Un rerun
conserva la revisión y workflow originales: la primera ejecución con este ajuste
debe iniciarse con el CI actualizado. Las ejecuciones anteriores con nombres
terminados en `-<ATTEMPT>` siguen necesitando su procedimiento anterior.

## Quality Gate antes del merge desde un fork

1. Vincular el proyecto **existente** `soltecsis_fwcloud-api` a
   `soltecsis/fwcloud-api` y comprobar que la GitHub App tiene acceso para
   publicar el check. Mantener **Automatic Analysis** desactivado y `fixes`
   analizada como rama de larga duración. No crear proyectos adicionales.
2. En **Administration → Scoped Organization Tokens**, crear un token con
   caducidad: **Specific projects → `soltecsis_fwcloud-api` → Execute analysis**.
   Guardarlo solo en `soltecsis/fwcloud-api` como secreto de Actions
   **`SONAR_PR_ANALYSIS_TOKEN`**. El CI de pushes y PR internas conserva su
   secreto `SONAR_TOKEN`. No copiar ni compartir el nuevo token con los forks.
3. Publicar `.github/workflows/sonarqube-fork-pr.yml`, los scripts `sonar-fork-pr.cjs`,
   `extract-sonar-coverage.py`, `sonar-analysis.cjs`, `ci-context.cjs` y las dos
   configuraciones Sonar (`sonar-project.properties`, `tsconfig.sonar.json`)
   en la **rama predeterminada del repositorio oficial** (`main`). Sin este paso,
   GitHub no dispara el `workflow_run`, aunque exista en `fixes`. El CI productor
   actualizado (`nodejs.yml`) también debe estar disponible para PR hacia `fixes`.
   La rama destino de las PR de los desarrolladores no cambia.
4. Abrir o actualizar una PR desde un fork personal a `soltecsis/fwcloud-api:fixes`.
   No hace falta habilitar Actions, crear una segunda PR ni configurar secretos
   o variables en el fork. Usar una ejecución nueva con el productor actualizado:
   los artefactos anteriores no contienen los campos adicionales de la PR.
5. Verificar que **FWCloud-API Fork SonarQube** se ejecuta tras un CI correcto,
   importa LCOV en el proyecto oficial y asocia el Quality Gate y la cobertura
   con el **SHA actual** de la PR. Probar un fallo de cobertura, añadir pruebas
   y verificar que el gate pasa en el nuevo SHA sin hacer merge. Si cambia la
   base durante la preparación, volver a lanzar el CI.

El workflow central resuelve la PR abierta contra `fixes` por la API de GitHub
y cruza repositorio, rama y SHA con el `workflow_run`. Descarga solo el
artefacto LCOV de la ejecución identificada, verifica su digest y extrae solo
`analysis.json` y `lcov.info`. El checkout de la PR contiene `src/`, `tests/` y el
historial Git. Los scripts y configuraciones vienen de la revisión de confianza
del workflow; **no se ejecutan tests, scripts, dependencias ni configuración del
fork** en el job con acceso al secreto. El hash no demuestra por sí solo que el
fork no haya manipulado los datos de cobertura; la revisión de la PR sigue siendo
necesaria. Quitar los proyectos y tokens del piloto por fork si se llegaron a usar.

## Quality Gate y protección de merge

`sonar.qualitygate.wait=true` espera el resultado hasta 300 segundos; gate fallido,
errores o timeout fallan el workflow. No hace falta otra acción de polling. La
espera no convierte un primer análisis sin gate calculado en aceptación definitiva:
revisar la definición de código nuevo y efectuar la validación inicial.

La configuración efectiva y su comportamiento bloqueante siguen pendientes de
verificar. En **GitHub → Settings → Rules → Rulesets**, para las ramas protegidas,
debe exigirse lo siguiente:

1. Mantener **`backend-ci`** obligatorio. En PR externas no incluye el resultado
   del workflow central. Si se quiere bloquear el merge también por Sonar, validar
   primero que **`SonarCloud Code Analysis`** se publica en el SHA correcto y
   configurar el check nativo de la App en el ruleset de `fixes`. No exigir el
   nombre del job de `workflow_run`: se ejecuta en la rama predeterminada.
   Antes de hacerlo obligatorio, acordar el tratamiento de Dependabot, que sigue
   excluido del análisis.
2. Exigir ramas actualizadas antes del merge. Ahora se prueba el head de la PR,
   no el merge commit sintético: actualizar la rama con la base antes de aceptar.
3. Validar el gate en PR interna y en PR de un fork a `fixes`. Verificar que el
   flujo oficial de push sigue analizando tras el merge.

`backend-ci.needs` incluye `sonar` en el mismo DAG, sin dependencia circular.
Fuera de las excepciones de forks, PR externas y Dependabot, un estado `failure`,
`cancelled` o `skipped` de Sonar falla el gate agregado. La excepción no permite
ignorar errores en los demás jobs. El push posterior a `fixes` también tiene que
pasar Sonar antes de promover el código hacia despliegue.

**Sonar way** es el gate inicial recomendado; el perfil, gate y definición de
código nuevo efectivos deben registrarse y verificarse en SonarQube Cloud.
Sonar way evalúa ratings de seguridad/fiabilidad/mantenibilidad, revisión de
hotspots, cobertura de código nuevo ≥80% y duplicación ≤3% según sus condiciones
efectivas. Sus porcentajes y excepción predeterminada para cambios de menos de
20 líneas son criterios de Sonar, **no requisitos numéricos del ENS**. Registrar
las condiciones reales; revisar también las vulnerabilidades preexistentes y
su tratamiento, aunque el gate de la PR se enfoque en código nuevo.

## Evidencia y ENS Media

Los artefactos `backend-sonarqube-<RUN_ID>-<ATTEMPT>` y
`backend-sonarqube-fork-<RUN_ID>-<ATTEMPT>` solicitan 90 días de retención.
Contienen solo `metadata.json`: proyecto, commit, PR/rama, base, ejecución e
intento del CI (`runAttempt`), intento productor de cobertura (`coverageRunAttempt`),
hashes de LCOV/configuración, versiones, resultado del scanner
y referencia nativa de tarea/dashboard cuando está disponible. Fallos se registran
como `FAILED_OR_INCOMPLETE`, nunca como gate pasado. No se suben `.scannerwork`,
logs de scanner, fragmentos de issues, secretos o código mediante este artefacto.
Los hallazgos detallados se revisan en SonarQube Cloud.
El flujo central registra además la ejecución de Sonar (`sonarRunId` y
`sonarRunAttempt`) y el ID del artefacto LCOV consumido. El artefacto de evidencia
se genera si llega a intentarse el paso del scanner. Un fallo
previo, por ejemplo al descargar o validar cobertura, falla el job sin generar
ese artefacto de Sonar.

La evidencia contribuye a `mp.sw.1` (desarrollo seguro) y `mp.sw.2` (aceptación y
puesta en servicio), según el análisis de riesgos y Declaración de Aplicabilidad
del [RD 311/2022](https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191). Deben
registrarse las revisiones de hotspots, falsos positivos y excepciones con motivo
y responsable, y conservar las evidencias necesarias más allá de la caducidad
de los artefactos si lo exige el procedimiento. No acredita por sí sola conformidad
ENS ni sustituye Gitleaks, Trivy, pruebas de autorización o ZAP.

## Verificación y cierre

### Corrección de `ENOENT: lstat src/container.ts`

El fallo se reprodujo con Node 22: el mapa de `node_modules/typeorm/container.js`
apunta a `../../src/container.ts`, que se resuelve en una ruta inexistente del
proyecto. Con `exclude-after-remap: true`, c8 llegaba a incluirla en el LCOV.
Se corrige en `.github/c8.json` filtrando antes del remapeo y admitiendo el código
compilado de `dist/src/` como entrada. No se elimina la validación de fuentes ni
se descartan silenciosamente registros del LCOV; un archivo ausente ahora se
identifica con un error controlado y la indicación de regenerar la cobertura.

`scripts/c8-scope.test.cjs` usa TypeScript y c8 reales, junto con el código/mapa
instalados de TypeORM, y verifica aciertos TS/JS, fuentes no ejecutadas con cero
y ausencia de rutas fantasma o dependencias. Se ejecuta también en el job de
calidad. En la validación local de esta corrección pasaron 18 pruebas de cobertura,
Sonar y reportes con Node 22, además de Actionlint y Gitleaks sobre los helpers
revisados. Es un resultado histórico, distinto del ajuste posterior de reruns
validado con 20 pruebas.

La corrección requiere generar un nuevo LCOV y su hash con el CI actualizado,
repitiendo el productor o todo el CI. Repetir solo Sonar sobre el mismo commit
reutiliza la cobertura disponible y no corrige un LCOV que ya fuera inválido.
La importación efectiva sigue pendiente de revisar en el análisis desplegado;
los porcentajes pueden cambiar al corregir el alcance de la cobertura.

### Corrección de artefactos ausentes en reruns parciales

En la ejecución `38576086191` existía cobertura del intento 1, pero Sonar buscaba
un nombre terminado en `-2` tras repetirse solo otro job de la matriz. El nombre
estable por ejecución evita esa búsqueda de un artefacto que no se regeneró.
El productor conserva su intento original dentro de `analysis.json`; los informes
Sonar y de pruebas siguen separados por intento. Solo se reemplaza el archivo de
cobertura de esa ejecución cuando el job productor vuelve a publicar.

Las regresiones verifican reutilización de intento 1 en análisis 2, trazabilidad
de ambos intentos y rechazo de otra ejecución/revisión, intentos inválidos/futuros,
pruebas fallidas y hashes alterados. La prueba de política comprueba publicación
y descarga con el mismo nombre y `overwrite: true` únicamente en la cobertura.
Validación local: 20 pruebas de cobertura nativa, Sonar y reportes correctas con
Node 22, Actionlint sin errores y Gitleaks sin hallazgos en los helpers/pruebas.
El CI actualizado ya está desplegado según la confirmación del responsable.
La reutilización real de cobertura en un rerun parcial sigue pendiente de
comprobar en Actions.

### Validación de la integración

La arquitectura anterior usaba `workflow_run`, lo que impedía su activación si
solo se integraba en `ENS`. Se ha sustituido por el job del mismo CI y eliminado
el workflow separado. Validación local: 10 pruebas Sonar y 12 regresiones de
reportes/política/diagnósticos ZAP correctas (22 en total). Son verificaciones
históricas de la implantación local: el despliegue y la conexión con SonarQube
ya están confirmados, mientras que el Quality Gate sigue pendiente de verificar.
Actionlint 1.7.7 valida el workflow y Gitleaks 8.30.1 no detecta secretos en el
workflow y los helpers/pruebas modificados.
Los pendientes de aceptación, alineados con el apartado 10.4 de CI-BACKEND.md, son:

- Enlazar commit/PR exactos, ejecución de Actions y análisis de SonarQube desplegados.
- Vinculación del proyecto oficial con el repositorio y decoración de PR.
- Ramas base analizadas y TS/JS legacy incluidos sin exclusiones inesperadas.
- LCOV importado sobre fuentes originales, sin paths sin resolver.
- Precisión y compatibilidad del analizador con TypeScript 6 y el alcance configurado.
- Rerun parcial que reutilice cobertura de un intento anterior válido de la misma
  ejecución y revisión, con trazabilidad de productor y consumidor.
- PR interna pasa/falla según Sonar; en PR externa el token no se usa y los demás
  gates siguen siendo obligatorios; al integrar, el push vuelve a exigir Sonar.
- Token inválido, cobertura ausente/alterada, contexto de otra ejecución/revisión
  o intento inválido/futuro fallan sin falso éxito. Un intento productor anterior
  válido de la misma ejecución y revisión sí se acepta.
- `backend-ci` bloquea realmente fallos de Sonar en los eventos elegibles.
- Revisión inicial de hallazgos y evidencia/retención con responsable.

## Referencias oficiales

- [Alta con GitHub](https://docs.sonarsource.com/sonarqube-cloud/getting-started/github)
- [Acción oficial](https://github.com/SonarSource/sonarqube-scan-action)
- [Actions y PR desde forks](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud)
- [Scoped Organization Tokens](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-organization/scoped-organization-tokens)
- [Cobertura JS/TS](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage)
- [Planes](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans)
- [Quality Gates](https://docs.sonarsource.com/sonarqube-cloud/standards/managing-quality-gates/introduction-to-quality-gates)
- [Check y protección de GitHub](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/administering-your-projects/devops-platform-integration/github)
