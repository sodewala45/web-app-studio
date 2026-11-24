import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addCreditsInput = z.object({
  email: z.string().trim().email(),
  amount: z.number().int().positive(),
});

export const addCreditsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addCreditsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Only an IdeaTest admin can add credits.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const requestedEmail = data.email.toLowerCase();
    for (let page = 1; page <= 20; page += 1) {
      const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1_000 });
      if (error) throw new Error("The account list could not be checked.");
      const user = users.users.find((candidate) => candidate.email?.toLowerCase() === requestedEmail);
      if (user) {
        const { data: credits, error: adjustError } = await context.supabase.rpc("admin_adjust_credits", {
          _target_user_id: user.id,
          _amount: data.amount,
        });
        if (adjustError || credits === null) throw new Error(adjustError?.message || "Credits could not be added.");
        return { email: user.email ?? data.email, credits };
      }
      if (users.users.length < 1_000) break;
    }
    throw new Error("No IdeaTest account was found for that email address.");
  });