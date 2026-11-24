import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { addCreditsFn } from "@/lib/ideatest/accounts.functions";
import { messageOf } from "@/lib/ideatest/errors";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin — IdeaTest" }] }),
  component: AdminPage,
});

function AdminPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("5");
  const [formError, setFormError] = useState<string | null>(null);

  const admin = useQuery({
    queryKey: ["ideatest-is-admin"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: auth.user.id, _role: "admin" });
      return data === true;
    },
  });

  const addCredits = useMutation({
    mutationFn: (input: { email: string; amount: number }) => addCreditsFn({ data: input }),
    onSuccess: async (result) => {
      toast.success(`${result.email} now has ${result.credits} credits.`);
      setEmail("");
      await queryClient.invalidateQueries({ queryKey: ["ideatest-account"] });
    },
    onError: (caught) => setFormError(messageOf(caught, "Credits could not be added.")),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const credits = Number(amount);
    if (!email.trim()) {
      setFormError("Enter the email address of the account.");
      return;
    }
    if (!Number.isInteger(credits) || credits < 1) {
      setFormError("Enter a whole number of credits, 1 or more.");
      return;
    }
    addCredits.mutate({ email: email.trim(), amount: credits });
  }

  if (admin.isLoading) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground" role="status">
        Checking access…
      </p>
    );
  }

  if (!admin.data) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <Alert role="alert">
          <AlertDescription>This page is only for IdeaTest admins.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Add credits</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Payments are not switched on yet, so credits are added by hand. The person must already have
        an account.
      </p>
      <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
        <div>
          <Label htmlFor="admin-email">Account email</Label>
          <Input
            id="admin-email"
            type="email"
            className="mt-1.5"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="admin-amount">Credits to add</Label>
          <Input
            id="admin-amount"
            type="number"
            min={1}
            step={1}
            className="mt-1.5 sm:max-w-32"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        {formError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={addCredits.isPending}>
          {addCredits.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Add credits
        </Button>
      </form>
    </div>
  );
}
