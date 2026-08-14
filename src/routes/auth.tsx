import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { toast } from "sonner";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Entrar o registrarte — StudCards" },
      {
        name: "description",
        content: "Accede a tu cuenta de StudCards para crear y estudiar tus tarjetas.",
      },
      { property: "og:title", content: "Entrar — StudCards" },
      { property: "og:description", content: "Crea tu cuenta o inicia sesión en StudCards." },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<Mode>(initialMode ?? "signin");
  const session = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate({ to: "/dashboard", replace: true });
  }, [session, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-semibold">StudCards</span>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6 shadow-card md:p-8">
          {mode !== "forgot" && (
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm font-medium">
              <button
                onClick={() => setMode("signin")}
                className={`rounded-full px-3 py-2 transition-colors ${
                  mode === "signin"
                    ? "bg-background text-foreground shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                Entrar
              </button>
              <button
                onClick={() => setMode("signup")}
                className={`rounded-full px-3 py-2 transition-colors ${
                  mode === "signup"
                    ? "bg-background text-foreground shadow-card"
                    : "text-muted-foreground"
                }`}
              >
                Crear cuenta
              </button>
            </div>
          )}
          {mode === "signin" && <SignInForm onForgot={() => setMode("forgot")} />}
          {mode === "signup" && <SignUpForm />}
          {mode === "forgot" && <ForgotForm onBack={() => setMode("signin")} />}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium">{label}</span>
      <input
        {...props}
        className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none ring-primary/40 transition-shadow focus:ring-2"
      />
    </label>
  );
}

function SubmitButton({
  children,
  loading,
}: {
  children: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-elevated transition-opacity hover:opacity-95 disabled:opacity-60"
    >
      {loading ? "Cargando…" : children}
    </button>
  );
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("¡Bienvenido de nuevo!");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Correo"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <Field
        label="Contraseña"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
      />
      <SubmitButton loading={loading}>Entrar</SubmitButton>
      <button
        type="button"
        onClick={onForgot}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        ¿Olvidaste tu contraseña?
      </button>
    </form>
  );
}

function SignUpForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    if (username.trim().length < 2) {
      toast.error("El nombre de usuario es muy corto.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { username: username.trim() },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    if (!data.session) {
      toast.success("Cuenta creada. Revisa tu correo para confirmarla.");
    } else {
      toast.success("¡Bienvenido a StudCards!");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field
        label="Nombre de usuario"
        required
        minLength={2}
        maxLength={40}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
      />
      <Field
        label="Correo"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
      />
      <Field
        label="Contraseña"
        type="password"
        required
        minLength={6}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="new-password"
      />
      <Field
        label="Confirmar contraseña"
        type="password"
        required
        minLength={6}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="new-password"
      />
      <SubmitButton loading={loading}>Crear cuenta</SubmitButton>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Revisa tu correo para restablecer la contraseña.");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-lg font-semibold">Recuperar contraseña</h2>
      <p className="text-sm text-muted-foreground">
        Te enviaremos un enlace a tu correo para crear una nueva contraseña.
      </p>
      <Field
        label="Correo"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <SubmitButton loading={loading}>Enviar enlace</SubmitButton>
      <button
        type="button"
        onClick={onBack}
        className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        ← Volver
      </button>
    </form>
  );
}
