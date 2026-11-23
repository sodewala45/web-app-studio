import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Coins, FlaskConical, LogOut, Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: account } = useQuery({
    queryKey: ["ideatest-account"],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("Your sign-in session has ended.");
      const [{ data: profile }, { data: isAdmin }] = await Promise.all([
        supabase.from("profiles").select("credits").eq("user_id", auth.user.id).maybeSingle(),
        supabase.rpc("has_role", { _user_id: auth.user.id, _role: "admin" }),
      ]);
      return {
        email: auth.user.email ?? "Signed in",
        credits: profile?.credits ?? 0,
        isAdmin: isAdmin === true,
      };
    },
    staleTime: 30_000,
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/dashboard" className="inline-flex items-center gap-2 font-semibold text-foreground">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <FlaskConical className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-xl">IdeaTest</span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1" aria-label="Account navigation">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">My ideas</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/new-idea"><Plus aria-hidden="true" />New idea</Link>
            </Button>
            {account?.isAdmin ? (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin">Admin</Link>
              </Button>
            ) : null}
            <span className="mx-1 hidden h-7 border-l border-border sm:block" aria-hidden="true" />
            <span className="inline-flex items-center gap-1.5 px-2 text-sm text-muted-foreground" aria-label={`${account?.credits ?? 0} credits`}>
              <Coins className="size-4 text-primary" aria-hidden="true" />
              <span>{account?.credits ?? "—"} credits</span>
            </span>
            <Button variant="ghost" size="icon" aria-label={`Sign out ${account?.email ?? ""}`} title="Sign out" onClick={signOut}>
              <LogOut aria-hidden="true" />
            </Button>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-border bg-background px-4 py-5 text-center text-xs text-muted-foreground sm:px-6">
        <p>Buyer personas are AI simulations, not real customer research.</p>
        <p className="mt-1">Method inspired by the MIT-licensed founder-skill by Jake Schincariol.</p>
        {account?.email ? <p className="mt-2 inline-flex items-center gap-1"><span>{account.email}</span><ArrowUpRight className="size-3" aria-hidden="true" /></p> : null}
      </footer>
    </div>
  );
}