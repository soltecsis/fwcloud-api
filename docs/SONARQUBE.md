# Fase 7 — SonarQube Cloud en GitHub Actions

## Integración

El CI `FWCloud-API CI` instala, compila y prueba el SHA de la PR (`head.sha`) o
del push/dispatch. La celda Node 22 + MySQL 8.0 genera el LCOV existente y añade
`analysis.json` al artefacto de cobertura: metadata de pruebas, revisión,
ejecución/intento y SHA-256 de `lcov.info`. No se repiten las pruebas para Sonar.

`FWCloud-API SonarQube` se activa por `workflow_run` tras un CI exitoso. Puede
recibir el secret del repositorio destino aunque la PR proceda de un fork:

```text
PR/push → CI y LCOV sin SONAR_TOKEN → SonarQube → Quality Gate → decisión de merge
```

El workflow usa configuración y utilidades de la revisión de la rama
predeterminada que ejecuta `workflow_run`, no de la PR. Resuelve revisión/PR y
artefacto mediante la API autenticada de GitHub; rechaza resultados obsoletos,
revisiones/repositorios distintos y cobertura ausente, ambigua o expirada.
Las PR de forks pueden llegar sin `workflow_run.pull_requests`: se consulta la
asociación de commits en GitHub y se verifica la PR abierta actual. Si hay varias
PR coincidentes sin una asociación inequívoca, el análisis falla.

El checkout de fuentes es solo dato. No ejecuta npm, compilación, pruebas ni
scripts de la PR. Sustituye sus propiedades y TSConfig de Sonar por los de la
revisión confiable y rechaza symlinks en los árboles analizados. El token se
entrega únicamente a la acción oficial. Los permisos GitHub son `contents: read`,
`actions: read` y `pull-requests: read`; los checkouts no conservan credenciales.

El helper valida metadata/hash y archivos de cobertura; **no es un scanner ni un
driver de SonarQube**. La acción oficial realiza análisis y espera del gate.
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
- Exclusiones SCM deshabilitadas para que una modificación de `.gitignore` no
  oculte fuentes explícitamente incluidas.
- `tsconfig.sonar.json` no modifica el build del producto. Usa opciones compatibles
  con el compilador incorporado por el analizador; debe comprobarse la precisión
  del primer análisis, especialmente la inferencia de tipos sin dependencias
  instaladas en el workflow privilegiado. La documentación consultada declara
  TypeScript hasta 5.9.3; el proyecto compila con TypeScript 6.

## Alta e instalación en SonarQube Cloud

1. Entrar en [sonarcloud.io](https://sonarcloud.io/) mediante GitHub. No se instala
   un servidor, base de datos o Java en el equipo de desarrollo.
2. Importar la organización GitHub que recibirá las PR. Para la implantación
   formal es `soltecsis`; analizar un fork requiere un proyecto y claves propios.
3. Instalar la [GitHub App SonarQube Cloud](https://github.com/marketplace/sonarcloud)
   y autorizar únicamente los repositorios necesarios, inicialmente `fwcloud-api`.
   La instalación en una organización puede necesitar su propietario.
4. La configuración actual utiliza un **trial de Team** para analizar distintas
   ramas y PR. Confirmar la continuidad de ese alcance al finalizar el trial.
   El Free genérico solo cubre la rama principal y PR hacia ella;
   no asumir cobertura de `ENS`, `fixes`, `devel` o `auditlogs`. La visibilidad de
   código/resultados y el procesamiento en Cloud deben encajar con el sistema
   evaluado. UE es la región elegida para esta integración.
5. Importar `fwcloud-api`. Configurar **organization key** y **project key** en
   `sonar-project.properties`. Temporalmente se utilizan:

   ```properties
   sonar.organization=soltecsis-aortega
   sonar.projectKey=soltecsis-aortega_fwcloud-api
   ```

   Estas claves corresponden al proyecto de la cuenta/fork `soltecsis-aortega`.
   Para vincular el repositorio de la organización, usar las claves de su proyecto.
6. En **Administration → Analysis Method**, elegir GitHub Actions y desactivar
   **Automatic Analysis**. No combinar ambos métodos para este proyecto. El
   análisis automático no importa LCOV ni analiza ramas independientes.
7. Generar el token: preferir Scoped Organization Token limitado al proyecto si
   el plan lo ofrece. Si se usa token personal, emplear una cuenta con permisos
   mínimos de análisis. Desde **My Account → Access Tokens**, asignar nombre,
   caducidad y responsable de renovación; copiar el valor al generarlo.
8. En el **repositorio destino**, abrir **Settings → Secrets and variables → Actions**:

   | Tipo | Nombre | Valor |
   | --- | --- | --- |
   | Secret | `SONAR_TOKEN` | Token de SonarQube, equivalente funcionalmente a una API key |

   `SONAR_TOKEN` ya está generado y configurado en GitHub según lo indicado por
   el responsable. `SONAR_ORGANIZATION` y `SONAR_PROJECT_KEY` no son necesarias
   temporalmente: su validación y overrides están comentados en el workflow.
   El scanner lee las claves del archivo de propiedades confiable que se copia
   al checkout analizado. Si se vuelve a usar variables de Actions, reactivar
   conjuntamente la validación y ambos argumentos comentados.

   No se necesita un PAT de GitHub: Actions proporciona `GITHUB_TOKEN`. No usar
   `sonar.token` en archivos, argumentos, artefactos o logs. La URL Cloud está
   fijada en el workflow; no hace falta crear `SONAR_HOST_URL` en GitHub.
9. Publicar **workflow, helpers y configuración en la rama predeterminada `main`**
   para activar `workflow_run`. Mergear únicamente en `ENS` no lo activa. Preparar
   ese bootstrap antes de exigir el nuevo check. No se hacen commits/push desde
   el helper ni desde el scanner.
10. Ejecutar el CI actualizado en las ramas base, primero `main` y `ENS`, para
    obtener cobertura/análisis inicial. Configurar como ramas de larga duración
    las bases utilizadas (`main`, `ENS`, `fixes`, `devel`, `auditlogs`) según el
    plan y las opciones de Branches/Pull Requests del proyecto. Para una base sin
    trigger de push, lanzar **Run workflow** del CI seleccionando esa rama. En
    PR el código nuevo se compara con su rama destino.
11. Asignar el perfil oficial JS/TS y **Sonar way** inicialmente. Registrar perfil,
    gate y definición de código nuevo utilizados y revisar el inventario inicial.
12. Configurar y validar la protección descrita a continuación.

La falta de claves, secret, LCOV o un resultado operativo no se interpreta como
análisis exitoso. Una PR cerrada/modificada durante la espera no se analiza como
si siguiera siendo la revisión actual. Para repetir desde cero, usar **Re-run all
jobs** del CI: se exige el artefacto de la ejecución/intento seleccionado; un
rerun parcial sin regenerar la celda de cobertura no satisface esa correspondencia.

## Quality Gate y protección de merge

`sonar.qualitygate.wait=true` espera el resultado hasta 300 segundos; gate fallido,
errores o timeout fallan el workflow. No hace falta otra acción de polling. La
espera no convierte un primer análisis sin gate calculado en aceptación definitiva:
revisar la definición de código nuevo y efectuar la validación inicial.

En **GitHub → Settings → Rules → Rulesets**, para las ramas protegidas:

1. Exigir PR y los checks **`backend-ci`** y **`SonarCloud Code Analysis`** publicados
   por la GitHub App. Verificar el nombre y proveedor tras la primera ejecución.
2. Exigir ramas actualizadas antes del merge. Ahora se prueba el head de la PR,
   no el merge commit sintético: actualizar la rama con la base antes de aceptar.
3. Validar una PR que pase y otra cuyo gate falle, ambas también desde fork.

No añadir `sonar` a `backend-ci.needs`: es un workflow posterior y crearía una
dependencia circular. El check del job `workflow_run` se asocia a la rama
predeterminada; para el merge de una PR se exige el check que la App publica
sobre su revisión, no asumir que el job posterior sirve como check de esa PR.

Sonar way evalúa ratings de seguridad/fiabilidad/mantenibilidad, revisión de
hotspots, cobertura de código nuevo ≥80% y duplicación ≤3% según sus condiciones
efectivas. Sus porcentajes y excepción predeterminada para cambios de menos de
20 líneas son criterios de Sonar, **no requisitos numéricos del ENS**. Registrar
las condiciones reales; revisar también las vulnerabilidades preexistentes y
su tratamiento, aunque el gate de la PR se enfoque en código nuevo.

## Evidencia y ENS Media

El artefacto `backend-sonarqube-<RUN_ID>-<ATTEMPT>`, retenido 90 días, contiene
solo `metadata.json`: commit, PR/rama, CI productor/intento, ID de artefacto,
hashes de LCOV/configuración, revisión confiable, versiones, resultado del scanner
y referencia nativa de tarea/dashboard cuando está disponible. Fallos se registran
como `FAILED_OR_INCOMPLETE`, nunca como gate pasado. No se suben `.scannerwork`,
logs de scanner, fragmentos de issues, secretos o código mediante este artefacto.
Los hallazgos detallados se revisan en SonarQube Cloud.

La evidencia contribuye a `mp.sw.1` (desarrollo seguro) y `mp.sw.2` (aceptación y
puesta en servicio), según el análisis de riesgos y Declaración de Aplicabilidad
del [RD 311/2022](https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191). Deben
registrarse las revisiones de hotspots, falsos positivos y excepciones con motivo
y responsable, y conservar las evidencias necesarias más allá de la caducidad
de los artefactos si lo exige el procedimiento. No acredita por sí sola conformidad
ENS ni sustituye Gitleaks, Trivy, pruebas de autorización o ZAP.

## Verificación y cierre

Validación local del 2026-10-08: 16 pruebas del contexto/LCOV/configuración y
10 regresiones de reportes/política ZAP correctas (26 en total), Actionlint 1.7.7
sin errores y Gitleaks 8.30.1 sin hallazgos en el nuevo workflow y helpers/pruebas.
Implementación pendiente de alta/configuración y ejecución en Actions.
La fase se cerrará tras confirmar:

- Ramas base analizadas y TS/JS legacy incluidos sin exclusiones inesperadas.
- LCOV importado sobre fuentes originales, sin paths sin resolver.
- PR interna y de fork pasan/fallan correctamente; no se entrega el token al build.
- Token inválido, cobertura ausente o intento antiguo fallan sin falso éxito.
- Gate y check de la App bloquean realmente el merge de la revisión actual.
- Revisión inicial de hallazgos y evidencia/retención con responsable.

## Referencias oficiales

- [Alta con GitHub](https://docs.sonarsource.com/sonarqube-cloud/getting-started/github)
- [Acción oficial](https://github.com/SonarSource/sonarqube-scan-action)
- [Actions y PR desde forks](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud)
- [Cobertura JS/TS](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage)
- [Planes](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans)
- [Quality Gates](https://docs.sonarsource.com/sonarqube-cloud/standards/managing-quality-gates/introduction-to-quality-gates)
- [Check y protección de GitHub](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/administering-your-projects/devops-platform-integration/github)
