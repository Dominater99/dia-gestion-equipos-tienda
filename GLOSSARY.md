# Glosario

## Responsabilidad documental

Este archivo define términos reutilizables y acrónimos. No contiene reglas normativas ni enumera
los valores concretos de una aplicación; esos valores pertenecen a su especificación.

## Términos

- **ADR (Architecture Decision Record):** registro breve de una decisión arquitectónica difícil
  de revertir, con contexto, alternativas y consecuencias.
- **BEM (Block, Element, Modifier):** convención para nombrar clases CSS como
  `.bloque`, `.bloque__elemento` y `.bloque--modificador`.
- **Caché por niveles:** resolución en cascada desde un almacenamiento rápido y efímero hasta la
  fuente autoritativa. Cada nivel debe definir alcance, TTL e invalidación.
- **Clasp:** herramienta de línea de comandos para sincronizar proyectos de Google Apps Script.
- **DTO (Data Transfer Object):** objeto plano y serializable usado para cruzar una frontera entre
  procesos o capas.
- **Efecto externo:** mutación observable fuera de la ejecución, como escribir en Sheets, crear un
  archivo, cambiar permisos o enviar correo.
- **HMAC:** código de autenticación basado en hash y una clave compartida. Solo se usa cuando el
  canal permite verificar de forma fiable el mensaje original y su firma.
- **Idempotencia:** propiedad por la que repetir una operación con la misma identidad no duplica
  sus efectos.
- **Mínimo privilegio:** concesión únicamente de los permisos necesarios, durante el tiempo y
  sobre los recursos requeridos.
- **PII:** información personal que identifica o puede identificar a una persona.
- **Punto de entrada:** función invocada desde fuera del núcleo, por ejemplo un trigger,
  `doGet`, `doPost` o una función llamada con `google.script.run`.
- **RBAC (Role-Based Access Control):** autorización basada en roles y permisos definidos.
- **SSOT (Single Source of Truth):** fuente canónica que posee un dato o decisión y evita mantener
  copias divergentes.
- **V8:** runtime moderno de JavaScript usado por Google Apps Script.
- **Webhook:** petición HTTP iniciada por otro sistema para comunicar un evento.
