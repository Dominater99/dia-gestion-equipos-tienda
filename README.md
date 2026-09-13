# Solicitudes de elementos de layout

Web app corporativa de Google Apps Script para registrar solicitudes relacionadas con neveras,
lockers y cafeteras de tienda. Las opciones visibles se administran desde la pestaña
`Elementos`, sin modificar ni volver a desplegar el código.

La definición funcional, las hojas, los roles, la interfaz pública y la operación concreta están
centralizados en [la especificación](docs/domain/SPECIFICATION.md).

## Flujo de usuario

1. La aplicación identifica la cuenta corporativa y comprueba su fila en `Usuarios`.
2. El usuario elige equipo, proveedor —cuando exista— y tipo de gestión.
3. El formulario solicita únicamente los campos que requiere la opción elegida.
4. El servidor limita los intentos por cuenta y a 10 los registros diarios por usuario
   (configurable en `Sistema`), vuelve a autorizar, valida, genera un ID
   `SOL-AAAAMMDD-NNNN` y escribe una fila en `Registros`.
5. Se envía una confirmación al solicitante con las copias configuradas.

La aplicación no instala ni utiliza triggers. La limpieza de `Logs` y la preparación de las
pestañas maestras se realizan manualmente.

## Inicio rápido

Requisitos: Node.js 20.19 o posterior, acceso al proyecto vinculado de Apps Script, permisos sobre
la hoja activa y una sesión de clasp autorizada.

```text
npm install
npm run check
npm run push -- --dry-run
```

La instalación puede fallar en carpetas de Google Drive que estén sincronizando muchos archivos.
En ese caso, instala las dependencias en una ruta local, sin mover el código fuente. En PowerShell,
desde la raíz del repositorio:

```powershell
$depsDir = Join-Path $env:TEMP 'dia-layout-deps'
New-Item -ItemType Directory -Force -Path $depsDir | Out-Null
Copy-Item -LiteralPath 'package.json', 'package-lock.json' -Destination $depsDir
npm ci --prefix $depsDir
$env:PATH = (Join-Path $depsDir 'node_modules\.bin') + ';' + $env:PATH
$env:NODE_PATH = Join-Path $depsDir 'node_modules'
npm run push -- --dry-run
```

En la misma sesión de PowerShell, `npm run push` utiliza esas dependencias locales. Repite la
instalación si cambia `package-lock.json`.

## Preparación de la hoja

Prepara manualmente `Sistema`, `Usuarios`, `Tiendas`, `Elementos` y `Registros` con las cabeceras
de la [especificación](docs/domain/SPECIFICATION.md). No incluyas `VERSION` en `Sistema`:
el nombre y la versión están en el código. Ya no hay funciones `setup...` ni se insertan
datos de ejemplo. La primera alta inicializa el contador de Script Properties para que el
primer ID nuevo termine en `0002`; si encuentra un contador legado en `Sistema`, conserva
su valor antes de retirar esa fila. Si falta `Logs`, el primer evento la crea automáticamente.
Su limpieza diaria sigue siendo manual.

En una instalación existente, conserva las pestañas y sus datos; antes de publicar revisa
manualmente las cabeceras de `Registros` y los parámetros de `Sistema`.

Si «Registrar solicitud» muestra un error genérico, revisa `Ejecuciones` del proyecto Apps Script:
el servidor registra allí la etapa y la excepción saneada, aunque devuelva `success:false` al
navegador. Comprueba las columnas obligatorias de `Registros`; las antiguas
`clave_idempotencia` y `huella_solicitud` ya no son necesarias. Si no aparece
ninguna ejecución, mira la consola del navegador y confirma que estás probando la versión
desplegada que contiene estos cambios.

Completa las tiendas, los elementos y los destinatarios de `email_destino` que correspondan.

## Estructura

```text
src/
  appsscript.json
  backend/
    00_constants.js
    10_sheet_gateway.js
    20_config_service.js
    21_element_service.js
    22_store_service.js
    23_log_service.js
    24_rate_limit_service.js
    30_auth_service.js
    31_mail_service.js
    32_request_service.js
    90_web_entrypoint.js
  frontend/
    00_styles.html
    10_navigation.html
    20_form.html
    30_validation_submit.html
    99_index.html
test/
  setup/gas_globals.js
  NN_responsabilidad.test.js
```

Los prefijos expresan el orden de dependencia en el espacio global de Apps Script. JavaScript usa
`camelCase`, las constantes usan `UPPER_SNAKE_CASE` y las funciones internas terminan en `_`.
El HTML se carga como plantilla `frontend/99_index` desde `doGet()`. La plantilla incorpora
los cuatro fragmentos locales con `HtmlService`; `clasp push` envía `src/` directamente.
No hay compilación ni `dist/` que generar.

## Comandos

| Comando | Resultado |
|---|---|
| `npm test` | Ejecuta la suite Jest. |
| `npm run test:coverage` | Genera cobertura local. |
| `npm run check` | Ejecuta la comprobación local completa. |
| `npm run push -- --dry-run` | Ejecuta ESLint y tests sin crear commit ni enviar fuentes. |
| `npm run push` | Ejecuta ESLint y tests; si pasan, confirma todos los cambios permitidos, hace `git push` y envía `src/` con clasp. No publica una versión. |
| `npm run push -- "mensaje"` | Igual, con un mensaje de commit elegido por quien publica. |
| `npm run open` | Abre el proyecto remoto de Apps Script. |

Antes del primer envío, revisa `git status`: la rama local puede no tener commits y el comando
confirmará todos los archivos no ignorados del proyecto. `.clasp.json`, `node_modules/` y
`*.gsheet` se excluyen; el script también bloquea nombres de archivo sensibles. Si falla lint,
tests, Git o clasp, el flujo se detiene. Un commit o envío a Git ya completado no se revierte
automáticamente si falla un paso posterior.

Consulta [Operación](docs/operations/OPERATIONS.md) y la sección de publicación de la
[especificación](docs/domain/SPECIFICATION.md) antes de enviar o desplegar.

## Documentación

| Documento | Contenido |
|---|---|
| [AGENTS.md](AGENTS.md) | Protocolo general de mantenimiento. |
| [Especificación](docs/domain/SPECIFICATION.md) | Contrato específico de esta aplicación. |
| [Arquitectura](docs/architecture/ARCHITECTURE.md) | Principios arquitectónicos reutilizables. |
| [Convenciones](docs/development/CONVENTIONS.md) | Nombres, código, errores y datos. |
| [Guía visual](docs/development/STYLE_GUIDE.md) | Diseño y accesibilidad. |
| [Pruebas](docs/development/TESTING.md) | Estrategia de verificación. |
| [Interfaces](docs/domain/API.md) | Reglas generales para interfaces Apps Script. |
| [Seguridad](docs/operations/SECURITY.md) | Controles técnicos y privacidad. |
| [Operación](docs/operations/OPERATIONS.md) | Envío, despliegue y recuperación. |
| [CHANGELOG.md](CHANGELOG.md) | Historial del proyecto. |

`CLAUDE.md` y `GEMINI.md` remiten a `AGENTS.md`; no duplican sus instrucciones.

## Seguridad y licencia

No confirmes ni publiques `.clasp.json`, archivos `.gsheet`, credenciales, IDs de recursos ni
datos personales. El despliegue está limitado al dominio y se ejecuta con la identidad de quien lo
publica; la autorización funcional se repite en el servidor.

El proyecto no declara todavía una licencia de distribución. Consulta [LICENSE.md](LICENSE.md)
antes de reutilizar o publicar el código.
