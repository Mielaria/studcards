import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  BookOpen,
  Plus,
  Sparkles,
  User,
  GraduationCap,
  Zap,
  BarChart3,
} from "lucide-react";
import { BottomNav } from "./BottomNav";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { to: "/dashboard", label: "Inicio", icon: Home },
  { to: "/subjects", label: "Materias", icon: BookOpen },
  { to: "/create", label: "Crear", icon: Plus },
  { to: "/practice", label: "Repasar", icon: Zap },
  { to: "/learned", label: "Aprendidas", icon: Sparkles },
  { to: "/stats", label: "Estadísticas", icon: BarChart3 },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="app-chrome fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-card px-4 py-6 md:flex md:flex-col">
        <Link to="/dashboard" className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-semibold">StudCards</span>
        </Link>
        <ul className="flex flex-col gap-1">
          {navItems.map((it) => {
            const active =
              pathname === it.to || pathname.startsWith(it.to + "/");
            const Icon = it.icon;
            return (
              <li key={it.to}>
                <Link
                  to={it.to}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </aside>
      <main className="app-main pb-28 md:ml-60 md:pb-8">
        <div className="app-container mx-auto max-w-3xl px-4 py-6 md:px-8 md:py-10">
          <div className="app-chrome mb-2 flex justify-end">
            <ThemeToggle />
          </div>
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
