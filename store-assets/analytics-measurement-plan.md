# Plan de medición de Lunentra

## Principios

- La medición requiere consentimiento explícito y puede revocarse desde la app.
- No se envían sueños, respuestas del perfil, emociones escritas ni contenido de IA.
- No se usan identificadores publicitarios ni personalización de anuncios.
- Google Analytics recibe eventos anónimos; Firestore conserva la copia operativa
  autenticada de los mismos eventos solo cuando existe consentimiento.

## Eventos y finalidad

| Etapa | Evento | Uso |
|---|---|---|
| Entrada | `screen_view` | Navegación y adopción de pantallas |
| Intención | `home_primary_cta_clicked` | Inicio del flujo principal |
| Activación | `guest_demo_completed` | Invitados que alcanzan el primer valor |
| Activación | `dream_interpretation_completed` | Lecturas completadas |
| Cuenta | `account_cta_clicked` | Interés en crear cuenta |
| Cuenta | `account_conversion_completed` | Conversión de invitado a cuenta |
| Retención | `reflection_saved` | Uso reflexivo posterior a la lectura |
| Retención | `monthly_analysis_generated` | Adopción de la función avanzada |
| Monetización | `paywall_shown` | Exposición al plan Premium |
| Monetización | `paywall_dismissed` | Abandono del paywall |
| Monetización | `purchase_started` | Inicio de compra |
| Monetización | `purchase_succeeded` | Compra validada |
| Monetización | `purchase_failed` | Fallo de compra por código |
| Restauración | `restore_started` / `restore_succeeded` / `restore_failed` | Salud del flujo de restauración |

## Eventos clave de GA4

- `dream_interpretation_completed`: activación principal.
- `account_conversion_completed`: conversión a cuenta persistente.
- `purchase_succeeded`: conversión Premium.

## Configuración de la propiedad GA4

- Propiedad: `Lunentra App` (`550231971`).
- Zona horaria y moneda: España (hora peninsular) y EUR.
- Sector: Salud; Google Signals y la recogida granular de ubicación/dispositivo
  permanecen desactivados.
- Conservación de eventos y usuarios: 14 meses, reiniciada con nueva actividad.

## Dimensiones

### Propiedades de usuario

- `account_type`: `signed_out`, `guest`, `free` o `premium`.
- `premium_status`: `active` o `inactive`.

### Parámetros de evento

- `reason`: origen del paywall o acción.
- `source`: superficie que originó la acción.
- `package_id`: paquete de suscripción seleccionado.
- `account_type`: segmento en el momento del evento.
- `method`: método usado para convertir una cuenta invitada.
- `code`: código técnico seguro de un fallo.

## Embudos y cuadros de mando

1. Activación: `home_primary_cta_clicked` → `dream_interpretation_completed`.
2. Cuenta: `guest_demo_completed` → `account_cta_clicked` → `account_conversion_completed`.
3. Premium: `paywall_shown` → `purchase_started` → `purchase_succeeded`.
4. Retención: usuarios activos D1, D7 y D30, más `reflection_saved` y `monthly_analysis_generated`.
5. Calidad: usuarios sin fallos, fallos por versión, ANR y no fatales.
6. Rendimiento: inicio de app, renderizado de pantallas y latencia de cada `callable_*`.

## Criterios de salud iniciales

- Activación principal: establecer la línea base tras las primeras 100 instalaciones consentidas.
- Conversión de paywall: establecer la línea base tras 100 exposiciones consentidas.
- Usuarios sin fallos: objetivo mínimo de 99,5 %.
- ANR: objetivo inferior al 0,47 %.
- Latencia p95 de funciones interactivas: objetivo inferior a 8 segundos, separando las llamadas de IA.
