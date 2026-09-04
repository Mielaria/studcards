import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { ShieldCheck, Loader2 } from "lucide-react";
import {
  checkIsAdmin,
  getAdminOverview,
  setAiLimit,
  type AdminUserRow,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Panel de estadísticas — StudCards" }] }),
  component: AdminPage,
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAdminFn = useServerFn(checkIsAdmin);
  const overviewFn = useServerFn(getAdminOverview);
  const setLimitFn = useServerFn(setAiLimit);

  const { data: adminCheck, isLoading: checking } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => isAdminFn({ data: undefined }),
  });

  useEffect(() => {
    if (adminCheck && !adminCheck.isAdmin) navigate({ to: "/profile", replace: true });
  }, [adminCheck, navigate]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    enabled: !!adminCheck?.isAdmin,
    queryFn: () => overviewFn({ data: undefined }),
  });

  async function save(u: AdminUserRow, aiEnabled: boolean, dailyLimit: number | null) {
    try {
      await setLimitFn({ data: { userId: u.user_id, aiEnabled, dailyLimit } });
      toast.success("Límites actualizados");
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  if (checking || !adminCheck?.isAdmin) {
    return (
      <AppShell>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Verificando acceso…
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="mb-6 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-semibold">Panel de estadísticas</h1>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Cargando usuarios…</p>}
      {error && (
        <p className="rounded-xl border border-destructive/30 p-3 text-sm text-destructive">
          {error instanceof Error ? error.message : "Error"}
        </p>
      )}

      <div className="space-y-3">
        {(data?.users ?? []).map((u) => (
          <UserRow key={u.user_id} user={u} onSave={save} />
        ))}
      </div>
    </AppShell>
  );
}

function UserRow({
  user,
  onSave,
}: {
  user: AdminUserRow;
  onSave: (u: AdminUserRow, aiEnabled: boolean, dailyLimit: number | null) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(user.ai_enabled);
  const [limit, setLimit] = useState(
    user.daily_limit === null ? "" : String(user.daily_limit),
  );
  const [saving, setSaving] = useState(false);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{user.username || "Sin nombre"}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <p className="text-xs text-muted-foreground">🔥 {user.streak_days} días</p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="En aprendizaje" value={user.learning_count} />
        <Stat label="Aprendidas" value={user.learned_count} />
        <Stat label="IA hoy" value={user.ai_cards_today} />
        <Stat label="IA total" value={user.ai_cards_total} />
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4"
          />
          IA activada
        </label>
        <label className="flex items-center gap-2 text-sm">
          Límite diario
          <input
            type="number"
            min={0}
            value={limit}
            placeholder="sin límite"
            onChange={(e) => setLimit(e.target.value)}
            className="w-28 rounded-xl border border-input bg-background px-3 py-1.5 text-sm outline-none ring-primary/40 focus:ring-2"
          />
        </label>
        <button
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            const parsed = limit.trim() === "" ? null : Number(limit);
            await onSave(user, enabled, Number.isFinite(parsed as number) ? parsed : null);
            setSaving(false);
          }}
          className="rounded-xl bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? "…" : "Guardar"}
        </button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
