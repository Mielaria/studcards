import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Upload, X } from "lucide-react";
import {
  listSubjects,
  exportSubjectBackup,
  downloadJson,
  importBackup,
  slugify,
  type BackupFile,
} from "@/lib/backup";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Cerrar">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[hsl(var(--primary))]"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function ExportJsonDialog({ onClose }: { onClose: () => void }) {
  const { data: subjects } = useQuery({
    queryKey: ["backup-subjects"],
    queryFn: listSubjects,
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<"single" | "separate">("single");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (subjects) setSelected(subjects.map((s) => s.id));
  }, [subjects]);

  const all = subjects?.length ? selected.length === subjects.length : false;

  async function run() {
    if (selected.length === 0) return toast.error("Selecciona al menos una materia");
    setBusy(true);
    try {
      const date = new Date().toISOString().slice(0, 10);
      const files = await Promise.all(selected.map((id) => exportSubjectBackup(id)));
      if (mode === "separate") {
        files.forEach((f) =>
          downloadJson(f, `studcards-${slugify(f.subjects[0].name)}-${date}.json`),
        );
      } else {
        const merged: BackupFile = {
          app: "studcards",
          version: 1,
          exported_at: new Date().toISOString(),
          subjects: files.flatMap((f) => f.subjects),
        };
        downloadJson(merged, `studcards-${date}.json`);
      }
      toast.success("Exportación lista");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al exportar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Exportar JSON" onClose={onClose}>
      <p className="mb-3 text-xs text-muted-foreground">
        Elige qué materias quieres descargar.
      </p>
      <button
        onClick={() =>
          setSelected(all ? [] : (subjects ?? []).map((s) => s.id))
        }
        className="mb-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium"
      >
        {all ? "Quitar todas" : "Seleccionar todas"}
      </button>
      <div className="grid gap-2">
        {(subjects ?? []).map((s) => (
          <CheckRow
            key={s.id}
            checked={selected.includes(s.id)}
            onChange={(v) =>
              setSelected((prev) =>
                v ? [...prev, s.id] : prev.filter((x) => x !== s.id),
              )
            }
            label={s.name}
            hint={`${s.count} cartas`}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <button
          onClick={() => setMode("single")}
          className={`rounded-xl border px-3 py-2 ${mode === "single" ? "border-primary bg-primary-soft text-primary" : "border-border"}`}
        >
          Un solo archivo
        </button>
        <button
          onClick={() => setMode("separate")}
          className={`rounded-xl border px-3 py-2 ${mode === "separate" ? "border-primary bg-primary-soft text-primary" : "border-border"}`}
        >
          Un archivo por materia
        </button>
      </div>

      <button
        onClick={run}
        disabled={busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        <Download className="h-4 w-4" />
        {busy ? "Generando…" : `Descargar (${selected.length})`}
      </button>
    </Modal>
  );
}

export function ImportJsonDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [file, setFile] = useState<BackupFile | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  async function pick(f: File) {
    try {
      const parsed = JSON.parse(await f.text()) as BackupFile;
      if (parsed.app !== "studcards" || !Array.isArray(parsed.subjects))
        throw new Error("Archivo no compatible");
      setFile(parsed);
      setSelected(parsed.subjects.map((_, i) => i));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archivo inválido");
    }
  }

  const all = file ? selected.length === file.subjects.length : false;

  async function run() {
    if (!file) return;
    if (selected.length === 0) return toast.error("Selecciona al menos una materia");
    setBusy(true);
    try {
      const res = await importBackup({
        ...file,
        subjects: file.subjects.filter((_, i) => selected.includes(i)),
      });
      toast.success(
        `Importado: ${res.subjectsCreated} materia(s) nuevas, ${res.cardsCreated} carta(s)`,
      );
      qc.invalidateQueries();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Importar JSON" onClose={onClose}>
      {!file ? (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Elige un archivo de respaldo; después podrás escoger qué materias
            subir.
          </p>
          <input
            type="file"
            accept="application/json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
              e.target.value = "";
            }}
            className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          />
        </>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Selecciona las materias a importar. Las cartas quedan en Etapa 1 sin
            progreso.
          </p>
          <button
            onClick={() =>
              setSelected(all ? [] : file.subjects.map((_, i) => i))
            }
            className="mb-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium"
          >
            {all ? "Quitar todas" : "Seleccionar todas"}
          </button>
          <div className="grid gap-2">
            {file.subjects.map((s, i) => (
              <CheckRow
                key={`${s.name}-${i}`}
                checked={selected.includes(i)}
                onChange={(v) =>
                  setSelected((prev) =>
                    v ? [...prev, i] : prev.filter((x) => x !== i),
                  )
                }
                label={s.name}
                hint={`${s.cards?.length ?? 0} cartas`}
              />
            ))}
          </div>
          <button
            onClick={run}
            disabled={busy}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {busy ? "Importando…" : `Importar (${selected.length})`}
          </button>
        </>
      )}
    </Modal>
  );
}
