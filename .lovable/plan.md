# Plan: Importar StudCards al proyecto vacío

## Resumen
Migrar la aplicación completa **StudCards** (proyecto de origen "Studia Smart") al proyecto actual, conservando código, diseño, componentes y lógica. El backend apuntará a tu **Supabase propio** (sin Lovable Cloud) y se configurará la generación de cartas con IA mediante tu API key de OpenAI.

## Alcance incluido
- Todo el código frontend: rutas, componentes, hooks, lógica SRS, tema, estilos.
- Integración con Supabase: clientes generados, middleware de auth, server function de IA.
- Migraciones SQL para el esquema (perfiles, materias, flashcards, sesiones, historial, triggers).
- Dependencias adicionales necesarias (`jspdf`, `react-image-crop`, etc.).
- Configuración de secrets y variables de entorno para tu Supabase propio y OpenAI.

## Fases de trabajo

### 1. Copia del código fuente
- Sobrescribir `src/` con el contenido completo del proyecto de origen:
  - `src/routes/` — landing, auth, reset-password, área autenticada (dashboard, create, subjects, study, practice, learned, stats, profile).
  - `src/components/` — AppShell, BottomNav, ThemeToggle, EditCardModal, ExplanationModal, DataTransferDialogs y todos los componentes `ui/` de shadcn.
  - `src/lib/` — srs, backup, image-crop, ai-cards.functions, utilidades.
  - `src/hooks/` — useSession.
  - `src/integrations/supabase/` — clientes y middlewares generados.
  - `src/router.tsx`, `src/server.ts`, `src/start.ts`, `src/routes/__root.tsx`.
- Copiar `src/styles.css` con el tema completo de StudCards (colores, tipografía Manrope/Sora).
- Copiar `supabase/migrations/` y `supabase/config.toml`.
- Copiar `public/favicon.ico`.

### 2. Dependencias
- Reemplazar `package.json` por el del proyecto de origen.
- Instalar dependencias con `bun install`.
- Dependencias clave a asegurar: `@supabase/supabase-js`, `jspdf`, `react-image-crop`, `sonner`, `zod`, `date-fns`, `recharts`, todas las librerías Radix usadas por shadcn.

### 3. Configuración de entorno y secrets
- No copiar el `.env` del proyecto de origen (contiene credenciales ajenas).
- Crear `.env` local del nuevo proyecto con placeholders para:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `studcards` (API key de OpenAI para generación de cartas)
- Guardar los secrets reales mediante el formulario seguro de Lovable (`add_secret`) cuando estés listo para proporcionarlos.

### 4. Migraciones en tu Supabase propio
- Las migraciones SQL se copiarán a `supabase/migrations/` en el proyecto.
- Tendrás que ejecutarlas en tu Supabase propio (SQL Editor de Supabase o Supabase CLI). Incluyen:
  - Tablas: `profiles`, `subjects`, `flashcards`, `study_sessions`, `card_review_history`.
  - RLS estricta por usuario (`auth.uid() = user_id`) y GRANTs.
  - Trigger `handle_new_user()` que crea perfil y 6 materias por defecto al registrarse.
  - Columnas `avatar_url` y `explanation`.
- Si prefieres, puedo intentar aplicarlas directamente si me proporcionas la connection string de Postgres de tu Supabase.

### 5. Ajustes y verificación
- Actualizar `src/integrations/supabase/types.ts` si tu esquema difiere del de origen.
- Verificar que no haya referencias a URLs/IDs del proyecto de origen.
- Ejecutar build de desarrollo (`vite build --mode development`) para detectar errores de tipo o imports.
- Revisar que el tema, navegación y flujo de auth funcionen en preview.

## Entregables
- Proyecto con toda la funcionalidad de StudCards importada.
- Variables de entorno configuradas para tu Supabase propio.
- Migraciones SQL listas para aplicar en tu base de datos.
- Build verificado sin errores de compilación.

## Notas importantes
- **No se usará Lovable Cloud** para el backend; todo Supabase será tu instancia propia.
- La generación de cartas con IA requiere que el secret `studcards` esté configurado con una API key válida de OpenAI.
- Las imágenes de las cartas se almacenan como data URLs en la columna `image_url` de `flashcards`, no en Supabase Storage (el proyecto de origen usa este enfoque).
- Si tu Supabase propio no tiene habilitado el email/password o necesitas ajustar la plantilla de correos, eso se hará desde el dashboard de Supabase.