# Reporte responsable de vulnerabilidades

## Responsabilidad documental

Este archivo define únicamente cómo comunicar una vulnerabilidad de este repositorio. Los
controles técnicos reutilizables están en `../docs/operations/SECURITY.md` y el modelo concreto de
la aplicación, en `../docs/domain/SPECIFICATION.md`.

## Cómo informar

No publiques vulnerabilidades, datos personales, credenciales, IDs o enlaces sensibles en una
incidencia pública.

Comunica el hallazgo de forma privada al propietario o mantenedor mediante el canal interno
autorizado. Si el repositorio todavía no declara un canal oficial, contacta primero con su
responsable y acuerda un medio privado antes de compartir detalles técnicos.

Incluye, cuando sea seguro:

- descripción e impacto posible;
- componente y revisión afectada;
- pasos mínimos con datos sintéticos;
- evidencia anonimizada;
- mitigación temporal conocida.

Este repositorio no publica un email, URL, clave PGP ni SLA hasta que hayan sido aprobados. No uses
direcciones o plazos de plantilla como si fueran compromisos reales.

## Tratamiento esperado

El mantenedor confirma la recepción, evalúa alcance y exposición, contiene el riesgo, preserva
evidencia, prepara y verifica la corrección y coordina la comunicación. La divulgación pública solo
se realiza después de mitigar el problema y con el detalle que resulte seguro.

No borres logs ni recursos necesarios para investigar. Ante exposición activa, prioriza limitar el
acceso y sigue el procedimiento de incidentes de `../docs/operations/SECURITY.md`.
