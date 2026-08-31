import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  BookOpen,
  Plus,
  Zap,
  Sparkles,
  BarChart3,
  User,
} from "lucide-react";

// 4 accesos a cada lado del botón central "Crear" no caben en móvil:
// se usan 3 + botón central + 3 con etiquetas compactas.
const left = [
  { to: "/dashboard", label: "Inicio", icon: Home },
  { to: "/subjects", label: "Materias", icon: BookOpen },
  { to: "/practice", label: "Repasar", icon: Zap },
] as const;

const right = [
  { to: "/learned", label: "Aprend.", icon: Sparkles },
  { to: "/stats", label: "Stats", icon: BarChart3 },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (to: string) =>
    pathname === to || pathname.startsWith(to + "/");

  return (
    <nav
      className="app-chrome fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-2xl grid-cols-7 items-end">
        {left.map((it) => (
          <NavItem key={it.to} {...it} active={isActive(it.to)} />
        ))}
        <li className="flex justify-center">
          <Link
            to="/create"
            className="-mt-6 flex h-13 w-13 items-center justify-center rounded-full bg-primary p-3.5 text-primary-foreground shadow-elevated transition-transform active:scale-95"
            aria-label="Crear"
          >
            <Plus className="h-6 w-6" />
          </Link>
        </li>
        {right.map((it) => (
          <NavItem key={it.to} {...it} active={isActive(it.to)} />
        ))}
      </ul>
    </nav>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  active,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  active: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] leading-none transition-colors ${
          active ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" />
        <span className="max-w-full truncate px-0.5">{label}</span>
      </Link>
    </li>
  );
}
