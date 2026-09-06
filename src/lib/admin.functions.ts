import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Fila del panel: un usuario con su uso de IA, racha y progreso. */
export interface AdminUserRow {
  user_id: string;
  email: string;
  username: string | null;
  streak_days: number;
  learning_count: number;
  learned_count: number;
  ai_cards_today: number;
  ai_cards_total: number;
  ai_enabled: boolean;
  daily_limit: number | null;
}

type RpcFn = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

function rpcOf(supabase: unknown): RpcFn {
  const client = supabase as { rpc: RpcFn };
  return client.rpc.bind(client);
}

function emailOf(claims: Record<string, unknown>): string {
  const direct = claims["email"];
  if (typeof direct === "string") return direct;
  const meta = claims["user_metadata"] as { email?: string } | undefined;
  return typeof meta?.email === "string" ? meta.email : "";
}

/** Compara el correo de la sesión con el secreto admin_email. */
function isAdminEmail(claims: Record<string, unknown>): boolean {
  const admin = (process.env["admin_email"] ?? "").trim().toLowerCase();
  if (!admin) return false;
  return emailOf(claims).trim().toLowerCase() === admin;
}

function assertAdmin(claims: Record<string, unknown>) {
  if (!isAdminEmail(claims)) throw new Error("Forbidden");
}

/** ¿La sesión actual es la del administrador? */
export const checkIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({
    isAdmin: isAdminEmail(context.claims as Record<string, unknown>),
  }));

/** Todos los usuarios con uso de IA, racha y progreso de cartas. */
export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { data, error } = await rpcOf(context.supabase)("admin_user_overview");
    if (error) {
      throw new Error(
        `No se pudo leer el panel (${error.message}). Verifica que ejecutaste supabase/sql/0002_admin_panel.sql y que tu correo está en app_admins.`,
      );
    }
    return { users: (data ?? []) as AdminUserRow[] };
  });

/** Activar/desactivar IA o fijar un límite diario para un usuario. */
export const setAiLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        aiEnabled: z.boolean(),
        dailyLimit: z.number().int().min(0).max(100000).nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const { error } = await rpcOf(context.supabase)("admin_set_ai_limit", {
      _user_id: data.userId,
      _ai_enabled: data.aiEnabled,
      _daily_limit: data.dailyLimit,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
