import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { FlaskConical, Loader2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — IdeaTest" },
      {
        name: "description",
        content: "Sign in or create an IdeaTest account. Your first Quick run is free.",
      },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters for your password."),
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) void navigate({ to: "/dashboard", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          await navigate({ to: "/dashboard", replace: true });
        } else {
          setNotice("Check your inbox for a confirmation link, then come back and sign in.");
          setMode("signin");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (signInError) throw signInError;
        await navigate({ to: "/dashboard", replace: true });
      }
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === "signup";

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[1fr_1fr]">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <Link to="/" className="inline-flex items-center gap-2 font-semibold">
          <FlaskConical className="size-6" aria-hidden="true" />
          <span className="font-display text-2xl">IdeaTest</span>
        </Link>
        <div>
          <p className="font-display text-4xl font-semibold leading-tight">
            Find the weak spots while they are still cheap to fix.
          </p>
          <p className="mt-4 max-w-md leading-7 opacity-90">
            Your first Quick run is free. Buyers in the report are AI simulations, so use the
            results to decide what to test with real people.
          </p>
        </div>
        <p className="text-xs opacity-80">
          Method inspired by the MIT-licensed founder-skill by Jake Schincariol.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 font-semibold lg:hidden">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <FlaskConical className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-xl">IdeaTest</span>
          </Link>
          <h1 className="font-display text-3xl font-semibold">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isSignup
              ? "Sign up to run your first idea free."
              : "Sign in to see your ideas and reports."}
          </p>

          <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                className="mt-1.5"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                className="mt-1.5"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              {isSignup ? (
                <p className="mt-1.5 text-xs text-muted-foreground">At least 8 characters.</p>
              ) : null}
            </div>

            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {notice ? (
              <Alert role="status">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "New to IdeaTest?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => {
                setMode(isSignup ? "signin" : "signup");
                setError(null);
                setNotice(null);
              }}
            >
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
