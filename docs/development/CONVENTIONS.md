# Convenciones de ingeniería para Google Apps Script

## Responsabilidad documental

Este documento define contratos reutilizables de código, nombres, errores, datos, rendimiento y
estructura. Las capas, prefijos, idiomas, comandos y excepciones elegidos por una aplicación se
declaran en `../domain/SPECIFICATION.md`.

No define la arquitectura concreta, el sistema visual, la estrategia de pruebas ni la operación.

## JavaScript y Apps Script

- Usa runtime V8 y sintaxis compatible con la versión confirmada.
- Prefiere `const` y `let`; evita estado global mutable.
- Usa `camelCase` para funciones y variables y `UPPER_SNAKE_CASE` para constantes.
- En Apps Script, reserva el sufijo `_` para funciones que deban permanecer privadas.
- Documenta con JSDoc contratos públicos o complejos; no repitas una firma evidente.
- Divide por responsabilidad y complejidad, no por un máximo universal de líneas.
- Los comentarios explican decisiones, invariantes y limitaciones externas.

El proyecto puede adoptar prefijos numéricos o `snake_case` para archivos si la especificación y
las pruebas protegen el patrón.

## Estructura y dependencias

- Las entradas adaptan y delegan; no contienen todo el caso de uso.
- El dominio no depende de `SpreadsheetApp`, `DriveApp`, `GmailApp` ni UI.
- La infraestructura no llama a capas superiores.
- Evita módulos genéricos llamados `Utils`, `Helpers` o `Common`.
- Extrae una abstracción solo cuando tenga responsabilidad estable y consumidores reales.

## Datos y DTOs

Los objetos que cruzan `google.script.run` se normalizan a primitivas, arrays y objetos literales.
Las fechas usan un formato explícito, normalmente ISO 8601; IDs y códigos se mantienen como
cadenas cuando ceros o precisión importen.

Nombres de hojas, columnas, estados, propiedades y mensajes viven en una fuente canónica. Al
escribir texto no confiable en Sheets, evita que se interprete como fórmula.

## Errores

Por defecto, un fallo que invalida el caso de uso lanza un `Error` con mensaje estable. Captura solo
cuando el llamador pueda continuar de forma significativa:

- una notificación secundaria puede devolver un estado de entrega;
- un logger no debe derribar la operación que intenta registrar;
- una búsqueda best effort puede devolver ausencia si es un resultado esperado.

Cada excepción al patrón se documenta junto al código. No muestres trazas internas ni datos
sensibles al usuario.

## Concurrencia e idempotencia

- Asigna una identidad estable antes del primer efecto externo.
- Comprueba el estado existente después de adquirir el bloqueo.
- Mantén el bloqueo durante la sección crítica mínima.
- Cuando se requieran reintentos seguros, reutiliza o reconcilia recursos; en caso contrario,
  documenta el posible efecto duplicado.
- Define compensación o recuperación para fallos parciales.
- No confundas deduplicación temporal con idempotencia persistente.

## Rendimiento

- Opera Sheets con matrices y rangos, no celda a celda en bucles.
- Conserva IDs de Drive y evita búsquedas reiteradas por nombre.
- Agrupa llamadas remotas y mide duración y volumen.
- Usa memo de ejecución para lecturas repetidas dentro de una invocación.
- Usa `CacheService` solo con TTL e invalidación; respeta límites por valor y cuota.
- Los procesos largos usan lotes, cursores o puntos de control medidos.
- No aumentes timeouts o caché para ocultar crecimiento.

## Configuración y secretos

Los valores no sensibles configurables usan la fuente adoptada por la aplicación. Secretos,
tokens e IDs sensibles no se incrustan ni se registran. `PropertiesService` no sustituye una base
de datos ni elimina la necesidad de controlar quién administra el script.

## Frontend

- Mantén separadas estructura, presentación, servicios y controladores cuando el tamaño lo exija.
- Reutiliza componentes y un único puente a `google.script.run`.
- Descarta respuestas obsoletas y evita dobles envíos.
- El estado optimista requiere reversión y mensaje de error.
- No edites artefactos generados; modifica su fuente y recompila.

Las reglas visuales viven en `STYLE_GUIDE.md`.

## Cambios y compatibilidad

Separa renombrados de comportamiento cuando sea posible. Una función pública, trigger, columna o
propiedad se mantiene compatible o incluye migración y reversión. Actualiza especificación,
pruebas y changelog cuando cambie un contrato observable.
