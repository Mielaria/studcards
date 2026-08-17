# Sistema de estudio: "Falladas", prioridad y día oficial

## Cómo funciona hoy (análisis)

- `src/lib/srs.ts`: única lógica de repetición (etapas 1→2→5→10→30 días, fallo = etapa 1 + mañana). Se reutiliza tal cual.
- `flashcards` (tu Supabase): `learning_stage`, `next_review_at`, `is_learned`, `correct_answers_count`. Aquí ya está toda la persistencia; no se crea nada paralelo.
- `card_review_history`: guarda cada respuesta (`is_correct`, `answered_at`, etapas). Hoy solo se usa para estadísticas.
- Contadores actuales (`subjects/$id`): Para hoy / Nuevas / En aprendizaje / Aprendidas, calculados con `new Date()` del navegador.
- Sesión de estudio (`subjects/$id/study`): trae todas las cartas `is_learned=false` con `next_review_at <= ahora`, las baraja y corta al número pedido. No hay prioridad ni concepto de "fallada".

**Problema clave**: una carta fallada queda en etapa 1 con `correct_answers_count = 0`, exactamente igual que una carta nueva. Por eso hoy no se pueden distinguir.

## Qué voy a cambiar

### 1. Estado "Fallada" sin tocar tu base de datos
No aplicaré ninguna migración. El estado se deriva de datos que ya guardas:

- **Nueva**: sin ninguna fila en `card_review_history`.
- **Fallada**: su última respuesta (por `answered_at`) fue incorrecta y `is_learned = false`.
- **En aprendizaje**: última respuesta correcta y `is_learned = false`.
- **Aprendida**: `is_learned = true`.

Nuevo archivo `src/lib/card-state.ts` con la clasificación + un helper que consulta las últimas respuestas por carta. Persistencia garantizada (todo vive en tu Supabase): sobrevive recarga, cierre de sesión y cambio de dispositivo.

### 2. Reloj oficial sincronizado
Nuevo `src/lib/clock.ts`:
- Al arrancar, lee la cabecera `Date` de una petición a tu Supabase y calcula el desfase con el reloj local; expone `serverNow()`.
- Zona horaria fija de la app (`America/Bogota`) para calcular inicio/fin de día, con `startOfDay()` / `endOfDay()` / `todayKey()`.
- Re-sincroniza al volver el foco a la pestaña y cada cierto tiempo.
- Hook `useOfficialDay()`: programa un temporizador exacto hasta las 00:00:00 y, al cruzarlo, invalida las queries de React Query → contadores y cartas disponibles se actualizan solos, sin recargar ni cerrar sesión.
- Todas las consultas y `applyAnswer` pasan a usar `serverNow()` en lugar de `new Date()`.

### 3. Cola de estudio con prioridad
En `subjects/$id/study` (y el mismo helper reutilizable en `src/lib/study-queue.ts`), la sesión se arma en este orden hasta llenar el límite:
1. Falladas vencidas (`next_review_at <= ahora oficial`)
2. En aprendizaje vencidas
3. Nuevas
4. Aprendidas, solo según el flujo existente de la sección "Aprendidas"

Las falladas que aún no vencen no aparecen antes de tiempo. Las falladas nunca bloquean: si hay 3 falladas + 2 en aprendizaje y límite 10, la sesión es 3 + 2 + 5 nuevas.

### 4. UI: quinta sección "Falladas"
- `subjects/$id/index.tsx`: la fila de contadores pasa a 5 tarjetas — Para hoy / Nuevas / **Falladas** / En aprendizaje / Aprendidas, con color de alerta propio y acceso directo a estudiar solo las falladas (`?mode=failed`).
- El contador de "Falladas" muestra únicamente las pendientes ya disponibles según su fecha.
- `dashboard.tsx`: se añade el mismo contador global de Falladas.
- La pantalla de estudio muestra el desglose de la sesión ("3 falladas · 2 repaso · 5 nuevas").

### 5. Pruebas
`src/lib/__tests__/study-queue.test.ts` y `clock.test.ts` (vitest), con reloj simulado:
- 10 nuevas → 7 correctas pasan a aprendizaje, 3 incorrectas a falladas.
- Al día siguiente con límite 10: 3 falladas + 7 nuevas, en ese orden.
- Fallar de nuevo una fallada la mantiene en falladas con nueva fecha; acertarla la pasa a aprendizaje.
- Las falladas no vencidas no se adelantan; las nuevas no se pierden ni se saltan.
- Cambio de día exacto a las 00:00: estudiar el lunes 10:00 no cuenta dos días; a las 00:01 del martes hay nuevo ciclo.
- El reloj usa el desfase del servidor, no solo el local.

## Archivos
- Nuevos: `src/lib/clock.ts`, `src/lib/card-state.ts`, `src/lib/study-queue.ts`, tests.
- Modificados: `src/routes/_authenticated/subjects.$id.index.tsx`, `subjects.$id.study.tsx`, `dashboard.tsx`, `learned.tsx` (usar reloj oficial), `src/routes/__root.tsx` (arranque del reloj + tick de medianoche).
- Sin cambios en `src/lib/srs.ts` (misma lógica de intervalos) y **cero SQL sobre tu Supabase**.
