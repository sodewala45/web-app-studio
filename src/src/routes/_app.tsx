import { Outlet, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/ideatest/app-shell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  head: () => ({ meta: [{ title: "IdeaTest" }, { name: "robots", content: "noindex" }] }),
  component: AppLayout,
});

// Sessions live in the browser, so the sign-in check runs on the client.
function AppLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) setReady(true);
      else void navigate({ to: "/auth", replace: true });
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) void navigate({ to: "/auth", replace: true });
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!ready) {
    return (
      <div
        className="grid min-h-screen place-items-center text-sm text-muted-foreground"
        role="status"
      >
        Loading your workspace…
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
