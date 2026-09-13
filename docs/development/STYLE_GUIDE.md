# Sistema visual reutilizable para web apps de Google Apps Script

## 1. Propósito y alcance

Este documento es el contrato visual compartido para las aplicaciones internas. Su objetivo es que
proyectos distintos mantengan el mismo lenguaje de interfaz: sobrio, compacto, accesible, centrado
en tareas y reconocible por el uso del rojo corporativo.

Define:

- identidad visual, tokens y fundamentos CSS;
- tipografía, espaciado, radios, elevación e iconografía;
- estructura de página y comportamiento responsive;
- anatomía, variantes y estados de los componentes;
- accesibilidad, contenido, movimiento y criterios de calidad;
- reglas para adoptar y evolucionar el sistema en otros proyectos.

No define arquitectura frontend, lógica de negocio, modelos de datos ni procedimientos de
publicación. Las excepciones funcionales o visuales exclusivas de una aplicación se documentan en
`../domain/SPECIFICATION.md`. El CSS ejecutable es la fuente de verdad del navegador; este
documento es el contrato que ese CSS debe implementar.

### 1.1. Perfil visual

La interfaz usa superficies blancas sobre un fondo gris muy claro, bordes sutiles, sombras
contenidas, tipografía de sistema y una densidad compacta. El rojo identifica marca, selección y
acción primaria; no se utiliza como decoración indiscriminada. La información se organiza en
tarjetas y bloques de campo claramente separados.

La experiencia debe transmitir:

- claridad antes que ornamentación;
- jerarquía antes que densidad de color;
- continuidad entre aplicaciones antes que personalización local;
- respuesta inmediata y estados explícitos;
- aspecto profesional en móvil, portátil y monitor grande.

## 2. Autoridad y reutilización

### 2.1. Qué debe copiarse a otro proyecto

Para obtener el mismo look & feel no basta con copiar colores o capturas. El proyecto destino debe
adoptar como unidad:

1. los tokens de la sección 4;
2. los fundamentos de la sección 5;
3. los patrones de los componentes que utilice;
4. las reglas responsive y de accesibilidad;
5. pruebas visuales y funcionales proporcionales a sus flujos.

En el proyecto de referencia `diaformlayouts`, la implementación mantenible vive principalmente en:

- `src/frontend/00_foundation/00_01_accessibility_responsive_base.html`;
- `src/frontend/00_foundation/00_03_component_styles.html`;
- `src/frontend/00_foundation/00_32_merch_visual_guide_styles.html`;
- `src/frontend/00_foundation/00_39_desktop_workspace_styles.html`.

Estas rutas describen el proyecto de referencia, no la estructura obligatoria del proyecto
destino. Los demás ficheros de `src/frontend/00_foundation/` implementan allí componentes
especializados. Los artefactos generados de `dist/` no se copian ni se editan. La especificación
de cada aplicación identifica dónde se implementa efectivamente el sistema visual.

### 2.2. Regla de personalización

Los proyectos pueden cambiar nombre, textos, logotipo, navegación y componentes necesarios para
su dominio. No deben crear variantes locales de color, radio, sombra o espaciado si ya existe un
token adecuado.

Una excepción visual solo se admite cuando:

- responde a una necesidad de producto verificable;
- no puede expresarse mediante una composición existente;
- conserva accesibilidad y comportamiento responsive;
- queda declarada en la especificación de la aplicación;
- se implementa con un token semántico si aparece más de una vez.

### 2.3. Compatibilidad

Los tokens y nombres de componentes compartidos se tratan como una API. Cambiar su significado o
eliminarlos requiere una migración coordinada. Añadir un token compatible es un cambio menor;
corregir documentación sin alterar la interfaz es un cambio de parche.

## 3. Principios de diseño

1. **Una tarea reconocible por vista.** Título, contexto y acción principal deben entenderse sin
   recorrer toda la pantalla.
2. **Una acción primaria por grupo.** Las alternativas son secundarias y las acciones destructivas
   se distinguen mediante texto y tratamiento visual.
3. **Proximidad semántica.** Etiqueta, ayuda, control y error forman una unidad visual.
4. **Densidad compacta, interacción cómoda.** Se reduce espacio ornamental, nunca el objetivo
   táctil, el foco o la legibilidad.
5. **Divulgación progresiva.** Se muestra primero lo necesario para continuar.
6. **Estados completos.** Todo proceso contempla carga, vacío, éxito, advertencia, error,
   deshabilitado y reintento cuando proceda.
7. **Color con significado.** Ningún estado depende solo del color.
8. **Móvil primero.** La vista base funciona desde 320 px.
9. **Movimiento funcional.** Una animación explica transición, progreso o relación espacial.
10. **Interfaz resiliente.** Textos largos, zoom, latencia y errores parciales no rompen la vista.

## 4. Tokens de diseño canónicos

Los tokens se declaran en `:root`, se nombran por función y se consumen mediante `var()`. No se
crean nombres ligados a una pantalla concreta como `--rojo-formulario-apertura`.

### 4.1. Familias tipográficas

No se requieren fuentes remotas. Las pilas del sistema reducen latencia, evitan bloqueos por CSP y
se integran con Windows, macOS, Android e iOS.

| Token | Valor | Uso |
| --- | --- | --- |
| `--font-body` | `ui-sans-serif, system-ui, sans-serif, ...` | Interfaz, títulos y contenido |
| `--font-display` | `var(--font-body)` | Alias para títulos |
| `--font-mono` | pila monoespaciada de sistema | IDs, códigos y referencias |
| `--font-weight-regular` | `400` | Texto corriente |
| `--font-weight-medium` | `500` | Énfasis moderado |
| `--font-weight-bold` | `700` | Etiquetas y acciones |
| `--font-weight-black` | `900` | Marca o énfasis excepcional |

El texto corrido usa altura de línea `1.5`; los títulos, `1.25`; identificadores compactos pueden
usar `1` o `1.1`.

### 4.2. Escala tipográfica

La escala es compacta porque las aplicaciones son herramientas operativas. Los tamaños inferiores
a `--font-size-4` se reservan para metadatos breves, nunca para instrucciones esenciales.

| Token | rem | px con raíz de 16 px | Uso preferente |
| --- | ---: | ---: | --- |
| `--font-size-1` | `0.5625rem` | 9 | Microetiqueta excepcional |
| `--font-size-2` | `0.625rem` | 10 | Etiqueta compacta o badge |
| `--font-size-3` | `0.6875rem` | 11 | Metadatos secundarios |
| `--font-size-4` | `0.75rem` | 12 | Base compacta de la aplicación |
| `--font-size-5` | `0.8125rem` | 13 | Texto secundario |
| `--font-size-6` | `0.875rem` | 14 | Ayuda destacada o título menor |
| `--font-size-7` | `1rem` | 16 | Título de tarjeta o diálogo |
| `--font-size-8` | `1.25rem` | 20 | Título principal intermedio |
| `--font-size-9` | `1.5rem` | 24 | Título principal amplio |

Si una aplicación contiene lectura prolongada, el texto de contenido parte de `1rem`; no se fuerza
la densidad operativa sobre artículos o documentación.

### 4.3. Colores

#### Superficies y bordes

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-app-background` | `#f8fafc` | Fondo general |
| `--color-surface` | `#ffffff` | Tarjetas, controles y diálogos |
| `--color-surface-muted` | `#f8fafc` | Hover o agrupación neutra leve |
| `--color-surface-subtle` | `#f1f5f9` | Subbloques, cabeceras y readonly |
| `--color-border` | `#e2e8f0` | Bordes normales |
| `--color-border-subtle` | `#f1f5f9` | Separadores suaves |
| `--color-input-border` | `#cbd5e1` | Controles editables |
| `--color-overlay` | `rgb(2 6 23 / 70%)` | Fondo de modal |

#### Texto

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-text-primary` | `#0f172a` | Texto de máxima prioridad |
| `--color-text-heading` | `#1e293b` | Títulos y valores destacados |
| `--color-text-secondary` | `#475569` | Etiquetas y explicaciones |
| `--color-text-muted` | `#64748b` | Metadatos y ayudas |
| `--color-text-light` | `#94a3b8` | Información no esencial |

`--color-text-light` no se usa sobre blanco para texto pequeño esencial. Placeholder, ayuda, error
y estado nunca sustituyen una etiqueta persistente.

#### Marca y acción primaria

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-primary` | `#dc2626` | Acción primaria, marca y selección |
| `--color-primary-hover` | `#b91c1c` | Hover y active primario |
| `--color-primary-light` | `#fef2f2` | Fondo de selección o error suave |
| `--color-primary-border` | `#fecaca` | Borde relacionado con rojo |
| `--color-primary-dark` | `#7f1d1d` | Texto rojo sobre fondo claro |
| `--color-store-card` | `#b8191c` | Superficie corporativa destacada |

La tarjeta corporativa roja es una excepción deliberada. No se convierte en el fondo habitual de
paneles ni formularios.

#### Estados semánticos

| Estado | Principal | Fondo | Texto |
| --- | --- | --- | --- |
| Información | `#2563eb` | `#eff6ff` | texto principal o azul verificado |
| Éxito | `#10b981` | `#ecfdf5` | `#047857` |
| Advertencia | `#d97706` | `#fffbeb` | `#92400e` |
| Error/peligro | `#dc2626` | `#fef2f2` | `#7f1d1d` |

El rojo de marca y el de error comparten familia, pero el significado lo aportan etiqueta, icono,
mensaje y contexto. Una acción primaria normal no debe parecer destructiva: un botón de peligro
nombra explícitamente la consecuencia.

#### Alias de compatibilidad

Los componentes compartidos más antiguos consumen los siguientes alias. Se mantienen al trasladar
el sistema a otro proyecto hasta que todos los componentes usen directamente los roles canónicos:

| Alias | Token canónico |
| --- | --- |
| `--color-brand` | `var(--color-primary)` |
| `--color-brand-logo` | `var(--color-primary)` |
| `--color-brand-hover` | `var(--color-primary-hover)` |
| `--color-text` | `var(--color-text-primary)` |
| `--color-muted` | `var(--color-text-muted)` |
| `--color-background` | `var(--color-app-background)` |
| `--color-border-soft` | `var(--color-border-subtle)` |

No se añaden nuevos usos de los alias si el token canónico expresa el mismo significado. No se
retiran mientras existan componentes copiados que los consuman.

### 4.4. Espaciado

Se usa una escala cerrada. La densidad se construye por composición; un contenedor puede sumar
padding, gap y margen sin introducir nuevos números.

| Token | rem | px |
| --- | ---: | ---: |
| `--space-1` | `0.125rem` | 2 |
| `--space-2` | `0.1875rem` | 3 |
| `--space-3` | `0.25rem` | 4 |
| `--space-4` | `0.375rem` | 6 |
| `--space-5` | `0.5rem` | 8 |
| `--space-6` | `0.625rem` | 10 |
| `--space-7` | `0.75rem` | 12 |
| `--space-8` | `0.875rem` | 14 |
| `--space-9` | `1rem` | 16 |
| `--space-10` | `1.25rem` | 20 |
| `--space-11` | `1.5rem` | 24 |

- `--space-3` a `--space-6`: controles y metadatos.
- `--space-5` a `--space-8`: padding de controles y cabeceras.
- `--space-7` a `--space-11`: grupos, tarjetas y regiones.
- `--space-page`: margen lateral fluido.

### 4.5. Radios

| Token | Valor | Uso |
| --- | --- | --- |
| `--radius-control` | `0.5rem` | Inputs, botones, badges y subbloques |
| `--radius-md` | `0.625rem` | Controles o paneles intermedios |
| `--radius-card` | `0.75rem` | Tarjetas y superficies |
| `--radius-interface-block` | `1rem` | Modal u overlay destacado |
| `--radius-pill` | `6.25rem` | Estados breves y chips |

`50%` se reserva para avatares, indicadores o iconos circulares. Un botón de texto no adopta forma
de píldora salvo que el patrón completo lo requiera.

### 4.6. Elevación y foco

| Token | Uso |
| --- | --- |
| `--shadow-surface` | Superficie habitual |
| `--shadow-1` | Hover o tarjeta enfatizada |
| `--shadow-2` | Menú flotante o panel elevado |
| `--shadow-3` | Diálogo |
| `--shadow-4` | Overlay crítico |
| `--shadow-focus-ring` | Halo interno de controles |

La elevación expresa superposición, no importancia comercial. No se combinan bordes gruesos,
sombras intensas y fondos coloreados salvo en un overlay modal.

### 4.7. Tamaños estructurales

| Token | Valor base | Contrato |
| --- | --- | --- |
| `--touch-target` | `2.75rem` (44 px) | Mínimo de controles accionables |
| `--content-width` | `72rem` | Contenido normal |
| `--space-page` | `clamp(.5rem, 2vw, 1rem)` | Margen lateral fluido |

En escritorio amplio el contenido operativo puede crecer hasta `96rem`; no debe superar `100rem`
sin necesidad documentada. Los bloques de lectura limitan su línea a unos `48rem`.

### 4.8. Bloque CSS inicial

Este bloque es el punto de partida canónico para un proyecto nuevo. Puede dividirse en varios
ficheros, pero los nombres semánticos se conservan.

```css
:root {
  --font-body: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji",
    "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
  --font-display: var(--font-body);
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    "Liberation Mono", "Courier New", monospace;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 700;
  --font-weight-black: 900;

  --color-app-background: #f8fafc;
  --color-surface: #ffffff;
  --color-surface-muted: #f8fafc;
  --color-surface-subtle: #f1f5f9;
  --color-border: #e2e8f0;
  --color-border-subtle: #f1f5f9;
  --color-input-border: #cbd5e1;
  --color-text-primary: #0f172a;
  --color-text-heading: #1e293b;
  --color-text-secondary: #475569;
  --color-text-muted: #64748b;
  --color-text-light: #94a3b8;
  --color-primary: #dc2626;
  --color-primary-hover: #b91c1c;
  --color-primary-light: #fef2f2;
  --color-primary-border: #fecaca;
  --color-primary-dark: #7f1d1d;
  --color-store-card: #b8191c;
  --color-info: #2563eb;
  --color-info-background: #eff6ff;
  --color-success: #10b981;
  --color-success-background: #ecfdf5;
  --color-success-text: #047857;
  --color-warning: #d97706;
  --color-warning-background: #fffbeb;
  --color-warning-text: #92400e;
  --color-danger: var(--color-primary);
  --color-error-background: var(--color-primary-light);
  --color-overlay: rgb(2 6 23 / 70%);
  --color-focus: var(--color-primary);

  /* Alias de compatibilidad para componentes compartidos existentes. */
  --color-brand: var(--color-primary);
  --color-brand-logo: var(--color-primary);
  --color-brand-hover: var(--color-primary-hover);
  --color-text: var(--color-text-primary);
  --color-muted: var(--color-text-muted);
  --color-background: var(--color-app-background);
  --color-border-soft: var(--color-border-subtle);

  --font-size-1: .5625rem;
  --font-size-2: .625rem;
  --font-size-3: .6875rem;
  --font-size-4: .75rem;
  --font-size-5: .8125rem;
  --font-size-6: .875rem;
  --font-size-7: 1rem;
  --font-size-8: 1.25rem;
  --font-size-9: 1.5rem;

  --space-1: .125rem;
  --space-2: .1875rem;
  --space-3: .25rem;
  --space-4: .375rem;
  --space-5: .5rem;
  --space-6: .625rem;
  --space-7: .75rem;
  --space-8: .875rem;
  --space-9: 1rem;
  --space-10: 1.25rem;
  --space-11: 1.5rem;

  --content-width: 72rem;
  --touch-target: 2.75rem;
  --space-page: clamp(.5rem, 2vw, 1rem);
  --radius-control: .5rem;
  --radius-md: .625rem;
  --radius-card: .75rem;
  --radius-interface-block: 1rem;
  --radius-pill: 6.25rem;
  --shadow-surface: 0 1px 2px rgb(15 23 42 / 6%);
  --shadow-1: 0 .125rem .5rem rgb(0 0 0 / 8%);
  --shadow-2: 0 .25rem .875rem rgb(20 27 38 / 6%);
  --shadow-3: 0 1.25rem 3.125rem rgb(0 0 0 / 25%);
  --shadow-4: 0 1.5rem 4rem rgb(15 23 42 / 28%);
  --shadow-focus-ring: 0 0 0 .125rem var(--color-primary-light);
}
```

## 5. Fundamentos CSS

### 5.1. Normalización mínima

```css
*, *::before, *::after { box-sizing: border-box; }

html {
  color-scheme: light;
  font-size: 100%;
  scroll-behavior: smooth;
}

body {
  min-width: 20rem;
  min-height: 100vh;
  margin: 0;
  background: var(--color-app-background);
  color: var(--color-text-primary);
  font-family: var(--font-body);
  font-size: var(--font-size-4);
  font-weight: var(--font-weight-regular);
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
}

button, input, select, textarea { font: inherit; }
button, a, input, select, textarea { touch-action: manipulation; }
img, svg { max-width: 100%; }
[hidden] { display: none !important; }
```

No se anula el zoom ni se fija una altura de viewport que impida crecer al contenido. Puede usarse
`100dvh` con fallback cuando deban contemplarse las barras del navegador móvil.

### 5.2. Foco

```css
:focus-visible {
  outline: .1875rem solid var(--color-focus);
  outline-offset: .1875rem;
}

:focus:not(:focus-visible) { outline: none; }
```

Un componente puede añadir `box-shadow: var(--shadow-focus-ring)`, pero no eliminar el outline sin
un reemplazo igual o más perceptible. El foco se comprueba sobre superficies claras y rojas y en
modo de colores forzados.

### 5.3. Nomenclatura y cascada

Se usa BEM práctico:

- `.card`: bloque;
- `.card__title`: elemento;
- `.card--highlighted`: variante;
- `.is-loading`: estado controlado por JavaScript;
- `[aria-current="step"]`: estado semántico cuando existe atributo ARIA adecuado.

Reglas:

- clases para presentación; IDs para asociación, anclas o scripting;
- selectores de una clase siempre que sea posible;
- anidamiento máximo recomendado de dos niveles;
- sin estilos inline;
- sin `!important`, excepto utilidades estructurales como `[hidden]` o `.sr-only`;
- sin selectores dependientes de textos traducibles;
- estilos base antes que componentes y adaptaciones responsive;
- todo override temporal documenta propietario, motivo y condición de retirada.

### 5.4. Orden recomendado

1. tokens;
2. reset y accesibilidad base;
3. shell y layout;
4. componentes compartidos;
5. componentes de dominio;
6. adaptaciones responsive;
7. utilidades excepcionales.

La especificidad no es un mecanismo de versionado. Si dos componentes necesitan el mismo patrón,
se extrae el propietario compartido.

## 6. Tipografía y contenido

### 6.1. Jerarquía

- Un único `h1` identifica la aplicación o vista global.
- `h2` encabeza una vista o región principal.
- `h3` encabeza una tarjeta o paso.
- `h4` encabeza un bloque auxiliar dentro de la tarjeta.
- El nivel semántico no se elige por tamaño visual.
- Los títulos usan `--color-text-heading`, peso 700 u 800 y altura de línea 1.25.
- Las etiquetas compactas pueden usar mayúsculas, `--font-size-2`, peso 700 y
  `letter-spacing: .05em`.

### 6.2. Redacción

- Botones y enlaces de acción empiezan por un verbo: `Guardar`, `Enviar solicitud`, `Volver`.
- Se evita `Aceptar` cuando pueda nombrarse la consecuencia concreta.
- Los títulos no terminan en punto.
- Las ayudas explican formato, finalidad o siguiente paso; no repiten la etiqueta.
- Los errores indican qué ocurrió y cómo corregirlo.
- Los mensajes de éxito confirman el resultado e incluyen referencia cuando exista.
- No se usan bloques completos en mayúsculas; se reservan a etiquetas breves.
- Los identificadores conservan capitalización y pueden usar `--font-mono`.

### 6.3. Desbordamiento

- Correos, URLs, IDs y direcciones usan `overflow-wrap: anywhere` si ocupan varias líneas.
- El truncado con elipsis solo se permite si el valor completo sigue disponible.
- No se reduce el tamaño tipográfico para hacer caber una traducción o un nombre largo.

## 7. Estructura de página

### 7.1. Shell

```html
<a class="skip-link" href="#main-content">Saltar al contenido</a>
<header class="app-header">...</header>
<main id="main-content" class="app-main" tabindex="-1">...</main>
<footer class="app-footer">...</footer>
```

La cabecera puede permanecer sticky con `z-index: 20`, fondo blanco casi opaco y borde inferior.
El contenido se centra con:

```css
.app-header__inner,
.app-main {
  width: min(100%, var(--content-width));
  margin-inline: auto;
  padding-inline: var(--space-page);
}
```

### 7.2. Cabecera

Contiene identidad de aplicación, contexto global imprescindible y acciones globales. Su altura
base es `3.5rem`. La marca usa un rectángulo rojo compacto; el avatar, un cuadrado de `2rem` con
radio circular. En pantallas estrechas se trunca texto secundario antes de ocultar una acción
esencial.

### 7.3. Introducción de vista

Una vista empieza con título, descripción breve y, si procede, acción de retorno. El bloque usa
superficie blanca, borde y sombra mínima. La descripción mantiene una longitud legible y no duplica
instrucciones de los campos.

### 7.4. Superficies y tarjetas

```css
.card {
  overflow: clip;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-surface);
}

.card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-7);
  padding: var(--space-7);
  border-bottom: 1px solid var(--color-border);
}

.card__body { padding: var(--space-8); }
```

No se anidan tarjetas completas. Para subdividir el cuerpo se usa un subbloque o una sección
separada por borde.

### 7.5. Grids

- La base es una columna.
- A partir de `37.5rem` un formulario puede usar dos columnas.
- Se emplea `minmax(0, 1fr)` para permitir truncado correcto.
- Un campo ancho usa `grid-column: 1 / -1`.
- El orden visual coincide con DOM y teclado.
- No se crean columnas solo para reducir la altura si empeoran la lectura.

## 8. Componentes

### 8.1. Botones

- **Primario:** siguiente acción principal; fondo rojo y texto blanco.
- **Secundario:** alternativa o retorno; fondo blanco, borde y texto oscuro.
- **Terciario:** acción de baja prioridad; texto o icono con objetivo táctil.
- **Peligro:** operación destructiva; texto explícito y confirmación cuando sea necesaria.

```css
.button {
  min-height: var(--touch-target);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-5);
  border-radius: var(--radius-control);
  padding: var(--space-5) var(--space-9);
  font-size: var(--font-size-4);
  font-weight: var(--font-weight-bold);
  line-height: 1.25;
  cursor: pointer;
}

.button--primary {
  border: 1px solid var(--color-primary);
  background: var(--color-primary);
  color: var(--color-surface);
}

.button--primary:hover,
.button--primary:active { background: var(--color-primary-hover); }

.button--secondary {
  border: 1px solid var(--color-input-border);
  background: var(--color-surface);
  color: var(--color-text-heading);
}

.button:disabled,
.button[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: .48;
}
```

Un botón solo icono incluye `aria-label` y mide al menos 44 × 44 px. Durante una operación se evita
el doble envío, se conserva la anchura y se muestra `Enviando…` o un indicador accesible.
`aria-disabled` exige impedir la acción también en JavaScript.

### 8.2. Formularios

Cada control tiene etiqueta persistente, indicador opcional u obligatorio, ayuda cuando aporte
información, control y error específico cuando falle.

```html
<div class="field">
  <label class="field-label" for="store-id">Código de tienda</label>
  <p class="field-help" id="store-id-help">Introduce cinco dígitos.</p>
  <input
    class="text-control"
    id="store-id"
    name="storeId"
    inputmode="numeric"
    aria-describedby="store-id-help store-id-error"
    aria-invalid="false"
  >
  <p class="field-error" id="store-id-error" hidden></p>
</div>
```

El bloque `.field` usa fondo `--color-surface-subtle`, borde y padding. El control interior vuelve a
blanco para distinguir el área editable.

#### Controles de texto

- anchura del 100 % y altura mínima de 44 px;
- borde `--color-input-border` y radio `--radius-control`;
- fondo blanco y texto `--color-text-heading`;
- padding `--space-5`/`--space-7`;
- foco con borde primario y halo;
- `textarea` redimensionable verticalmente.

`readonly` conserva contraste y selección; `disabled` indica indisponibilidad y no se usa para
datos que deban copiarse. El placeholder muestra un ejemplo, nunca la etiqueta.

#### Validación

- Se valida en cliente para respuesta rápida y siempre en servidor para autoridad.
- No se muestra error antes de que el usuario interactúe o intente continuar.
- El control inválido usa `aria-invalid="true"` y referencia su mensaje.
- Al enviar, el foco va al resumen de errores o al primer campo inválido.
- El mensaje no revela información sensible ni detalles internos.
- Un éxito parcial explica qué se completó y qué requiere reintento.

### 8.3. Checkbox, radio y tarjetas de elección

Se conservan los controles nativos y se amplía el área accionable con `<label>`. La opción
seleccionada usa borde primario y fondo `--color-primary-light`; `checked` es la fuente semántica.

```html
<label class="choice-option">
  <input type="radio" name="requestType" value="open">
  <span>Apertura</span>
</label>
```

Los grupos de radio usan `<fieldset>` y `<legend>`. El grid es de una columna en móvil y crece a
dos o tres según la longitud de las opciones.

### 8.4. Selectores, autocomplete y combobox

- El select nativo es preferente para listas cortas y estables.
- Un autocomplete usa `role="combobox"`, `aria-expanded`, `aria-controls`,
  `aria-activedescendant` y opciones identificables.
- Flechas recorren opciones, Enter selecciona y Escape cierra sin borrar.
- Hover, opción activa y `aria-selected="true"` comparten tratamiento.
- La lista usa fondo blanco, borde, `--shadow-2`, altura limitada y scroll propio.
- El texto visible no se considera válido hasta confirmar una opción cuando el dominio lo exige.

### 8.5. Carga de archivos

La dropzone complementa al `<input type="file">`; no lo sustituye. Admite click, teclado y selección
convencional.

Estados mínimos:

- vacío, con tipos y límites;
- drag over, con borde y fondo destacados;
- archivo seleccionado, con nombre y retirada;
- lectura o subida en progreso;
- completado;
- rechazado, con causa y corrección;
- error remoto y reintento seguro.

La zona tiene altura visual mínima de `4.5rem`; cada retirada mantiene 44 × 44 px. Los nombres
largos se truncan sin perder su valor accesible. Navegador y servidor validan tipo y tamaño; el
servidor valida además contenido y autorización.

### 8.6. Alertas y mensajes

Información, éxito, advertencia y error incluyen texto claro, icono opcional y acción de
recuperación cuando proceda.

| Tipo | Semántica | Región viva |
| --- | --- | --- |
| Información persistente | sección o `status` | `polite` si cambia |
| Éxito tras acción | `role="status"` | `polite` |
| Advertencia corregible | texto asociado | normalmente `polite` |
| Error bloqueante | `role="alert"` | `assertive`, sin abuso |

Una alerta no desaparece antes de poder leerse. No se usa toast para información que el usuario
necesita consultar o corregir.

### 8.7. Badges y chips

Los badges muestran estado o metadatos breves, no acciones. Usan `--radius-pill`, tamaño compacto y
contraste suficiente. Un chip eliminable contiene botón accesible y no depende de una `x` sin
nombre.

### 8.8. Tablas

- `<table>`, `<caption>`, `<thead>`, `<tbody>` y cabeceras con `scope`.
- `aria-sort` en la cabecera que ordena.
- Números alineados de forma consistente; IDs pueden usar monoespaciada.
- Cabecera sticky solo dentro de un contenedor de scroll identificable.
- Hover usa `--color-surface-muted`; la selección requiere estado adicional.
- En móvil se prefiere scroll horizontal accesible a ocultar columnas esenciales.
- El contenedor enfocable explica que puede desplazarse si no resulta evidente.
- Acciones por fila conservan objetivo táctil aunque el icono sea pequeño.
- El estado vacío ocupa una fila válida y explica el siguiente paso.

### 8.9. Tarjeta destacada corporativa

Una entidad seleccionada importante puede usar `--color-store-card`, texto blanco, badges
translúcidos y separadores blancos al 25 %. Se reserva a una única entidad focal por vista.

Si el contenido crece, el nombre y dato principal tienen prioridad; los metadatos se reorganizan,
no se reducen por debajo de la escala; un truncado conserva el valor completo y todo botón mantiene
foco visible sobre rojo.

### 8.10. Diálogos

Se prefiere `<dialog>`. Un diálogo define:

- título con `aria-labelledby` y descripción opcional con `aria-describedby`;
- foco inicial, contención y restauración al elemento que lo abrió;
- Escape cuando no exista una operación irreversible en curso;
- botón explícito para cerrar o continuar;
- backdrop `--color-overlay` y `--shadow-3` o `--shadow-4`.

No se usa `alert()` como interfaz principal. Un diálogo de éxito muestra icono, resultado,
referencia y una acción siguiente. Una confirmación destructiva nombra objeto y consecuencia.

### 8.11. Overlay de carga y progreso

Se reserva al arranque o a operaciones que bloquean toda la aplicación. Las esperas locales usan
indicadores dentro del componente afectado.

El overlay:

- cubre el viewport con fondo oscuro al 70 %;
- bloquea el scroll del body;
- contiene una superficie blanca de máximo aproximado de `24rem`;
- expone `role="status"` y `aria-live="polite"`;
- muestra estimación solo si es honesta;
- no inventa porcentajes si no existe progreso real;
- anuncia espera prolongada y recuperación.

Un spinner decorativo lleva `aria-hidden="true"`; el texto anuncia el estado.

### 8.12. Navegación y pasos

La acción `Volver` se sitúa cerca del título y no se confunde con cancelar un envío iniciado. Un
flujo multipaso muestra paso actual, completados y restantes con texto y atributos, no solo color.

- `aria-current="step"` identifica el paso activo.
- Los completados no son botones si no son navegables.
- Al cambiar de paso se actualizan título y foco.
- Los datos se conservan o se advierte antes de descartarlos.
- En móvil se compacta el rail, manteniendo el texto del paso actual.

### 8.13. Estados de región

Una región que consulta datos define:

- **carga:** skeleton o texto con dimensiones estables;
- **vacío esperado:** explicación neutral y acción posible;
- **vacío por filtros:** resumen y forma de limpiarlos;
- **error:** causa comprensible, datos conservados y reintento;
- **contenido:** transición sin salto evitable.

Los skeletons son decorativos, respetan movimiento reducido y no sustituyen la descripción de
estado para tecnologías de asistencia.

### 8.14. Tooltips

Se evitan para información imprescindible. Si se usan, aparecen con hover y foco, se cierran con
Escape, no contienen controles y se conectan mediante `aria-describedby` cuando corresponda. Su
contenido debe tener alternativa comprensible en táctil.

## 9. Iconografía e imágenes

- Se priorizan iconos SVG existentes o una única biblioteca autorizada.
- Un icono decorativo usa `aria-hidden="true"` y `focusable="false"`.
- Un control solo icono tiene nombre accesible.
- El icono no sustituye texto en acciones infrecuentes o críticas.
- Trazo, tamaño y alineación son consistentes dentro de una vista.
- No se usa emoji como iconografía funcional.
- Imágenes informativas incluyen `alt`; las decorativas usan `alt=""`.
- No se incorporan recursos remotos sin revisar CSP, privacidad, disponibilidad y peso.

## 10. Responsive y adaptación

### 10.1. Contrato de anchuras

| Franja | Referencia | Comportamiento |
| --- | --- | --- |
| 320–639 px | Smartphone | Una columna, acciones táctiles, sin recorte |
| Desde 600 px | Formulario medio | Dos columnas si la secuencia lo permite |
| Desde 640 px | Tablet horizontal | Más densidad sin alterar orden |
| Desde 768 px | Tablet/portátil estrecho | Diálogos y grids amplían padding |
| Desde 1024 px | Portátil | Workspace compacto y rail de progreso |
| Desde 1440 px | Monitor grande | Contenido hasta 96rem |

Los breakpoints se eligen por rotura real del contenido. La tabla mantiene coherencia, no detecta
dispositivos.

### 10.2. Altura reducida

En portátiles con altura de `800px` o inferior:

- se reduce espacio ornamental mediante tokens existentes;
- las acciones permanecen accesibles;
- overlays caben o permiten scroll interno;
- no se oculta ayuda esencial;
- sticky headers y footers no inutilizan el área de contenido.

### 10.3. Área segura, orientación y zoom

Las acciones fijadas al fondo incorporan:

```css
padding-bottom: max(var(--space-7), env(safe-area-inset-bottom));
```

La orientación no se bloquea. A 200 % de zoom, la interfaz se reordena sin solapamiento ni scroll
horizontal global; se acepta scroll local en tablas y contenido intrínsecamente ancho.

### 10.4. Container queries

Pueden usarse cuando un componente se incrusta en shells diferentes. Se mantiene fallback de una
columna para navegadores o webviews que no apliquen la consulta.

## 11. Accesibilidad

El objetivo mínimo es WCAG 2.2 nivel AA, además de los requisitos internos.

### 11.1. Semántica

- landmarks cuando correspondan;
- encabezados en orden lógico;
- botones para acciones y enlaces para navegación;
- listas, tablas, fieldsets y diálogos nativos antes que recreaciones con `div`;
- ARIA solo completa semántica ausente, nunca contradice HTML nativo.

### 11.2. Teclado y foco

- Todo elemento interactivo es alcanzable y operable.
- El orden de tabulación coincide con la lectura; no hay `tabindex` positivo.
- El foco no queda oculto por elementos sticky.
- Un cambio de vista mueve el foco al nuevo título o región principal.
- Al cerrar modal, menú o popover, el foco vuelve al disparador.
- Los atajos no dependen de una única tecla imprimible sin poder desactivarlos.

### 11.3. Contraste

- Texto normal: mínimo 4.5:1.
- Texto grande: mínimo 3:1.
- Controles, iconos funcionales y foco: mínimo 3:1 frente a colores adyacentes.
- Hover, selected, disabled y error se comprueban individualmente.
- Disabled puede reducir contraste, pero su propósito y razón siguen siendo comprensibles.

### 11.4. Objetivos y puntero

El contrato interno usa 44 × 44 px para acciones táctiles. Los enlaces inline son la excepción
natural. Acciones adyacentes mantienen separación suficiente para evitar activación accidental.

### 11.5. Lectores de pantalla

- `.sr-only` oculta visualmente sin retirar del árbol accesible.
- Regiones dinámicas anuncian cambios una sola vez.
- El nombre de un icono describe la acción: `Eliminar archivo`, no `Cruz`.
- El progreso expone valor actual, mínimo y máximo cuando son reales.
- Errores se asocian a controles y el resumen enlaza con el campo.

### 11.6. Preferencias

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}

@media (forced-colors: active) {
  button, input, select, textarea { border: 1px solid ButtonText; }
}
```

Si se añade tema oscuro, se diseña como un conjunto completo de tokens y se prueba aparte. No se
obtiene invirtiendo colores automáticamente.

## 12. Movimiento y feedback

- 100–150 ms para hover; 150–250 ms para abrir, cerrar o cambiar estado.
- Se animan `opacity` y `transform`; se evita animar layout o altura.
- El estado pressed es inmediato.
- Una operación superior a aproximadamente un segundo muestra feedback.
- Una operación larga explica qué realiza y permite reintento seguro si falla.
- No se encadenan animaciones de entrada en formularios operativos.
- El movimiento no es la única señal de cambio.

## 13. Rendimiento y dependencias visuales

- Reutilizar activos existentes antes de añadir una dependencia.
- Evitar fuentes externas; si son obligatorias, definir fallback y carga.
- Una biblioteca de iconos requiere revisar licencia, CSP, peso y accesibilidad.
- SVG pequeños pueden incluirse inline; no se duplican masivamente si existe helper.
- CSS crítico del shell se sirve con la vista para evitar una interfaz sin estilos.
- No se usan imágenes para efectos que CSS resuelve de forma más ligera.
- `backdrop-filter` no es la única separación del overlay; existe fondo opaco de fallback.
- Listas y tablas grandes limitan renderizado o paginan según medición.

## 14. Seguridad y privacidad de la interfaz

- No se insertan valores de usuario con `innerHTML`; se usa texto seguro o sanitización explícita.
- Los errores no exponen stacks, IDs sensibles, rutas de Drive ni configuración.
- Enlaces externos indican destino cuando no sea previsible y abren pestañas de forma segura.
- La UI no presenta una acción como completada antes de confirmación del servidor.
- Un control oculto o deshabilitado no sustituye autorización en servidor.
- Datos personales no aparecen en capturas, demos o estados de ejemplo.

## 15. Nomenclatura de componentes

| Correcto | Evitar | Motivo |
| --- | --- | --- |
| `.button--primary` | `.red-button` | Describe rol, no color |
| `.field-error` | `.text-below-input` | Describe semántica |
| `.card__header` | `.top-gray-box` | No acopla estructura y color |
| `.is-loading` | `.spinning` | El estado no depende de animación |
| `.status--success` | `.green-message` | Conserva significado sin color |

Los estados nativos o ARIA son fuente preferente: `:disabled`, `:checked`, `[aria-expanded]`,
`[aria-selected]`, `[aria-current]` y `[aria-invalid]`.

## 16. Antipatrones

- Copiar un componente y modificar tres valores en lugar de ampliar su API.
- Añadir colores, sombras, radios, tamaños o espacios literales sin comprobar tokens.
- Usar rojo para múltiples niveles jerárquicos en una misma región.
- Convertir cada sección en tarjeta y cada texto en badge.
- Ocultar etiquetas y depender de placeholder o tooltip.
- Eliminar outline sin reemplazo visible.
- Usar `div` como botón, tabla, checkbox o diálogo.
- Mostrar validación únicamente con borde rojo.
- Deshabilitar una acción sin explicar la precondición cuando no sea evidente.
- Fijar alturas que cortan traducciones, zoom o mensajes de error.
- Ocultar columnas esenciales en móvil para evitar scroll local.
- Colocar acciones destructivas junto a la primaria sin separación.
- Usar emoji como icono de estado.
- Animar continuamente progreso indeterminado con movimiento intenso.
- Editar bundles generados o acumular overrides sin propietario.
- Importar CSS de otro proyecto sin retirar reglas de dominio no utilizadas.

## 17. Plantilla de componente

Cada componente compartido documenta junto a su código:

```markdown
### Nombre

- Propósito:
- Cuándo usarlo:
- Cuándo no usarlo:
- Anatomía:
- Variantes:
- Estados:
- Teclado y foco:
- Atributos accesibles:
- Comportamiento responsive:
- Límites de contenido:
- Dependencias:
- Pruebas:
```

Ejemplo y código cubren normal, foco, disabled, carga y error cuando sean aplicables.

## 18. Adopción en un proyecto nuevo

### 18.1. Secuencia

1. Copiar este documento y los tokens canónicos.
2. Crear reset, shell y utilidades accesibles.
3. Implementar botones, campos, tarjetas, estados y diálogo base.
4. Componer componentes de dominio sin introducir otra paleta.
5. Documentar en `SPECIFICATION.md` nombre, navegación, componentes especiales y excepciones.
6. Probar franjas responsive, zoom, teclado y estados asíncronos.
7. Comparar visualmente con una aplicación de referencia.
8. Registrar cualquier desviación deliberada antes de publicar.

### 18.2. Personalización

Se personalizan nombre, marca textual, contenido, arquitectura de información, ancho necesario,
componentes de dominio y etiquetas de acciones.

Se conservan salvo decisión del sistema compartido: paleta, familias y escala tipográfica,
espaciado, radios, sombras, tamaños táctiles, estados, foco y breakpoints base.

### 18.3. Evitar contaminación entre dominios

Al copiar la implementación se retiran selectores propios del origen. Un proyecto nuevo copia
patrones compartidos, no nombres como `.modification-store-card` si no existe ese concepto. En su
lugar compone `.card`, `.badge`, `.status` y las variantes pertinentes.

## 19. Verificación

### 19.1. Matriz manual mínima

| Dimensión | Casos |
| --- | --- |
| Anchura | 320, 375, 640, 1024 y 1440 px |
| Altura | 568, 720, 800 y 900 px |
| Zoom | 100 %, 200 % y 400 % cuando aplique |
| Entrada | Ratón, teclado y táctil simulado |
| Preferencias | Movimiento reducido y colores forzados |
| Datos | Vacío, típico, máximo, texto largo y caracteres especiales |
| Red | Normal, lenta, fallo y reintento |
| Formularios | Inicial, inválido, válido, enviando, éxito y error |

### 19.2. Recorrido por teclado

Verificar skip link, foco inicial y orden, Enter y Espacio, Escape en overlays, flechas en radios o
combobox, foco tras error/cambio/cierre y ausencia de trampas.

### 19.3. Evidencia visual

Capturar página inicial, formulario representativo, campo con foco y error, carga, éxito o diálogo,
tabla o lista amplia, móvil y portátil. Se toleran diferencias menores de renderizado de fuente,
pero no cambios de jerarquía, espaciado, color semántico, foco o recorte.

### 19.4. Lista de control previa a entrega

- [ ] Usa exclusivamente tokens existentes o documenta los nuevos.
- [ ] Mantiene una acción primaria por grupo.
- [ ] Todos los controles tienen etiqueta y objetivo táctil adecuado.
- [ ] Hover, focus, active, disabled, loading, success y error están resueltos.
- [ ] Funciona desde 320 px y a 200 % de zoom.
- [ ] Tablas y contenido ancho usan scroll local accesible.
- [ ] No depende solo de color, icono, hover, movimiento o tooltip.
- [ ] Diálogos gestionan foco inicial, contención, cierre y restauración.
- [ ] Cambios dinámicos se anuncian con urgencia adecuada.
- [ ] Movimiento reducido y colores forzados conservan significado.
- [ ] No se añadieron fuentes o librerías sin evaluación.
- [ ] No se editaron artefactos generados.
- [ ] Las excepciones están en la especificación.
- [ ] Se ejecutaron las pruebas de `TESTING.md` y la especificación.

## 20. Gobierno y evolución

Un cambio al sistema visual debe responder:

1. ¿Qué problema observable resuelve?
2. ¿Es compartido o exclusivo de una aplicación?
3. ¿Puede componerse con tokens y patrones actuales?
4. ¿Qué estados, tamaños y tecnologías de asistencia se probaron?
5. ¿Rompe nombres o significados existentes?
6. ¿Qué proyectos deben migrar?

Si el cambio es compartido, se actualizan en el mismo trabajo este documento, el CSS propietario,
los ejemplos, las pruebas y las notas de migración si cambia un contrato.

No se declara que un componente es accesible, consistente o responsive solo mediante revisión de
código. La afirmación requiere verificación proporcional con navegador, teclado, tamaños
representativos y, cuando el riesgo lo justifique, herramientas automáticas y lector de pantalla.
