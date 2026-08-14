# Plan: Importar StudCards al proyecto vacío

## Resumen
Migrar la aplicación completa **StudCards** desde el proyecto de origen **"Studia Smart supabase"** al proyecto actual, conservando código, diseño, componentes y lógica. El backend apuntará a tu **Supabase propio** (sin Lovable Cloud) y se configurará la generación de cartas con IA mediante tu API key de OpenAI.

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
- No copiar el `.env` ni ninguna credencial del proyecto de origen.
- Configurar en el nuevo proyecto las variables de tu Supabase propio:
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`
  - `studcards` (API key de OpenAI para generación de cartas)
- Los valores reales los introduces tú en el formulario seguro; no se piden claves de service role ni connection string de Postgres.

### 4. Tu Supabase: solo lectura de configuración, sin cambios
- **No se ejecutará ninguna migración SQL** sobre tu Supabase; tu esquema ya está creado con `0001_studcards_init.sql`.
- **No se sobrescribirá** ningún objeto existente (tablas, RLS, triggers, buckets).
- Los archivos `supabase/migrations/*.sql` se copian al repositorio solo como referencia histórica del esquema; no se aplican.
- Se asume que ya existen los buckets privados `card-images` y `avatars` con sus políticas.

### 5. Imágenes en Supabase Storage (confirmado)
- `flashcards.image_url` almacenará **únicamente la ruta del archivo en Storage** (`<USER_ID>/<UUID>.jpg` dentro del bucket `card-images`). **Nunca Base64/data URL.**
- Avatares: se suben a `avatars/<USER_ID>/<UUID>.jpg` y `profiles.avatar_url` guarda la ruta.
- El recorte de imágenes existente (`react-image-crop` + `image-crop.ts`) se conserva; el blob resultante se sube a Storage y solo se persiste la ruta.
- La visualización usa **URLs firmadas** (`createSignedUrl`, con caché en memoria y expiración), respetando las políticas RLS de Storage.
- Compatibilidad de lectura: si un registro antiguo contiene un `data:` o una URL `http`, se muestra tal cual sin romper la carta.
- Al eliminar cartas o reemplazar imágenes, se borran los archivos huérfanos del bucket.

### 6. Backup JSON
- **Importación**: acepta respaldos antiguos con imágenes en Base64; al importar, cada imagen se sube a `card-images/<USER_ID>/<UUID>.jpg` y en la BD se guarda solo la ruta.
- **Exportación**: descarga los archivos de Storage y los incrusta como Base64 en el JSON para que el backup sea autocontenido.

### 7. Verificación
- Confirmar que `src/integrations/supabase/types.ts` coincide con tu esquema actual (ajustar solo el archivo de tipos, nunca la BD).
- Verificar que no queden referencias a URLs/IDs del proyecto de origen.
- Ejecutar el build de desarrollo para detectar errores de tipos o imports.
- Probar en preview: registro/login, creación de carta con imagen, visualización con URL firmada, estudio con SRS y export/import JSON.

## Entregables
- Proyecto con toda la funcionalidad de StudCards importada y apuntando a tu Supabase.
- Manejo de imágenes 100% vía Storage con URLs firmadas.
- Build verificado sin errores de compilación.

## Notas importantes
- **No se usará Lovable Cloud**; el backend es tu instancia propia de Supabase.
- **No se tocará tu base de datos**: sin migraciones, sin SQL, sin acceso directo.
- La generación de cartas con IA requiere el secret `studcards` con una API key válida de OpenAI.
- Ajustes de plantillas de correo o proveedores de auth se hacen desde tu dashboard de Supabase.