# Sistema de estudio: "Falladas", prioridad y día oficial (plan v2)

## Cómo funciona hoy (análisis)

- `src/lib/srs.ts`: única lógica de intervalos (1→2→5→10→30 días; fallo = etapa 1 y mañana). Se conserva sin cambios.
- `flashcards`: `learning_stage`, `next_review_at`, `is_learned`, `correct_answers_count`. Toda la persistencia ya vive ahí.
- `card_review_history`: cada respuesta con `is_correct` y `answered_at`. Hoy solo alimenta estadísticas.
- Contadores de `subjects/$id` y cola de `subjects/$id/study` usan `new Date()` del navegador y no distinguen falladas.

**Problema clave**: al fallar, la carta vuelve a etapa 1 con `correct_answers_count = 0`, idéntica a una carta nueva. Por eso el estado "Fallada" se derivará del historial, nunca de `learning_stage` ni de `correct_answers_count`.

## Precisiones incorporadas

### 1. Estados (definición exacta)
- **Nueva**: sin ningún registro en `card_review_history`.
- **Fallada**: tiene registros, el último por `answered_at` tiene `is_correct = false`, y `is_learned = false`.
- **En aprendizaje**: tiene registros, el último por `answered_at` tiene `is_correct = true`, y `is_learned = false`.
- **Aprendida**: `is_learned = true`.

### 2. Tras volver a fallar
Una carta fallada que se vuelve a fallar inserta otro registro con `is_correct = false` → sigue teniendo historial y última respuesta incorrecta → **permanece en Falladas**, con `next_review_at` recalculado por `applyAnswer` de `srs.ts`. Nunca puede volver a "Nueva" porque "Nueva" exige historial vacío y los registros no se borran. Si se responde bien, el último registro pasa a `is_correct = true` → pasa a "En aprendizaje" con las etapas SRS existentes. No se modifica `srs.ts`.

### 3. Prioridad de la cola diaria
Orden estricto hasta llenar el límite: **1) falladas vencidas → 2) repasos de aprendizaje vencidos → 3) nuevas → 4) aprendidas (según el flujo existente)**. "Vencida" = `next_review_at <= ahora oficial`. Las no vencidas no aparecen. Con límite 10, 3 falladas + 2 repasos + 100 nuevas → 3 + 2 + 5 nuevas.

### 4-5. Reloj oficial único
Zona horaria fija `America/Bogota`; el día empieza a las 00:00:00 de esa zona. Una sola fuente de tiempo (`serverNow()`), usada por contadores, `next_review_at`, disponibilidad, cambio de día, límite diario, construcción de la cola y registro de respuestas. Ningún `new Date()` suelto en la lógica de estudio (lo verificaré con una búsqueda final en las rutas afectadas).

### 6. Sin datos duplicados
Solo `flashcards` y `card_review_history`. Cero tablas, cero columnas, cero SQL sobre tu Supabase.

## Archivos y funciones

**Nuevos**
- `src/lib/clock.ts`
  - `syncClock()`: mide el desfase con la hora del servidor (cabecera `Date` de una petición a tu Supabase) y lo guarda en memoria.
  - `serverNow(): Date` — única fuente de tiempo.
  - `startOfDay(d)`, `endOfDay(d)`, `dayKey(d)`, `msUntilNextMidnight()` en `America/Bogota`.
  - `useOfficialDay()`: hook que devuelve el `dayKey` actual, re-sincroniza al recuperar el foco y programa un temporizador exacto hasta las 00:00:00.
- `src/lib/card-state.ts`
  - `type CardState = "new" | "failed" | "learning" | "learned"`.
  - `fetchLastAnswers(cardIds): Map<cardId, {is_correct, answered_at}>` (consulta `card_review_history` ordenada por `answered_at` y se queda con la última por carta).
  - `classifyCard(card, lastAnswer): CardState`.
  - `countByState(cards, lastAnswers, now)` para los contadores (Falladas cuenta solo las vencidas).
- `src/lib/study-queue.ts`
  - `buildDailyQueue({ cards, lastAnswers, now, limit })`: aplica la prioridad de la sección 3 y devuelve `{ queue, breakdown: { failed, learning, new } }`.

**Modificados**
- `src/routes/_authenticated/subjects.$id.index.tsx`: cinco contadores (Para hoy / Nuevas / **Falladas** / En aprendizaje / Aprendidas) con estilo de alerta propio y acceso "Estudiar falladas" (`?mode=failed`).
- `src/routes/_authenticated/subjects.$id.study.tsx`: la cola se arma con `buildDailyQueue`, muestra el desglose de la sesión y usa `serverNow()` al responder y al escribir historial.
- `src/routes/_authenticated/dashboard.tsx`: contador global de Falladas + reloj oficial.
- `src/routes/_authenticated/learned.tsx`: reloj oficial.
- `src/routes/__root.tsx`: `syncClock()` al arrancar y tick de medianoche que invalida las queries de contadores y colas (sin recargar ni cerrar sesión).

## Cambio de día
A las 00:00:00 de Bogotá el temporizador dispara, actualiza el `dayKey`, invalida `subject-counts`, `dashboard-stats` y las colas → contadores y disponibilidad se refrescan solos. Si la app se abre después de medianoche, el `dayKey` se calcula directamente con el reloj oficial.

## Pruebas (vitest, reloj simulado)
- 10 nuevas → 7 correctas a aprendizaje, 3 incorrectas a falladas.
- Día siguiente, límite 10 → 3 falladas + 7 nuevas, en ese orden.
- 3 falladas + 2 repasos + 100 nuevas, límite 10 → 3 + 2 + 5.
- Fallar de nuevo una fallada: sigue en falladas, con nuevo `next_review_at`, y `classifyCard` **nunca** devuelve `"new"` (prueba explícita del punto 7).
- Fallada respondida bien → "learning" y avanza de etapa.
- Falladas/repasos no vencidos no aparecen; las nuevas no se pierden ni se saltan.
- Lunes 10:00 → lunes 23:59 sigue siendo lunes; martes 00:00 nuevo día; martes 00:01 nuevo ciclo.
- `serverNow()` refleja el desfase del servidor, no el reloj local.
