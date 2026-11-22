import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BUSINESS_MODELS, type RunMode } from "./domain";

const classificationInput = z.object({
  idea: z.string().trim().min(20).max(4_000),
  country: z.string().trim().min(2).max(100),
  currency: z.string().trim().min(3).max(3),
});

const startRunInput = z.object({
  ideaId: z.string().uuid(),
  mode: z.enum(["quick", "full"]),
});

const advanceRunInput = z.object({ runId: z.string().uuid() });

export const classifyIdeaFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => classificationInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI analysis is not configured. Please try again later.");
    const { classifyIdea } = await import("./pipeline.server");
    return classifyIdea(data, apiKey);
  });

export const startIdeaRunFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => startRunInput.parse(input))
  .handler(async ({ data, context }) => {
    const { startRun } = await import("./pipeline.server");
    return startRun(context.supabase, data.ideaId, data.mode as RunMode);
  });

export const advanceIdeaRunFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => advanceRunInput.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI analysis is not configured. Please try again later.");
    const { advanceRun } = await import("./pipeline.server");
    return advanceRun(context.supabase, data.runId, apiKey);
  });

export const isSupportedBusinessModel = (value: string): value is (typeof BUSINESS_MODELS)[number] =>
  (BUSINESS_MODELS as readonly string[]).includes(value);