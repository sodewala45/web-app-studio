import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { BuyCreditsDialog } from "@/components/ideatest/buy-credits-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  BUSINESS_MODELS,
  FINANCE_FIELDS,
  MODEL_LABELS,
  RUN_MODES,
  validateFinanceInputs,
  type BusinessModel,
  type NumericInputs,
  type RunMode,
} from "@/lib/ideatest/domain";
import { messageOf } from "@/lib/ideatest/errors";
import {
  classifyIdeaFn,
  isSupportedBusinessModel,
  startIdeaRunFn,
} from "@/lib/ideatest/pipeline.functions";

type StepId = "describe" | "market" | "type" | "numbers" | "run";

const STEPS: ReadonlyArray<{ id: StepId; label: string }> = [
  { id: "describe", label: "Idea" },
  { id: "market", label: "Market" },
  { id: "type", label: "Business type" },
  { id: "numbers", label: "Numbers" },
  { id: "run", label: "Run" },
];

const COUNTRIES = [
  { key: "PK", name: "Pakistan", currency: "PKR" },
  { key: "AE", name: "United Arab Emirates", currency: "AED" },
  { key: "SA", name: "Saudi Arabia", currency: "SAR" },
  { key: "IN", name: "India", currency: "INR" },
  { key: "BD", name: "Bangladesh", currency: "BDT" },
  { key: "US", name: "United States", currency: "USD" },
  { key: "GB", name: "United Kingdom", currency: "GBP" },
  { key: "CA", name: "Canada", currency: "CAD" },
  { key: "EU", name: "Eurozone", currency: "EUR" },
  { key: "TR", name: "Turkey", currency: "TRY" },
  { key: "NG", name: "Nigeria", currency: "NGN" },
] as const;

const LOW_CONFIDENCE = 0.65;

function isStringArray(value: Json): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function answersFrom(value: Json, count: number): string[] {
  const result = Array.from({ length: count }, () => "");
  if (!Array.isArray(value)) return result;
  value.forEach((item, index) => {
    if (index < count && item !== null && typeof item === "object" && !Array.isArray(item)) {
      const answer = item["answer"];
      if (typeof answer === "string") result[index] = answer;
    }
  });
  return result;
}

function valuesFrom(value: Json): Record<string, string> {
  const result: Record<string, string> = {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) return result;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number") result[key] = String(entry);
  }
  return result;
}

function parseNumber(text: string | undefined) {
  if (text === undefined || text.trim() === "") return Number.NaN;
  return Number(text);
}

export function IdeaWizard({ ideaId: initialIdeaId }: { ideaId: string | undefined }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<StepId>("describe");
  const [ideaId, setIdeaId] = useState<string | null>(initialIdeaId ?? null);
  const [ideaText, setIdeaText] = useState("");
  const [countryKey, setCountryKey] = useState("PK");
  const [customCountry, setCustomCountry] = useState("");
  const [customCurrency, setCustomCurrency] = useState("");
  const [summary, setSummary] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [model, setModel] = useState<BusinessModel | "">("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [classifiedKey, setClassifiedKey] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<RunMode>("quick");
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const market = useMemo(() => {
    if (countryKey === "OTHER")
      return { country: customCountry.trim(), currency: customCurrency.trim().toUpperCase() };
    const found = COUNTRIES.find((country) => country.key === countryKey);
    return { country: found?.name ?? "", currency: found?.currency ?? "" };
  }, [countryKey, customCountry, customCurrency]);

  const existing = useQuery({
    queryKey: ["ideatest-idea", initialIdeaId],
    enabled: Boolean(initialIdeaId),
    queryFn: async () => {
      const { data, error: loadError } = await supabase
        .from("ideas")
        .select("*")
        .eq("id", initialIdeaId ?? "")
        .maybeSingle();
      if (loadError || !data) throw new Error("This idea could not be found.");
      return data;
    },
  });

  useEffect(() => {
    const idea = existing.data;
    if (!idea || hydrated) return;
    setHydrated(true);
    setIdeaText(idea.idea_text);
    const country = COUNTRIES.find(
      (entry) => entry.name === idea.country && entry.currency === idea.currency,
    );
    if (country) setCountryKey(country.key);
    else {
      setCountryKey("OTHER");
      setCustomCountry(idea.country);
      setCustomCurrency(idea.currency);
    }
    setSummary(idea.summary ?? "");
    setConfidence(idea.model_confidence);
    const loadedQuestions = isStringArray(idea.followup_questions) ? idea.followup_questions : [];
    setQuestions(loadedQuestions);
    setAnswers(answersFrom(idea.followup_answers, loadedQuestions.length));
    setValues(valuesFrom(idea.cfo_inputs));
    setClassifiedKey(`${idea.idea_text}|${idea.country}|${idea.currency}`);
    if (idea.business_model && isSupportedBusinessModel(idea.business_model)) {
      setModel(idea.business_model);
      setStep("run");
    }
  }, [existing.data, hydrated]);

  const classify = useMutation({
    mutationFn: () =>
      classifyIdeaFn({
        data: { idea: ideaText.trim(), country: market.country, currency: market.currency },
      }),
    onSuccess: (result) => {
      setModel(result.business_model);
      setConfidence(result.confidence);
      setSummary(result.summary);
      setQuestions(result.followup_questions);
      setAnswers(result.followup_questions.map(() => ""));
      setClassifiedKey(`${ideaText.trim()}|${market.country}|${market.currency}`);
      setStep("type");
    },
    onError: (caught) => setError(messageOf(caught)),
  });

  const save = useMutation({
    mutationFn: async (selectedModel: BusinessModel) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Your sign-in session has ended. Please sign in again.");
      const numeric: NumericInputs = {};
      for (const field of FINANCE_FIELDS[selectedModel])
        numeric[field.key] = parseNumber(values[field.key]);
      const fields = {
        idea_text: ideaText.trim(),
        country: market.country,
        currency: market.currency,
        business_model: selectedModel,
        model_confidence: confidence,
        summary: summary || null,
        followup_questions: questions as Json,
        followup_answers: questions.map((question, index) => ({
          question,
          answer: answers[index] ?? "",
        })) as Json,
        cfo_inputs: numeric as Json,
      };
      if (ideaId) {
        const { error: updateError } = await supabase.from("ideas").update(fields).eq("id", ideaId);
        if (updateError) throw new Error("Your idea could not be saved. Please try again.");
        return ideaId;
      }
      const { data, error: insertError } = await supabase
        .from("ideas")
        .insert({ ...fields, user_id: auth.user.id })
        .select("id")
        .single();
      if (insertError || !data) throw new Error("Your idea could not be saved. Please try again.");
      return data.id;
    },
    onSuccess: (id) => {
      setIdeaId(id);
      setStep("run");
    },
    onError: (caught) => setError(messageOf(caught)),
  });

  const credits = useQuery({
    queryKey: ["ideatest-credits"],
    enabled: step === "run",
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Your sign-in session has ended.");
      const { data } = await supabase
        .from("profiles")
        .select("credits")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return data?.credits ?? 0;
    },
  });

  const start = useMutation({
    mutationFn: () => {
      if (!ideaId) throw new Error("Save your idea before starting a run.");
      return startIdeaRunFn({ data: { ideaId, mode } });
    },
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["ideatest-account"] }),
        queryClient.invalidateQueries({ queryKey: ["ideatest-dashboard"] }),
      ]);
      await navigate({ to: "/runs/$runId", params: { runId: result.runId } });
    },
    onError: (caught) => setError(messageOf(caught)),
  });

  function goTo(next: StepId) {
    setError(null);
    setStep(next);
  }

  function continueFromDescribe() {
    if (ideaText.trim().length < 20) {
      setError("Describe your idea in at least a couple of sentences (20 characters or more).");
      return;
    }
    goTo("market");
  }

  function continueFromMarket() {
    if (market.country.length < 2) {
      setError("Enter your country.");
      return;
    }
    if (!/^[A-Z]{3}$/.test(market.currency)) {
      setError("Enter a three-letter currency code, for example PKR or USD.");
      return;
    }
    setError(null);
    const key = `${ideaText.trim()}|${market.country}|${market.currency}`;
    if (questions.length >= 3 && key === classifiedKey && model !== "") {
      setStep("type");
      return;
    }
    classify.mutate();
  }

  function continueFromType() {
    if (model === "") {
      setError("Choose the business type that fits best.");
      return;
    }
    goTo("numbers");
  }

  function continueFromNumbers() {
    if (model === "") return;
    const numeric: NumericInputs = {};
    for (const field of FINANCE_FIELDS[model]) numeric[field.key] = parseNumber(values[field.key]);
    const problem = validateFinanceInputs(model, numeric);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    save.mutate(model);
  }

  const currentIndex = STEPS.findIndex((entry) => entry.id === step);
  const cost = RUN_MODES[mode].credits;
  const balance = credits.data;
  const canAfford = balance !== undefined && balance >= cost;

  if (initialIdeaId && existing.isLoading) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Loading your idea…
      </p>
    );
  }
  if (initialIdeaId && existing.error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>{existing.error.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div>
      <ol className="flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Progress">
        {STEPS.map((entry, index) => (
          <li
            key={entry.id}
            aria-current={entry.id === step ? "step" : undefined}
            className={
              entry.id === step
                ? "font-semibold text-primary"
                : index < currentIndex
                  ? "text-foreground"
                  : "text-muted-foreground"
            }
          >
            {index + 1}. {entry.label}
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t border-border pt-8">
        {step === "describe" ? (
          <section aria-labelledby="step-title">
            <h1 id="step-title" className="font-display text-3xl font-semibold">
              What is your idea?
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Say who it is for, what problem it solves and how you would make money. Plain words
              are fine.
            </p>
            <Label htmlFor="idea" className="sr-only">
              Your idea
            </Label>
            <Textarea
              id="idea"
              rows={8}
              maxLength={4000}
              className="mt-5"
              placeholder="Example: A cloud kitchen in Karachi that sells healthy lunch boxes to office workers on a weekly subscription…"
              value={ideaText}
              onChange={(event) => setIdeaText(event.target.value)}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">{ideaText.length} / 4000</p>
          </section>
        ) : null}

        {step === "market" ? (
          <section aria-labelledby="step-title">
            <h1 id="step-title" className="font-display text-3xl font-semibold">
              Where will you sell?
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Your country and currency shape the buyer panel and every money figure in the report.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="country">Country</Label>
                <Select value={countryKey} onValueChange={setCountryKey}>
                  <SelectTrigger id="country" className="mt-1.5">
                    <SelectValue placeholder="Choose a country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.key} value={country.key}>
                        {country.name} ({country.currency})
                      </SelectItem>
                    ))}
                    <SelectItem value="OTHER">Another country</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {countryKey === "OTHER" ? (
                <>
                  <div>
                    <Label htmlFor="custom-country">Country name</Label>
                    <Input
                      id="custom-country"
                      className="mt-1.5"
                      value={customCountry}
                      onChange={(event) => setCustomCountry(event.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="custom-currency">Currency code</Label>
                    <Input
                      id="custom-currency"
                      className="mt-1.5 uppercase"
                      maxLength={3}
                      placeholder="e.g. EGP"
                      value={customCurrency}
                      onChange={(event) => setCustomCurrency(event.target.value)}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </section>
        ) : null}

        {step === "type" ? (
          <section aria-labelledby="step-title">
            <h1 id="step-title" className="font-display text-3xl font-semibold">
              Your business type
            </h1>
            {summary ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{summary}</p>
            ) : null}
            <div className="mt-5">
              <Label htmlFor="model">Business type</Label>
              <Select value={model} onValueChange={(value) => setModel(value as BusinessModel)}>
                <SelectTrigger id="model" className="mt-1.5 sm:max-w-sm">
                  <SelectValue placeholder="Choose a business type" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_MODELS.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {MODEL_LABELS[entry]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-2 text-xs text-muted-foreground">
                {confidence !== null && confidence < LOW_CONFIDENCE
                  ? "We are not sure about this one, so please check the type before you continue."
                  : "This is our best match. Change it if it is wrong; it decides which money questions come next."}
              </p>
            </div>
            {questions.length > 0 ? (
              <div className="mt-8">
                <h2 className="text-lg font-semibold">A few questions about your idea</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Optional, but better answers give the board and buyers more to work with.
                </p>
                <div className="mt-4 space-y-5">
                  {questions.map((question, index) => (
                    <div key={question}>
                      <Label htmlFor={`question-${index}`} className="leading-6">
                        {question}
                      </Label>
                      <Textarea
                        id={`question-${index}`}
                        rows={2}
                        maxLength={600}
                        className="mt-1.5"
                        value={answers[index] ?? ""}
                        onChange={(event) =>
                          setAnswers((current) =>
                            current.map((entry, position) =>
                              position === index ? event.target.value : entry,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === "numbers" && model !== "" ? (
          <section aria-labelledby="step-title">
            <h1 id="step-title" className="font-display text-3xl font-semibold">
              Your numbers
            </h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              These are your inputs for a {MODEL_LABELS[model].toLowerCase()}. Money amounts are in{" "}
              {market.currency}. Use your best figures: the report labels them as your inputs and
              never fills a gap for you.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {FINANCE_FIELDS[model].map((field) => (
                <div key={field.key}>
                  <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Input
                      id={`field-${field.key}`}
                      type="number"
                      inputMode="decimal"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={values[field.key] ?? ""}
                      onChange={(event) =>
                        setValues((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                    />
                    <span className="w-24 shrink-0 text-xs text-muted-foreground">
                      {field.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {step === "run" ? (
          <section aria-labelledby="step-title">
            <h1 id="step-title" className="font-display text-3xl font-semibold">
              Choose your run
            </h1>
            {summary ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{summary}</p>
            ) : null}
            <RadioGroup
              value={mode}
              onValueChange={(value) => setMode(value as RunMode)}
              className="mt-6 gap-0 divide-y divide-border border-y border-border"
            >
              {(["quick", "full"] as const).map((option) => (
                <Label
                  key={option}
                  htmlFor={`mode-${option}`}
                  className="flex cursor-pointer items-start gap-3 py-4 font-normal"
                >
                  <RadioGroupItem id={`mode-${option}`} value={option} className="mt-1" />
                  <span>
                    <span className="block font-semibold">
                      {option === "quick" ? "Quick run" : "Full run"} · {RUN_MODES[option].credits}{" "}
                      {RUN_MODES[option].credits === 1 ? "credit" : "credits"}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {option === "quick"
                        ? "20 simulated buyers. A fast first read on the idea, usually a couple of minutes."
                        : "100 simulated buyers. A steadier price range and objection list. Takes longer."}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
            <p className="mt-4 text-sm text-muted-foreground" role="status">
              {credits.isLoading
                ? "Checking your credits…"
                : `You have ${balance ?? 0} ${balance === 1 ? "credit" : "credits"}. This run costs ${cost}.`}
            </p>
            {balance !== undefined && !canAfford ? (
              <Alert className="mt-4" role="alert">
                <AlertDescription>
                  You do not have enough credits for this run.{" "}
                  <BuyCreditsDialog>
                    <button
                      type="button"
                      className="font-medium text-primary underline underline-offset-4"
                    >
                      Buy credits
                    </button>
                  </BuyCreditsDialog>{" "}
                  or choose a Quick run.
                </AlertDescription>
              </Alert>
            ) : null}
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Buyers are simulated by AI, not real customers. If the whole run fails, your credits
              are refunded.
            </p>
          </section>
        ) : null}

        {error ? (
          <Alert variant="destructive" className="mt-6" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          {currentIndex > 0 ? (
            <Button
              type="button"
              variant="ghost"
              disabled={classify.isPending || save.isPending || start.isPending}
              onClick={() => goTo(STEPS[currentIndex - 1]?.id ?? "describe")}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step === "describe" ? (
            <Button onClick={continueFromDescribe}>
              Continue
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : null}
          {step === "market" ? (
            <Button onClick={continueFromMarket} disabled={classify.isPending}>
              {classify.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              {classify.isPending ? "Reading your idea…" : "Continue"}
              {classify.isPending ? null : <ArrowRight aria-hidden="true" />}
            </Button>
          ) : null}
          {step === "type" ? (
            <Button onClick={continueFromType}>
              Continue
              <ArrowRight aria-hidden="true" />
            </Button>
          ) : null}
          {step === "numbers" ? (
            <Button onClick={continueFromNumbers} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Save and continue
            </Button>
          ) : null}
          {step === "run" ? (
            <Button
              onClick={() => {
                setError(null);
                start.mutate();
              }}
              disabled={start.isPending || !canAfford}
            >
              {start.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Start {mode === "quick" ? "Quick" : "Full"} run
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
