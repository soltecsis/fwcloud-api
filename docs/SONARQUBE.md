# Fase 7 — SonarQube Cloud en GitHub Actions

## Integración

El CI `FWCloud-API CI` instala, compila y prueba el SHA de la PR (`head.sha`) o
del push/dispatch. La celda Node 22 + MySQL 8.0 genera el LCOV existente y añade
`analysis.json` al artefacto de cobertura: metadata de pruebas, revisión,
ejecución/intento y SHA-256 de `lcov.info`. No se repiten las pruebas para Sonar.

El job **`FWCloud-API SonarQube`** está dentro de `.github/workflows/nodejs.yml` y
depende de `quality`, `test`, `secrets`, `sca` y `dast`. Se ejecuta después de que
estos jobs pasen y `backend-ci` comprueba también su resultado:

```text
Push / PR interna → calidad, matriz, secretos, SCA y DAST → SonarQube → backend-ci
PR externa        → calidad, matriz, secretos, SCA y DAST → sonar omitido → backend-ci
Merge en ENS      → push a ENS → CI completo, incluido SonarQube
```

Funciona desde `ENS` sin publicar previamente archivos en `main`. Utiliza la
configuración, helper y fuentes de la misma revisión analizada. No hay
`workflow_run`, workflow posterior, consultas a la API de GitHub ni checkout de la
rama predeterminada. Los argumentos de rama/PR se toman del contexto de esta
ejecución y la cobertura se descarga por nombre exacto, incluido intento.

| Evento | SonarQube | Resultado exigido por `backend-ci` |
| --- | --- | --- |
| Push a `main`, `fixes`, `ENS` | Sí, tras pasar los jobs previos | `success` |
| PR entre ramas del mismo repositorio | Sí, tras pasar los jobs previos | `success` |
| Ejecución manual del CI | Sí, salvo actor Dependabot | `success` |
| PR desde otro repositorio/fork o ejecución de Dependabot | Omitido: GitHub no entrega el token | `skipped`, con motivo en el resumen |

En las PR externas siguen siendo obligatorios todos los controles anteriores.
El análisis se realiza tras integrar el código y dispararse el push en una rama
configurada, por ejemplo `ENS`. Esta modalidad no acredita SAST previo al merge
de una PR externa. Un token ausente en una ejecución elegible falla; no habilita
la excepción de forks/Dependabot.

El job no reinstala dependencias ni repite build/pruebas. Rechaza symlinks en los
árboles analizados, usa `contents: read` y no conserva credenciales en su checkout.
`SONAR_TOKEN` se entrega únicamente al paso de la acción oficial.

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
  instaladas en el job de análisis. La documentación consultada declara
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
   temporalmente: los overrides están comentados en el job de SonarQube.
   El scanner lee las claves del archivo de propiedades del checkout analizado.
   Si se vuelve a usar variables de Actions, añadir su validación y reactivar
   ambos argumentos comentados.

   No se necesita un PAT de GitHub: Actions proporciona `GITHUB_TOKEN`. No usar
   `sonar.token` en archivos, argumentos, artefactos o logs. La URL Cloud está
   fijada en el workflow; no hace falta crear `SONAR_HOST_URL` en GitHub.
9. Integrar **CI, helper y configuración en `ENS`** y lanzar un push a esa rama.
   El job aparecerá dentro de `FWCloud-API CI` tras pasar los jobs previos. No es
   necesario integrar primero en `main`. Para usar **Run workflow** desde la UI,
   GitHub puede exigir que el workflow manual ya esté registrado en la rama
   predeterminada; el push a `ENS` no tiene ese requisito.
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
análisis exitoso. Para repetir desde cero, usar **Re-run all jobs** del CI: se
exige el artefacto de la misma ejecución/intento; un rerun parcial de Sonar sin
regenerar la celda de cobertura no satisface esa correspondencia.

## Quality Gate y protección de merge

`sonar.qualitygate.wait=true` espera el resultado hasta 300 segundos; gate fallido,
errores o timeout fallan el workflow. No hace falta otra acción de polling. La
espera no convierte un primer análisis sin gate calculado en aceptación definitiva:
revisar la definición de código nuevo y efectuar la validación inicial.

En **GitHub → Settings → Rules → Rulesets**, para las ramas protegidas:

1. Exigir PR y el check **`backend-ci`**, que ahora incluye el resultado de Sonar.
   Para aceptar PR externas no exigir globalmente `SonarCloud Code Analysis`
   ni el job Sonar como checks separados: se omiten en esas PR por falta de token.
   La integración de la App puede seguir mostrando resultados en las PR internas.
2. Exigir ramas actualizadas antes del merge. Ahora se prueba el head de la PR,
   no el merge commit sintético: actualizar la rama con la base antes de aceptar.
3. Validar una PR interna que pase y otra cuyo gate falle. Comprobar la omisión
   explícita en PR externa y el análisis completo del push tras integrarla.

`backend-ci.needs` incluye `sonar` en el mismo DAG, sin dependencia circular.
Fuera de la excepción explícita de forks/Dependabot, un estado `failure`,
`cancelled` o `skipped` de Sonar falla el gate agregado. La excepción no permite
ignorar errores en los demás jobs. El push posterior a `ENS` también tiene que
pasar Sonar antes de promover el código hacia despliegue.

Sonar way evalúa ratings de seguridad/fiabilidad/mantenibilidad, revisión de
hotspots, cobertura de código nuevo ≥80% y duplicación ≤3% según sus condiciones
efectivas. Sus porcentajes y excepción predeterminada para cambios de menos de
20 líneas son criterios de Sonar, **no requisitos numéricos del ENS**. Registrar
las condiciones reales; revisar también las vulnerabilidades preexistentes y
su tratamiento, aunque el gate de la PR se enfoque en código nuevo.

## Evidencia y ENS Media

El artefacto `backend-sonarqube-<RUN_ID>-<ATTEMPT>`, retenido 90 días, contiene
solo `metadata.json`: commit, PR/rama, ejecución/intento,
hashes de LCOV/configuración, versiones, resultado del scanner
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

La arquitectura anterior usaba `workflow_run`, lo que impedía su activación si
solo se integraba en `ENS`. Se ha sustituido por el job del mismo CI y eliminado
el workflow separado. Validación local: 10 pruebas Sonar y 12 regresiones de
reportes/política/diagnósticos ZAP correctas (22 en total). La activación real y el
Quality Gate requieren validación en Actions con el secret configurado.
Actionlint 1.7.7 valida el workflow y Gitleaks 8.30.1 no detecta secretos en el
workflow y los helpers/pruebas modificados.
La fase se cerrará tras confirmar:

- Ramas base analizadas y TS/JS legacy incluidos sin exclusiones inesperadas.
- LCOV importado sobre fuentes originales, sin paths sin resolver.
- PR interna pasa/falla según Sonar; en PR externa el token no se usa y los demás
  gates siguen siendo obligatorios; al integrar, el push vuelve a exigir Sonar.
- Token inválido, cobertura ausente o intento antiguo fallan sin falso éxito.
- `backend-ci` bloquea realmente fallos de Sonar en los eventos elegibles.
- Revisión inicial de hallazgos y evidencia/retención con responsable.

## Referencias oficiales

- [Alta con GitHub](https://docs.sonarsource.com/sonarqube-cloud/getting-started/github)
- [Acción oficial](https://github.com/SonarSource/sonarqube-scan-action)
- [Actions y PR desde forks](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud)
- [Cobertura JS/TS](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage)
- [Planes](https://docs.sonarsource.com/sonarqube-cloud/administering-sonarcloud/managing-subscription/subscription-plans)
- [Quality Gates](https://docs.sonarsource.com/sonarqube-cloud/standards/managing-quality-gates/introduction-to-quality-gates)
- [Check y protección de GitHub](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/administering-your-projects/devops-platform-integration/github)
