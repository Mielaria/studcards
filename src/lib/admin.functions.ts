import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

function emailOf(claims: Record<string, unknown>): string {
  const direct = claims["email"];
  if (typeof direct === "string") return direct;
  const meta = claims["user_metadata"] as { email?: string } | undefined;
  return typeof meta?.email === "string" ? meta.email : "";
}

function assertAdmin(claims: Record<string, unknown>) {
  const admin = (process.env["admin_email"] ?? "").trim().toLowerCase();
  if (!admin) throw new Error("Falta el secret admin_email");
  if (emailOf(claims).trim().toLowerCase() !== admin) {
    throw new Error("Forbidden");
  }
}

type RpcFn = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** ¿La sesión actual es la del administrador (secret admin_email)? */
export const checkIsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = (process.env["admin_email"] ?? "").trim().toLowerCase();
    const email = emailOf(context.claims as Record<string, unknown>);
    return { isAdmin: !!admin && email.trim().toLowerCase() === admin };
  });

/** Panel: todos los usuarios con uso de IA, racha y progreso de cartas. */
export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.claims as Record<string, unknown>);
    const rpc = (context.supabase as unknown as { rpc: RpcFn }).rpc.bind(
      context.supabase,
    );
    const { data, error } = await rpc("admin_user_overview");
    if (error) {
      throw new Error(
        `No se pudo leer el panel (${error.message}). ¿Ejecutaste supabase/sql/0002_admin_panel.sql?`,
      );
    }
    return { users: (data ?? []) as AdminUserRow[] };
  });

/** Panel: activar/desactivar IA o fijar un límite diario para un usuario. */
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
    const rpc = (context.supabase as unknown as { rpc: RpcFn }).rpc.bind(
      context.supabase,
    );
    const { error } = await rpc("admin_set_ai_limit", {
      _user_id: data.userId,
      _ai_enabled: data.aiEnabled,
      _daily_limit: data.dailyLimit,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
