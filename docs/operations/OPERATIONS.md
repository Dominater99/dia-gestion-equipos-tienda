# Operación de aplicaciones Google Apps Script

## Responsabilidad documental

Este documento define un ciclo operativo reutilizable: preparación, verificación, publicación,
observabilidad y recuperación. Los comandos, entornos, cuentas, umbrales y despliegues concretos
pertenecen a `../domain/SPECIFICATION.md`.

No contiene reglas de código ni controles técnicos de seguridad detallados.

## Responsabilidades operativas

Cada aplicación identifica al menos:

- propietario funcional y técnico;
- cuenta que posee el script y cuenta efectiva de ejecución;
- persona autorizada para publicar y para revertir;
- canal de soporte e incidentes;
- acceso de emergencia y sustitución del propietario;
- responsable de datos, permisos, integraciones y costes/cuotas.

No se asignan responsabilidades a una persona implícita o a una cuenta personal sin respaldo. Una
segunda persona autorizada debe poder seguir el runbook sin conocimiento oral indispensable.

## Entornos

Separa desarrollo, pruebas y producción cuando el riesgo lo requiera. Cada entorno documenta:

- proyecto de Apps Script y fuente de datos;
- propietario, cuenta ejecutora y usuarios autorizados;
- Script Properties y servicios avanzados;
- scopes y despliegue;
- datos permitidos y política de limpieza.

No copies IDs ni secretos entre entornos mediante Git. Un sandbox personal no sustituye pruebas
con las restricciones reales del dominio.

### Inventario mínimo por entorno

| Elemento | Desarrollo | Pruebas | Producción |
| --- | --- | --- | --- |
| Proyecto de Apps Script | ID restringido o referencia segura |  |  |
| Fuente de datos |  |  |  |
| Propietario/ejecutor |  |  |  |
| Despliegue y versión |  |  |  |
| Scopes y servicios |  |  |  |
| Triggers |  |  |  |
| Propiedades requeridas |  |  |  |
| Dependencias externas |  |  |  |
| Datos permitidos |  |  |  |
| Limpieza/retención |  |  |  |

La especificación completa esta información sin publicar secretos o IDs sensibles. Si un entorno
no existe, explica cómo se prueba de forma equivalente y qué riesgo queda abierto.

## Preparación

1. Instala las versiones declaradas por el proyecto.
2. Prepara dependencias mediante el comando de la especificación.
3. Verifica autenticación de clasp sin exponer credenciales.
4. Confirma manifiesto, cuenta y destino antes de cualquier envío.

Verifica también que no haya cambios locales ajenos, artefactos generados desactualizados,
credenciales en el diff ni migraciones implícitas. La preparación no modifica producción.

## Verificación previa

La comprobación local completa reúne lint, build, pruebas y auditoría del manifiesto. Antes de
publicar, exige además rama válida, árbol limpio y revisión de cambios de configuración, scopes,
servicios y datos.

Las integraciones remotas se ejecutan por separado porque pueden consumir cuotas o mutar recursos.

### Criterios go/no-go

Se detiene una publicación si:

- falla una comprobación obligatoria;
- no se conoce la cuenta, proyecto o despliegue de destino;
- hay cambios de scopes, datos o permisos sin revisión;
- no existe reversión practicable para un cambio incompatible;
- el árbol contiene cambios no revisados o secretos;
- una dependencia crítica está degradada y el flujo no tolera el fallo;
- no puede ejecutarse la prueba de humo mínima.

Una excepción requiere responsable, motivo, alcance, mitigación y aprobación explícita. No se
convierte un fallo en advertencia únicamente para completar el despliegue.

## Publicación

Un flujo típico es:

```text
verificación local -> envío de fuentes -> creación de versión
-> actualización de despliegue -> prueba de seguridad -> prueba de humo
```

La especificación aclara qué pasos son automáticos y cuáles manuales. Nunca asumas que
`clasp push` actualiza una versión o despliegue. Registra versión, fecha, responsable y resultado
sin publicar IDs sensibles.

### Runbook de publicación

La especificación concreta esta plantilla:

```markdown
## Publicación

- Versión/revisión:
- Entorno y despliegue objetivo:
- Cuenta ejecutora:
- Responsable y aprobador:
- Precondiciones:
- Comando o pasos de build:
- Envío de fuentes:
- Creación de versión:
- Actualización de despliegue:
- Comprobaciones de seguridad:
- Prueba de humo:
- Criterio de éxito:
- Criterio y procedimiento de rollback:
- Evidencia y ubicación del registro:
```

Cada paso produce una señal verificable antes de continuar. Si el flujo es manual, se registran la
versión y el resultado, no solo la intención de publicar.

### Registro de cambio

El registro incluye fecha, revisión, versión de Apps Script, entorno, responsable, resumen,
cambios de configuración/scopes/datos, pruebas, incidencias y rollback. No contiene tokens, IDs
privados o PII innecesaria.

## Comprobación posterior

- Acceso permitido y denegado según el modelo.
- Camino principal completado por un usuario autorizado.
- Sin errores nuevos ni datos sensibles en logs.
- Permisos de Drive y notificaciones correctos.
- Sin duplicados ni estados intermedios sin recuperación.
- Changelog y limitaciones actualizados.

La ventana de observación y los indicadores concretos dependen del riesgo. Si la prueba crea datos,
archivos o correos, usa identificadores inequívocos y aplica la limpieza autorizada.

## Observabilidad

Registra eventos estables, etapa, resultado, duración e identificador técnico mínimo. Mide volumen,
latencia, espera de bloqueos, cuotas, reintentos y fallos de recuperación. Los umbrales se fijan en
la especificación a partir de comportamiento medido.

### Señales y alertas

Para cada flujo crítico se define:

| Señal | Fuente | Umbral | Ventana | Responsable | Acción |
| --- | --- | --- | --- | --- | --- |
| Error, latencia, cuota o atasco | Log o métrica | Específico | Específica | Rol/canal | Runbook |

Una alerta debe ser accionable y deduplicarse. La ausencia de alertas no demuestra salud si la
telemetría dejó de emitirse; se contempla una señal de vida cuando el riesgo lo justifique.

Los logs usan correlación técnica, etapas y resultados estables. No se registran payloads, secretos
ni datos personales completos para facilitar una búsqueda.

## Reversión

Volver a una versión anterior del despliegue no revierte filas, archivos, permisos ni correos. El
plan distingue:

- **rollback de código:** seleccionar una versión estable y repetir pruebas;
- **recuperación de datos:** identificar efectos exactos, copiar, simular y reconciliar;
- **contención de seguridad:** limitar acceso, preservar evidencia y comunicar el incidente.

No parchees producción sin trazabilidad. Corrige en una rama y publica una versión verificable.

### Criterios de rollback

Define antes de publicar qué errores, pérdida de funcionalidad, latencia, duplicados o exposición
obligan a revertir. El responsable puede detener el despliegue sin esperar una investigación
completa cuando continuar aumenta el impacto.

Después del rollback se confirma versión activa, acceso, flujo principal y efectos pendientes. Los
datos producidos por la versión fallida se reconcilian por separado; nunca se supone que volver al
código anterior los elimina.

## Backup y recuperación

Cada recurso autoritativo declara método de copia, frecuencia, retención, propietario y prueba de
restauración. La existencia de historial de Sheets o papelera de Drive no sustituye un plan
verificado cuando el impacto exige otro nivel.

- **RPO:** pérdida máxima de datos aceptable medida en tiempo.
- **RTO:** tiempo objetivo para restaurar el servicio o un modo operativo seguro.

Los valores concretos pertenecen a la especificación. Si no se han aprobado, se declaran como
pendientes y no se promete una capacidad de recuperación. Una prueba de restauración usa copias o
entornos autorizados y conserva evidencia.

## Cambios masivos

Antes de migrar, importar, eliminar o corregir en lote:

1. define IDs y alcance exactos;
2. genera simulación o informe previo;
3. crea una copia recuperable;
4. obtiene aprobación explícita;
5. procesa lotes idempotentes con puntos de control;
6. registra éxitos, errores y pendientes;
7. verifica y limpia temporales por ID.

El proceso admite pausa, reanudación y ejecución repetida. Los cursores y checkpoints se guardan en
una fuente adecuada y no se confunden con un contador en memoria. La validación final compara
origen, destino, rechazados y pendientes.

## Incidentes operativos

1. Detecta y registra hora, señal y alcance conocido.
2. Contiene el efecto sin destruir evidencia.
3. Identifica versión, cuenta, triggers, recursos y dependencia afectados.
4. Decide continuar, degradar, desactivar o revertir según el runbook.
5. Comunica por el canal y frecuencia aprobados.
6. Recupera y valida con criterios explícitos.
7. Registra línea temporal, causa, acciones y seguimiento.

Un incidente de seguridad sigue además
[SECURITY.md](SECURITY.md#incidentes). No se reinicia un trigger repetidamente si cada ejecución
puede duplicar efectos.

## Mantenimiento periódico

La frecuencia se fija según riesgo. La revisión incluye:

- propietarios, cuentas técnicas y acceso de emergencia;
- versiones, despliegues y triggers activos;
- scopes, servicios avanzados y APIs externas;
- cuotas, latencia, errores y locks;
- dependencias, runtime y herramientas;
- retención, copias, restauración y recursos huérfanos;
- documentación, contactos y runbooks;
- permisos directos, heredados y acceso general de Drive.

Cada revisión deja fecha, responsable, hallazgos y acciones. No se borra un recurso huérfano sin
resolver su identidad, dependencia y recuperación.

## Retirada de una aplicación

La baja es un cambio controlado:

1. identifica usuarios, integraciones y obligaciones de conservación;
2. comunica la fecha y alternativa;
3. bloquea nuevas mutaciones de forma verificable;
4. exporta o conserva datos según política;
5. desactiva triggers y despliegues por ID exacto;
6. revoca permisos, servicios y secretos que ya no se necesiten;
7. archiva código, configuración y evidencias necesarias;
8. verifica ausencia de procesos, alertas y costes residuales.

La eliminación definitiva de datos o recursos requiere autorización explícita independiente de la
decisión de retirar la interfaz.

## Continuidad

Documenta propietarios, acceso de emergencia, dependencias externas y procedimiento si una cuenta
deja de estar disponible. Revisa periódicamente triggers, despliegues antiguos, scopes, cuotas y
recursos huérfanos.

La continuidad contempla ausencia del propietario, interrupción de Google Workspace, caída de una
API externa, agotamiento de cuota y pérdida temporal de la fuente de datos. Para cada dependencia
crítica se documenta modo degradado, criterio de cierre y recuperación.

## Checklist de entrega operativa

- [ ] Entornos, propietarios y cuentas están identificados.
- [ ] Build, pruebas y auditorías obligatorias pasan.
- [ ] Scopes, servicios, configuración y datos cambiados están declarados.
- [ ] Existen criterios go/no-go y rollback.
- [ ] La prueba de humo es segura y repetible.
- [ ] Logs, alertas y responsables cubren el flujo crítico.
- [ ] Backup, RPO/RTO y restauración están definidos cuando aplican.
- [ ] Cambios masivos usan simulación, checkpoints y reconciliación.
- [ ] El registro de publicación no contiene información sensible.
- [ ] Una segunda persona puede ejecutar publicación y recuperación.
