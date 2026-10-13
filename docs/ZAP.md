# ZAP y controles HTTP de seguridad — ENS Media

## Integración

El job `FWCloud-API ZAP and HTTP Security` ejecuta dos perfiles del script oficial
`zap-api-scan.py`. El perfil público utiliza `zaproxy/action-api-scan` v0.10.0,
fijada al commit `5158fe4d9d8fcc75ea204db81317cce7f9e5453d`; el autenticado invoca
el mismo script directamente en Docker para controlar la publicación de evidencia.
**No requiere instalar aplicaciones de Marketplace** ni servicios externos.

ZAP 2.17.0 y MySQL 8.0 están fijados por digest en el workflow. Node 22 compila
el checkout con `npm ci`. El servidor usa `NODE_ENV=prod` y middlewares reales,
CORS y confirmación habilitados. HTTP está limitado al loopback del runner.

`.github/zap/start.cjs` exige CI y la base `fwcloud_zap` vacía, aplica migraciones
y arranca el servidor. El escaneo público termina **antes de crear cuentas**.
Después, `fixtures.cjs` crea un administrador, dos managers y una cuenta con 2FA
verificada, con passwords, tokens y secreto TOTP aleatorios; dos clouds con
firewall, dirección IP, regla de política, tabla y ruta de routing separadas.
No se cargan seeds de cuentas predeterminadas ni datos operativos.

Los helpers comprueban contratos HTTP y crean fixtures; el script oficial dirige
las esperas, importación, escaneo activo/pasivo y clasificación de reglas.
No se añade un driver de ZAP, laboratorio Compose ni comandos npm de DAST local.

## Alcance

### Login público

`.github/zap/login.openapi.yaml` declara solo `POST /user/login`. El preflight
con un body válido y usuario inexistente debe obtener `401 / BAD_LOGIN` (1001).
Un 400 de validación, 503 o endpoint inexistente no cumple esta comprobación.
La acción recibe `Origin: https://zap.invalid`, sin credenciales de sesión.

### Consultas autenticadas

Tras login exitoso de manager A, se genera `authenticated.openapi.json` con IDs
existentes y diez operaciones explícitas:

| Método | Ruta |
| --- | --- |
| GET | `/fwcloud/all/get` |
| PUT | `/fwcloud/get` |
| PUT | `/firewall/get` |
| PUT | `/ipobj/get` |
| PUT | `/policy/rule/get` |
| GET | `/fwclouds/{C}/firewalls/{F}/routingTables` |
| GET | `/fwclouds/{C}/firewalls/{F}/routingTables/{T}` |
| GET | `/fwclouds/{C}/firewalls/{F}/routingTables/{T}/routes/{R}` |
| GET | `/auditlogs` |
| GET | `/auditlogs/{auditlog}` |

Los PUT terminados en `/get` son consultas legacy. No se importa el OpenAPI
completo ni se ejecuta un spider. El conteo de URLs de ZAP incluye nodos padre;
no representa más operaciones de negocio.

La cookie proviene del login HTTP real. Las variables oficiales `ZAP_AUTH_HEADER*`
la envían al target. `auth-hook.py` añade Origin, excluye nodos ajenos al alcance
y exige que ZAP haya recibido 200 con cuerpo en cada operación durante la importación,
antes de iniciar el escaneo activo. También exige terminar la cola pasiva.
El escáner no recibe tokens de confirmación. La escritura de comentarios no se
declara en su OpenAPI.

## Controles HTTP deterministas

`http-check.cjs before/after` verifica:

- Login 200, identidad/rol, cookie y keepalive; contenido protegido válido de
  ambos managers antes y después del escaneo; logout 204 y rechazo de la cookie antigua.
- Administrador permitido y manager rechazado en `/backups` y `/user/get`.
- Aislamiento entre clouds y tablas existentes, sustitución de hijo bajo padre
  ajeno y ausencia de recursos ajenos en colecciones y auditoría.
- Cambio de `comment` de una tabla sintética propia con token válido y persistencia
  comprobada directamente en MySQL; escritura ajena y tokens ausente/incorrecto
  rechazados sin modificar los comentarios. Manager B escribe su comentario
  original para obtener un evento propio real sin cambiar su valor.
- Auditoría de escrituras HTTP reales permitidas/denegadas: usuario, fecha, evento,
  resultado y recurso; acceso a detalle propio/admin, rechazo del detalle ajeno y
  ausencia de passwords, cookies y tokens en el detalle comprobado. Los registros
  no se precargan como evidencia. La finalización de auditoría es asíncrona.
- 2FA opcional: cuentas sin secreto verificado inician sesión sin TOTP. Una cuenta
  activada rechaza código ausente/incorrecto sin sesión útil y acepta un código real.

El login consulta `Tfa.secret` persistido antes de almacenar la identidad de sesión,
admite `x-tfa` y `authCode`, invalida la sesión tras fallo y no devuelve el secreto.
Un `tempSecret` pendiente no exige 2FA. Las regresiones de Mocha comprueban estos
estados y el fallo de 2FA al reutilizar una cookie autenticada.

## Política y evidencia

- Códigos oficiales: 0 éxito, 1 FAIL, 2 WARN, 3 error operativo. Todos salvo 0 bloquean.
- Sin `-I`, reglas IGNORE ni excepción de errores 500 (`100000`).
- `10037` (banner Express sin versión) se clasifica INFO y sigue visible.
- El archivo de reglas activa la política predeterminada del packaged scan;
  los PASS indican reglas sin alertas, no cobertura completa de sus vectores.
- `backend-ci` exige el éxito del job completo, incluidos controles antes/después.

Artefactos:

1. `backend-zap-login-<RUN_ID>-<ATTEMPT>`: HTML/JSON/Markdown nativos del perfil
   público, generado cuando la base todavía no contiene cuentas.
2. `backend-zap-authenticated-<RUN_ID>-<ATTEMPT>` (90 días): controles nombrados
   y resultados booleanos, alcance OpenAPI sin credenciales, y agregado ZAP con
   IDs numéricos de reglas, riesgo, número de instancias y conteos oficiales.
   Incluye commit/run cuando se ejecuta en Actions.

El agregado autenticado se obtiene del JSON nativo mediante una allowlist de
campos: no copia URLs de ataques, headers, bodies, evidencia, nombres dinámicos,
cookies, secretos o claves. No se genera ni publica su HTML/JSON/Markdown detallado.
Los archivos de credenciales tienen modo 0600, las sesiones y logs quedan en
`RUNNER_TEMP`; se eliminan al terminar junto con los diagnósticos privados. El
workflow no publica contextos ZAP ni bases de datos y desactiva creación de issues.
El enmascarado de logs no sustituye esta selección de campos.

## Relación con ENS categoría Media

| Medida | Evidencia técnica aportada |
| --- | --- |
| `mp.sw.2` + R1 | Pruebas de aceptación de seguridad en entorno aislado del commit analizado; gates CI y escaneo activo/pasivo. |
| `op.acc.1`, `op.acc.2`, `op.acc.4` | Identidad, roles, acceso propio/ajeno, mínimo privilegio y confirmación sin eludir autorización. |
| `op.acc.5` / `op.acc.6`, según usuarios y aplicabilidad | Sesión, logout y verificación del segundo factor cuando está activado. |
| `op.exp.8` | Registro real de escrituras, identidad/fecha/recurso/evento/resultado y controles de lectura de auditoría. |

Referencia: [RD 311/2022, anexo II](https://www.boe.es/buscar/act.php?id=BOE-A-2022-7191).
La relación debe incorporarse al análisis de riesgos y Declaración de Aplicabilidad.
No acredita por sí sola conformidad ENS: 2FA opcional en el producto no demuestra
que esté activada donde corresponde en el sistema evaluado. Tampoco prueba
integridad/retención/monitorización de logs en producción, protección de su reloj,
TLS público, infraestructura, UI, WebSockets, todas las rutas o VPN externas.

## Validación y cierre

El perfil inicial detectó el 500 por JSON malformado; se corrigió a 400 genérico
sin fragmentos de entrada. La ampliación detectó ausencia de `nosniff`; la API
añade ahora `X-Content-Type-Options: nosniff` incluso en errores del parser.

La validación local usa Node 22, MySQL 8.0 y ZAP 2.17.0 fijados en CI. Build,
71 pruebas de seguridad/gate, ESLint, Prettier, cuatro pruebas de alcance/política
y tres pruebas del hook de privacidad y completitud han pasado.
Actionlint 1.7.7 valida el workflow y Gitleaks 8.30.1 no detecta secretos en los
helpers/alcance y nuevas pruebas.
El 2026-10-08 pasaron 58 controles HTTP previos y 27 posteriores, con estado
preservado y logout. Ambos perfiles ZAP terminaron con 0 FAIL, 0 WARN, 1 INFO
(10037) y 112 PASS. El agregado conserva también los diagnósticos informativos
nativos: sus instancias no equivalen al conteo de reglas del resumen bloqueante.
La ejecución definitiva del workflow y la revisión de sus artefactos en Actions
siguen pendientes de publicación de la rama.

## Opcional: Docker contra un entorno de desarrollo desechable

Solo el perfil público puede invocarse directamente así, sin instalar ZAP/Java:

```bash
docker run --rm --network host \
  -v "$PWD:/zap/wrk:rw" \
  -e ZAP_AUTH_HEADER=Origin \
  -e ZAP_AUTH_HEADER_VALUE=https://zap.invalid \
  -e ZAP_AUTH_HEADER_SITE=127.0.0.1 \
  ghcr.io/zaproxy/zaproxy:2.17.0@sha256:781a2bdaea47324e7bab583e2263f21d257b0aee61ed51521a5be45f5f5081ef \
  zap-api-scan.py -t .github/zap/login.openapi.yaml -f openapi \
  -c .github/zap/rules.tsv -r zap-login.html -s -T 5 \
  -z "-silent -config scanner.threadPerHost=1"
```

Requiere API desechable en `127.0.0.1:3131` y escritura para el usuario del
contenedor; Docker Desktop puede requerir adaptar la conectividad al host.
No usar el escaneo activo contra una base de trabajo con datos reales.
