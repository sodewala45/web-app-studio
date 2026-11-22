import { Output, streamText } from "ai";
import { z } from "zod";

import {
  BUSINESS_MODELS,
  calculateBuyRate,
  calculateEconomics,
  calculateVanWestendorp,
  calculateVerdict,
  MAX_BUYERS,
  RUN_MODES,
  validateFinanceInputs,
  type BusinessModel,
  type BuyerPriceAnswers,
  type NumericInputs,
  type RunMode,
} from "./domain";
import { AI_GATEWAY_BASE_URL, BOARD_MODEL, PANEL_MODEL } from "./models";
import { createLovableAiGatewayProvider } from "./gateway.server";
import type { Database, Json } from "@/integrations/supabase/types";

type IdeaRow = Database["public"]["Tables"]["ideas"]["Row"];
type RunRow = Database["public"]["Tables"]["runs"]["Row"];
type SupabaseClient = import("@supabase/supabase-js").SupabaseClient<Database>;

const classificationSchema = z.object({
  business_model: z.enum(BUSINESS_MODELS),
  confidence: z.number(),
  summary: z.string(),
  followup_questions: z.array(z.string()),
});

const boardSchema = z.object({
  score: z.number(),
  risks: z.array(z.string()),
  kill_condition: z.string(),
  vote: z.enum(["fund", "fund_if", "pass"]),
  rationale: z.string(),
});

const personaSchema = z.object({
  income_band: z.string(),
  location: z.string(),
  habits: z.string(),
  current_alternative: z.string(),
  risk_attitude: z.string(),
  buyer_role: z.string(),
  main_objection: z.string(),
});

const personaBatchSchema = z.object({ personas: z.array(personaSchema) });

const panelSchema = z.object({
  would_buy: z.enum(["yes", "no", "maybe"]),
  reason: z.string(),
  objection: z.string(),
  price_too_cheap: z.number(),
  price_cheap: z.number(),
  price_expensive: z.number(),
  price_too_expensive: z.number(),
});

const reportSchema = z.object({
  summary: z.string(),
  next_tests: z.array(z.string()),
});

function statusOf(error: unknown): number | undefined {
  if (error === null || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  if (typeof record.statusCode === "number") return record.statusCode;
  if (typeof record.status === "number") return record.status;
  const response = record.response;
  if (response !== null && typeof response === "object" && typeof (response as Record<string, unknown>).status === "number") {
    return (response as Record<string, number>).status;
  }
  return undefined;
}

function retryAfterMilliseconds(error: unknown): number | undefined {
  if (error === null || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  const headers = record.responseHeaders ?? record.headers;
  let value: string | null = null;
  if (headers instanceof Headers) value = headers.get("retry-after");
  else if (headers !== null && typeof headers === "object") {
    const entry = Object.entries(headers as Record<string, unknown>).find(([key]) => key.toLowerCase() === "retry-after");
    value = typeof entry?.[1] === "string" ? entry[1] : null;
  }
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function safeAiError(error: unknown): Error {
  const status = statusOf(error);
  let upstreamMessage: string | undefined;
  if (error !== null && typeof error === "object") {
    const body = (error as Record<string, unknown>).responseBody;
    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body) as { message?: unknown; error?: unknown };
        if (typeof parsed.message === "string") upstreamMessage = parsed.message;
        else if (typeof parsed.error === "string") upstreamMessage = parsed.error;
        else if (parsed.error !== null && typeof parsed.error === "object" && typeof (parsed.error as Record<string, unknown>).message === "string") {
          upstreamMessage = (parsed.error as Record<string, string>).message;
        }
      } catch {
        upstreamMessage = undefined;
      }
    }
  }
  if (status === 401) return new Error("AI analysis is not configured. Please try again later.");
  if (status === 402) return new Error(upstreamMessage || "AI analysis is paused because this workspace has run out of AI credits.");
  if (status === 403) return new Error(upstreamMessage || "AI analysis is not available for this workspace right now.");
  if (status === 429) return new Error("AI analysis is busy. Please try again shortly.");
  if (status !== undefined && status >= 500) return new Error("AI analysis is temporarily unavailable. Please try again shortly.");
  if (status === 400) return new Error(upstreamMessage || "The AI service could not process this request.");
  return new Error("The analysis could not be completed. Please try again.");
}

async function runObjectPrompt<T>(args: {
  apiKey: string;
  model: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxOutputTokens: number;
}) {
  const gateway = createLovableAiGatewayProvider(args.apiKey, undefined, {
    baseURL: AI_GATEWAY_BASE_URL,
  });
  const model = gateway.chatModel(args.model);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = streamText({
        model,
        output: Output.object({ schema: args.schema }),
        prompt: args.prompt,
        maxOutputTokens: args.maxOutputTokens,
      });
      return args.schema.parse(await result.output);
    } catch (error) {
      const status = statusOf(error);
      const retryable = status === 429 || (status !== undefined && status >= 500);
      if (!retryable || attempt === 2) throw safeAiError(error);
      const retryAfter = retryAfterMilliseconds(error);
      const backoff = Math.min(300 * 2 ** attempt, 2_500) + Math.random() * 250;
      await wait(retryAfter ?? backoff);
    }
  }
  throw new Error("The analysis could not be completed.");
}

function validateClassification(result: z.infer<typeof classificationSchema>) {
  const questions = result.followup_questions.map((question) => question.trim()).filter(Boolean).slice(0, 5);
  if (questions.length < 3) throw new Error("The analysis did not return enough follow-up questions. Please try again.");
  return {
    business_model: result.business_model,
    confidence: Math.max(0, Math.min(1, result.confidence)),
    summary: result.summary.trim().slice(0, 900),
    followup_questions: questions,
  };
}

export async function classifyIdea(
  input: { idea: string; country: string; currency: string },
  apiKey: string,
) {
  const result = await runObjectPrompt({
    apiKey,
    model: BOARD_MODEL,
    schema: classificationSchema,
    maxOutputTokens: 550,
    prompt: [
      "Classify this startup idea into exactly one business model: physical_product, b2b_saas, consumer_app, service_agency, marketplace, or local_business.",
      "Return a confidence score from 0 to 1, a short neutral summary, and 3 to 5 specific follow-up questions.",
      "Questions must reveal missing facts, not invent financial assumptions. If the idea is ambiguous, choose the closest type but set confidence below 0.65 so the founder can choose.",
      "Do not provide financial, legal, or customer-validation claims.",
      `Country: ${input.country}\nCurrency: ${input.currency}\nIdea: ${input.idea}`,
    ].join("\n\n"),
  });
  return validateClassification(result);
}

function boardPrompt(idea: IdeaRow, lens: string, focus: string) {
  return [
    `Evaluate the startup idea through this lens: ${lens}. Focus: ${focus}.`,
    "Return a 1–10 score, exactly 3 concrete risks, what would kill the idea, a vote of fund, fund_if, or pass, and a concise rationale.",
    "Be skeptical, specific, and evidence-conscious. Do not name or imitate real people. Do not invent market statistics.",
    `Business model: ${idea.business_model ?? "unclassified"}\nCountry: ${idea.country}\nCurrency: ${idea.currency}\nIdea: ${idea.idea_text}\nSummary: ${idea.summary ?? "not supplied"}\nFounder answers: ${JSON.stringify(idea.followup_answers)}`,
  ].join("\n\n");
}

const boardLenses = [
  { lens: "offer_strength", label: "Offer strength", focus: "value, risk reversal, and urgency" },
  { lens: "differentiation", label: "Differentiation", focus: "a defensible niche and credible alternatives" },
  { lens: "product_craft", label: "Product craft", focus: "simplicity, usability, and a compelling first use" },
] as const;

function validateBoard(result: z.infer<typeof boardSchema>) {
  const risks = result.risks.map((risk) => risk.trim()).filter(Boolean).slice(0, 3);
  if (risks.length !== 3) throw new Error("The board analysis did not return three risks. Please try again.");
  return {
    score: Math.max(1, Math.min(10, Math.round(result.score))),
    risks,
    kill_condition: result.kill_condition.trim().slice(0, 500),
    vote: result.vote,
    rationale: result.rationale.trim().slice(0, 800),
  };
}

async function createBoardResults(apiKey: string, idea: IdeaRow) {
  return Promise.all(boardLenses.map(async ({ lens, label, focus }) => {
    const result = await runObjectPrompt({
      apiKey,
      model: BOARD_MODEL,
      schema: boardSchema,
      maxOutputTokens: 500,
      prompt: boardPrompt(idea, label, focus),
    });
    return { lens, ...validateBoard(result) };
  }));
}

type Persona = z.infer<typeof personaSchema>;
type PanelResult = z.infer<typeof panelSchema>;

async function createPersonas(apiKey: string, idea: IdeaRow, count: number, offset: number, existing: Persona[]) {
  const model = idea.business_model as BusinessModel;
  const businessModel = model === "b2b_saas" || model === "service_agency";
  const result = await runObjectPrompt({
    apiKey,
    model: PANEL_MODEL,
    schema: personaBatchSchema,
    maxOutputTokens: Math.min(1_400, count * 250),
    prompt: [
      `Create ${count} varied buyer persona cards for a simulated research exercise. These are fictional AI simulations, not real customers.`,
      businessModel
        ? "For this B2B/service idea, buyer_role must reflect different purchasing roles such as budget owner, end user, skeptic, or procurement."
        : "Represent distinct consumer or small-business buying situations; buyer_role should be a short descriptor such as consumer or household buyer.",
      "Vary income band, location, habits, current alternative, risk attitude, and main objection. Use plausible qualitative details only; do not invent named people or market data.",
      "Return exactly the requested number of cards. Keep each field short and specific.",
      `Business model: ${idea.business_model}\nCountry: ${idea.country}\nIdea: ${idea.idea_text}\nSummary: ${idea.summary ?? "not supplied"}\nFounder answers: ${JSON.stringify(idea.followup_answers)}\nPersona indices: ${offset + 1} through ${offset + count}.`,
      existing.length > 0 ? `Avoid repeating these existing persona summaries: ${JSON.stringify(existing.slice(-10))}` : "",
    ].filter(Boolean).join("\n\n"),
  });
  if (result.personas.length !== count) throw new Error("The buyer panel could not create the requested personas. Please try again.");
  return result.personas;
}

function validatePanelResult(result: PanelResult) {
  const values = [result.price_too_cheap, result.price_cheap, result.price_expensive, result.price_too_expensive];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("The buyer returned invalid price answers.");
  if (!(values[0] < values[1] && values[1] < values[2] && values[2] < values[3])) {
    throw new Error("The buyer returned inconsistent price answers.");
  }
  return {
    ...result,
    reason: result.reason.trim().slice(0, 500),
    objection: result.objection.trim().slice(0, 300),
  };
}

async function interviewPersona(apiKey: string, idea: IdeaRow, persona: Persona) {
  const result = await runObjectPrompt({
    apiKey,
    model: PANEL_MODEL,
    schema: panelSchema,
    maxOutputTokens: 320,
    prompt: [
      "You are answering as one fictional simulated buyer, not a real customer. Evaluate this offer only from the persona's stated situation.",
      "Return would_buy as yes, no, or maybe; a short reason in first person; the main objection; and four strictly increasing price thresholds in the idea currency: too cheap, cheap, expensive, too expensive.",
      "Do not invent actual customer evidence. If the idea is unclear, say maybe and explain the uncertainty. Prices must be positive and ordered.",
      `Currency: ${idea.currency}\nCountry: ${idea.country}\nIdea: ${idea.idea_text}\nSummary: ${idea.summary ?? "not supplied"}\nBusiness model: ${idea.business_model}\nFounder answers: ${JSON.stringify(idea.followup_answers)}\nPersona: ${JSON.stringify(persona)}`,
    ].join("\n\n"),
  });
  return validatePanelResult(result);
}

async function createReportCopy(apiKey: string, idea: IdeaRow, buyRate: number, economics: ReturnType<typeof calculateEconomics>, board: Array<{ lens: string; score: number; vote: string; rationale: string }>, topObjections: string[]) {
  const result = await runObjectPrompt({
    apiKey,
    model: BOARD_MODEL,
    schema: reportSchema,
    maxOutputTokens: 750,
    prompt: [
      "Write a concise, practical startup idea report summary and exactly 3 concrete next tests to run with real people.",
      "Do not choose or restate the verdict; it is computed separately from financial and panel data. Never present simulated buyers as real customer research. Avoid legal or financial advice claims.",
      `Idea: ${idea.idea_text}\nBusiness model: ${idea.business_model}\nCountry/currency: ${idea.country}/${idea.currency}\nSimulated buy rate: ${(buyRate * 100).toFixed(1)}%\nYear-one profit estimate: ${economics.year1Profit}\nContribution margin estimate: ${economics.contributionMarginPercent.toFixed(1)}%\nBoard: ${JSON.stringify(board)}\nObjections: ${JSON.stringify(topObjections)}`,
    ].join("\n\n"),
  });
  const nextTests = result.next_tests.map((test) => test.trim()).filter(Boolean).slice(0, 3);
  if (nextTests.length !== 3) throw new Error("The report could not produce three next tests.");
  return { summary: result.summary.trim().slice(0, 1_600), nextTests };
}

function isBusinessModel(value: string | null): value is BusinessModel {
  return value !== null && BUSINESS_MODELS.includes(value as BusinessModel);
}

function numericInputs(value: Json): NumericInputs {
  if (value === null || Array.isArray(value) || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])));
}

async function getIdea(supabase: SupabaseClient, ideaId: string) {
  const { data, error } = await supabase.from("ideas").select("*").eq("id", ideaId).maybeSingle();
  if (error) throw new Error("The idea could not be loaded.");
  if (!data) throw new Error("The idea could not be found.");
  return data;
}

async function updateRun(supabase: SupabaseClient, runId: string, values: Partial<RunRow>) {
  const { error } = await supabase.from("runs").update({ ...values, updated_at: new Date().toISOString() }).eq("id", runId);
  if (error) throw new Error("Run progress could not be saved.");
}

function runState(run: RunRow) {
  return {
    runId: run.id,
    status: run.status,
    stage: run.stage,
    stageProgress: run.stage_progress,
    buyersCompleted: run.buyers_completed,
    buyerTarget: run.buyer_target,
    errorMessage: run.error_message,
  };
}

async function markRunFailed(supabase: SupabaseClient, run: RunRow, message: string) {
  await supabase.rpc("fail_run_and_refund", { _run_id: run.id, _message: message.slice(0, 500) });
}

async function insertBoardResults(apiKey: string, userSupabase: SupabaseClient, run: RunRow, idea: IdeaRow) {
  const results = await createBoardResults(apiKey, idea);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("board_results").upsert(
    results.map((result) => ({
      run_id: run.id,
      lens: result.lens,
      score: result.score,
      risks: result.risks,
      kill_condition: result.kill_condition,
      vote: result.vote,
      rationale: result.rationale,
    })),
    { onConflict: "run_id,lens" },
  );
  if (error) throw new Error("Board results could not be saved.");
  await updateRun(supabaseAdmin, run.id, { stage: "panel", stage_progress: 20 });
  return { ...run, stage: "panel", stage_progress: 20 };
}

async function generatePersonaBatch(apiKey: string, run: RunRow, idea: IdeaRow, existingRows: Array<{ persona: Json; persona_index: number }>) {
  if (!isBusinessModel(idea.business_model)) throw new Error("Choose a business model before starting a run.");
  const count = Math.min(5, run.buyer_target - existingRows.length, MAX_BUYERS - existingRows.length);
  const offset = existingRows.length;
  const existing = existingRows.map((row) => row.persona as unknown as Persona);
  const personas = await createPersonas(apiKey, idea, count, offset, existing);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("panel_answers").insert(personas.map((persona, index) => ({
    run_id: run.id,
    persona_index: offset + index,
    persona: persona as unknown as Json,
    status: "pending",
  })));
  if (error) throw new Error("The buyer panel could not be prepared.");
  return { ...run, stage: "panel", stage_progress: Math.max(20, Math.floor((offset / run.buyer_target) * 55) + 20) };
}

async function processPanelBatch(apiKey: string, userSupabase: SupabaseClient, run: RunRow, idea: IdeaRow) {
  const { data: claimed, error: claimError } = await userSupabase.rpc("claim_panel_batch", {
    _run_id: run.id,
    _batch_size: 5,
  });
  if (claimError) throw new Error("The next buyer batch could not be started.");
  if (!claimed || claimed.length === 0) return null;

  const outputs = await Promise.all(claimed.map(async (buyer) => {
    const persona = buyer.persona as unknown as Persona;
    try {
      return { buyer, result: await interviewPersona(apiKey, idea, persona), status: "completed" as const };
    } catch {
      return { buyer, result: null, status: "failed" as const };
    }
  }));

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (const output of outputs) {
    const update = output.result
      ? {
          status: "completed",
          would_buy: output.result.would_buy,
          reason: output.result.reason,
          objection: output.result.objection,
          price_too_cheap: output.result.price_too_cheap,
          price_cheap: output.result.price_cheap,
          price_expensive: output.result.price_expensive,
          price_too_expensive: output.result.price_too_expensive,
          updated_at: new Date().toISOString(),
        }
      : { status: "failed", updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("panel_answers").update(update).eq("id", output.buyer.answer_id).eq("run_id", run.id);
    if (error) throw new Error("A buyer response could not be saved.");
  }

  const { data: answers, error: answersError } = await userSupabase.from("panel_answers").select("status").eq("run_id", run.id);
  if (answersError) throw new Error("Buyer progress could not be refreshed.");
  const buyersCompleted = answers?.filter((answer) => answer.status === "completed").length ?? 0;
  const stageProgress = 20 + Math.floor(((answers?.length ?? 0) / run.buyer_target) * 55);
  await updateRun(supabaseAdmin, run.id, { stage: "panel", stage_progress: stageProgress, buyers_completed: buyersCompleted });
  return { ...run, stage: "panel", stage_progress: stageProgress, buyers_completed: buyersCompleted };
}

async function finishPanelStage(userSupabase: SupabaseClient, run: RunRow, idea: IdeaRow) {
  const { data: answers, error } = await userSupabase.from("panel_answers").select("*").eq("run_id", run.id).order("persona_index");
  if (error) throw new Error("Completed buyer answers could not be loaded.");
  const completed = (answers ?? []).filter((answer) => answer.status === "completed" && answer.would_buy !== null);
  if (completed.length === 0) {
    await markRunFailed(userSupabase, run, "No buyer responses completed, so the run was refunded.");
    return { ...run, status: "failed", error_message: "No buyer responses completed, so the run was refunded." };
  }
  const priceAnswers: BuyerPriceAnswers[] = completed.flatMap((answer) => {
    if (answer.price_too_cheap === null || answer.price_cheap === null || answer.price_expensive === null || answer.price_too_expensive === null) return [];
    return [{
      price_too_cheap: answer.price_too_cheap,
      price_cheap: answer.price_cheap,
      price_expensive: answer.price_expensive,
      price_too_expensive: answer.price_too_expensive,
    }];
  });
  const pricing = calculateVanWestendorp(priceAnswers);
  if (!pricing) throw new Error("The buyer panel did not provide usable price answers.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: pricingError } = await supabaseAdmin.from("pricing_results").upsert({ run_id: run.id, ...pricing }, { onConflict: "run_id" });
  if (pricingError) throw new Error("Pricing analysis could not be saved.");
  await updateRun(supabaseAdmin, run.id, { stage: "cfo", stage_progress: 78, buyers_completed: completed.length });
  return { ...run, stage: "cfo", stage_progress: 78, buyers_completed: completed.length };
}

async function finishEconomics(userSupabase: SupabaseClient, run: RunRow, idea: IdeaRow) {
  if (!isBusinessModel(idea.business_model)) throw new Error("Choose a business model before starting a run.");
  const inputs = numericInputs(idea.cfo_inputs);
  const validationError = validateFinanceInputs(idea.business_model, inputs);
  if (validationError) throw new Error(validationError);
  const outputs = calculateEconomics(idea.business_model, inputs);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("cfo_results").upsert({
    run_id: run.id,
    inputs: idea.cfo_inputs,
    outputs: outputs as unknown as Json,
  }, { onConflict: "run_id" });
  if (error) throw new Error("Unit economics could not be saved.");
  await updateRun(supabaseAdmin, run.id, { stage: "report", stage_progress: 88 });
  return { ...run, stage: "report", stage_progress: 88 };
}

async function finishReport(apiKey: string, userSupabase: SupabaseClient, run: RunRow, idea: IdeaRow) {
  const [{ data: answers, error: answersError }, { data: board, error: boardError }, { data: pricing, error: pricingError }, { data: cfo, error: cfoError }] = await Promise.all([
    userSupabase.from("panel_answers").select("would_buy, objection, status").eq("run_id", run.id),
    userSupabase.from("board_results").select("lens, score, vote, rationale").eq("run_id", run.id),
    userSupabase.from("pricing_results").select("*").eq("run_id", run.id).maybeSingle(),
    userSupabase.from("cfo_results").select("inputs, outputs").eq("run_id", run.id).maybeSingle(),
  ]);
  if (answersError || boardError || pricingError || cfoError || !cfo) throw new Error("The report data could not be loaded.");

  const completed = (answers ?? []).filter((answer) => answer.status === "completed" && answer.would_buy !== null);
  const buyRate = calculateBuyRate(completed);
  const economics = cfo.outputs as unknown as ReturnType<typeof calculateEconomics>;
  const { verdict, conditions } = calculateVerdict(economics, buyRate);
  const objectionCounts = new Map<string, number>();
  for (const answer of completed) {
    const objection = answer.objection?.trim();
    if (objection) objectionCounts.set(objection, (objectionCounts.get(objection) ?? 0) + 1);
  }
  const topObjections = [...objectionCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([objection]) => objection);
  const copy = await createReportCopy(apiKey, idea, buyRate, economics, board ?? [], topObjections);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: reportError } = await supabaseAdmin.from("reports").upsert({
    run_id: run.id,
    user_id: run.user_id,
    verdict,
    conditions: conditions as unknown as Json,
    summary: copy.summary,
    next_tests: copy.nextTests,
    buy_rate: buyRate,
  }, { onConflict: "run_id" });
  if (reportError) throw new Error("The report could not be saved.");
  await updateRun(supabaseAdmin, run.id, { status: "completed", stage: "completed", stage_progress: 100, buyers_completed: completed.length });
  return { ...run, status: "completed", stage: "completed", stage_progress: 100, buyers_completed: completed.length };
}

export async function startRun(userSupabase: SupabaseClient, ideaId: string, mode: RunMode) {
  const { data, error } = await userSupabase.rpc("start_idea_run", { _idea_id: ideaId, _mode: mode });
  if (error || !data) throw new Error(error?.message || "The run could not be started.");
  return { runId: data, mode, buyerTarget: RUN_MODES[mode].buyers, creditsCost: RUN_MODES[mode].credits };
}

export async function advanceRun(
  userSupabase: SupabaseClient,
  runId: string,
  apiKey: string,
) {
  const { data: run, error } = await userSupabase.from("runs").select("*").eq("id", runId).maybeSingle();
  if (error || !run) throw new Error("This run could not be found.");
  if (run.buyer_target > MAX_BUYERS) throw new Error("This run exceeds the 100-buyer limit.");
  if (run.status !== "running") return runState(run);

  try {
    const idea = await getIdea(userSupabase, run.idea_id);
    if (run.stage === "board") {
      const { data: existing, error: boardError } = await userSupabase.from("board_results").select("id").eq("run_id", run.id);
      if (boardError) throw new Error("Board results could not be checked.");
      if ((existing?.length ?? 0) < 3) {
        const next = await insertBoardResults(apiKey, userSupabase, run, idea);
        return runState(next);
      }
      await updateRun(userSupabase, run.id, { stage: "panel", stage_progress: 20 });
      return runState({ ...run, stage: "panel", stage_progress: 20 });
    }

    if (run.stage === "panel") {
      const { data: answers, error: panelError } = await userSupabase.from("panel_answers").select("persona, persona_index, status").eq("run_id", run.id).order("persona_index");
      if (panelError) throw new Error("Buyer progress could not be checked.");
      const panelRows = answers ?? [];
      const pendingCount = panelRows.filter((answer) => answer.status === "pending").length;
      const processingCount = panelRows.filter((answer) => answer.status === "processing").length;
      if (pendingCount > 0) {
        const next = await processPanelBatch(apiKey, userSupabase, run, idea);
        if (next) return runState(next);
      }
      if (processingCount > 0 && pendingCount === 0) return runState(run);
      if (panelRows.length < run.buyer_target) {
        const next = await generatePersonaBatch(apiKey, run, idea, panelRows);
        return runState(next);
      }
      const next = await finishPanelStage(userSupabase, run, idea);
      return runState(next);
    }

    if (run.stage === "cfo") {
      const next = await finishEconomics(userSupabase, run, idea);
      return runState(next);
    }

    if (run.stage === "report") {
      const next = await finishReport(apiKey, userSupabase, run, idea);
      return runState(next);
    }

    throw new Error("The run is at an unknown stage. Please contact support.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "The run could not be completed.";
    await markRunFailed(userSupabase, run, message);
    throw error instanceof Error ? error : new Error(message);
  }
}