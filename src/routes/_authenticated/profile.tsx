import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";
import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import {
  LogOut,
  User as UserIcon,
  Download,
  Upload,
  FileText,
  Pencil,
  Check,
  X,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { exportPdf } from "@/lib/backup";
import { useImageUrl } from "@/components/CardImage";
import { AVATAR_BUCKET, removeImages, uploadImageBlob } from "@/lib/card-images";
import {
  ExportJsonDialog,
  ImportJsonDialog,
} from "@/components/DataTransferDialogs";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Perfil — StudCards" }] }),
  component: ProfilePage,
});

function fileToAvatarBlob(file: File, size = 256): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagen inválida"));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas no disponible"));
        const min = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - min) / 2,
          (img.height - min) / 2,
          min,
          min,
          0,
          0,
          size,
          size,
        );
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))),
          "image/jpeg",
          0.85,
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function ProfilePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"pdf" | null>(null);
  const [dialog, setDialog] = useState<"export" | "import" | null>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["profile-full"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: p } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .maybeSingle();
      return { user, profile: p };
    },
  });

  const [username, setUsername] = useState<string>("");
  const displayUsername = data?.profile?.username || "";
  const avatarValue = (data?.profile as { avatar_url?: string } | null)
    ?.avatar_url;
  const avatarUrl = useImageUrl(AVATAR_BUCKET, avatarValue);

  async function saveUsername() {
    const name = username.trim();
    if (!name || name === data?.profile?.username) {
      setEditing(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ username: name })
      .eq("user_id", data?.user?.id ?? "");
    if (error) return toast.error(error.message);
    toast.success("Nombre actualizado");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["profile-full"] });
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  async function onPickAvatar(file?: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await fileToAvatarBlob(file);
      const path = await uploadImageBlob(AVATAR_BUCKET, blob);
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: path })
        .eq("user_id", data?.user?.id ?? "");
      if (error) throw new Error(error.message);
      await removeImages(AVATAR_BUCKET, [avatarValue]);
      toast.success("Foto de perfil actualizada");
      qc.invalidateQueries({ queryKey: ["profile-full"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function doExportPdf() {
    setBusy("pdf");
    try {
      await exportPdf();
      toast.success("PDF descargado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }


  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label="Cambiar foto de perfil"
          className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-primary-soft text-primary"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Foto de perfil"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <UserIcon className="h-6 w-6" />
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-foreground/50 text-background opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="h-5 w-5" />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPickAvatar(e.target.files?.[0])}
        />
        <div className="min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                defaultValue={displayUsername}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveUsername();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none ring-primary/40 focus:ring-2"
              />
              <button
                onClick={saveUsername}
                aria-label="Guardar nombre"
                className="rounded-full bg-primary p-2 text-primary-foreground"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => setEditing(false)}
                aria-label="Cancelar"
                className="rounded-full border border-border p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-2xl font-semibold">
                {displayUsername || "Mi perfil"}
              </h1>
              <button
                onClick={() => {
                  setUsername(displayUsername);
                  setEditing(true);
                }}
                aria-label="Editar nombre"
                className="rounded-full border border-border p-2 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
          )}
          <p className="truncate text-sm text-muted-foreground">
            {data?.user?.email}
          </p>
        </div>
      </header>


      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-base font-semibold">Datos</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Exporta un respaldo o importa cartas. Al importar, todas las cartas
          quedan en Etapa 1 sin progreso.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            onClick={() => setDialog("export")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-medium"
          >
            <Download className="h-4 w-4" /> Exportar JSON
          </button>
          <button
            onClick={doExportPdf}
            disabled={busy === "pdf"}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-medium disabled:opacity-60"
          >
            <FileText className="h-4 w-4" /> {busy === "pdf" ? "…" : "Exportar PDF"}
          </button>
          <button
            onClick={() => setDialog("import")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-2.5 text-sm font-medium"
          >
            <Upload className="h-4 w-4" /> Importar JSON
          </button>
        </div>
      </section>

      {dialog === "export" && <ExportJsonDialog onClose={() => setDialog(null)} />}
      {dialog === "import" && <ImportJsonDialog onClose={() => setDialog(null)} />}

      {isAdmin?.isAdmin && (
        <button
          onClick={() => navigate({ to: "/admin" })}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-medium"
        >
          <ShieldCheck className="h-4 w-4" /> Panel de estadísticas
        </button>
      )}


      <button
        onClick={signOut}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 py-3 text-sm font-medium text-destructive"
      >
        <LogOut className="h-4 w-4" /> Cerrar sesión
      </button>
    </AppShell>
  );
}
