import { createFileRoute, Outlet } from "@tanstack/react-router";

// Layout for /subjects/$id/* — the index and study routes render inside <Outlet />.
export const Route = createFileRoute("/_authenticated/subjects/$id")({
  component: () => <Outlet />,
});
