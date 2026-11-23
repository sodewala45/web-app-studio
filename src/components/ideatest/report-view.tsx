import { ArrowDownToLine, CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FINANCE_FIELDS, MODEL_LABELS, type BusinessModel, type Economics } from "@/lib/ideatest/domain";
import { formatCurrency, formatPercent } from "@/lib/ideatest/format";
import type { Tables } from "@/integrations/supabase/types";

type ReportRecord = Tables<"reports">;
type IdeaRecord = Tables<"ideas">;
type RunRecord = Tables<"runs">;
type BoardRecord = Tables<"board_results">;
type BuyerRecord = Tables<"panel_answers">;
type PricingRecord = Tables<"pricing_results">;

export type ReportViewData = {
  report: ReportRecord;
  idea: IdeaRecord;
  run: RunRecord;
  board: BoardRecord[];
  answers: BuyerRecord[];
  pricing: PricingRecord | null;
  economics: Economics | null;
};

const verdictNames: Record<string, string> = {
  promising: "Promising",
  needs_work: "Needs work",
  not_viable_yet: "Not viable yet",
};

const conditionNames = [
  ["positiveContribution", "Positive contribution"],
  ["profitableYearOne", "Profitable year one"],
  ["buyRateAboveTwentyPercent", "Simulated buy rate above 20%"],
] as const;

function numberInputValue(inputs: IdeaRecord["cfo_inputs"], key: string) {
  if (inputs === null || Array.isArray(inputs) || typeof inputs !== "object") return null;
  const value = inputs[key];
  return typeof value === "number" ? value : null;
}

function VerdictMark({ passed }: { passed: boolean }) {
  return passed
    ? <CircleCheck className="size-4 shrink-0 text-primary" aria-label="Passed" />
    : <CircleX className="size-4 shrink-0 text-destructive" aria-label="Not passed" />;
}

export function ReportView({ data }: { data: ReportViewData }) {
  const model = data.idea.business_model as BusinessModel;
  const conditions = data.report.conditions as Record<string, boolean>;
  const completed = data.answers.filter((answer) => answer.status === "completed" && answer.would_buy !== null);
  const counts = {
    yes: completed.filter((answer) => answer.would_buy === "yes").length,
    maybe: completed.filter((answer) => answer.would_buy === "maybe").length,
    no: completed.filter((answer) => answer.would_buy === "no").length,
  };
  const objections = new Map<string, number>();
  for (const answer of completed) {
    const objection = answer.objection?.trim();
    if (objection) objections.set(objection, (objections.get(objection) ?? 0) + 1);
  }
  const topObjections = [...objections.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const currency = data.idea.currency;
  const maximumProfit = Math.max(1, ...(data.economics?.monthly.map((month) => Math.abs(month.profit)) ?? []));

  return (
    <article className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase text-primary">IdeaTest report</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">{data.idea.summary || data.idea.idea_text.slice(0, 90)}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{MODEL_LABELS[model] ?? "Business model"} · {data.idea.country} · {currency}</p>
        </div>
        <Button onClick={() => window.print()}><ArrowDownToLine aria-hidden="true" />Download PDF</Button>
      </div>

      <section className="border-y border-border py-6" aria-labelledby="verdict-title">
        <div className="grid gap-6 md:grid-cols-[1fr_1.4fr] md:items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Computed verdict</p>
            <h2 id="verdict-title" className="mt-2 font-display text-4xl font-semibold text-primary">{verdictNames[data.report.verdict] ?? "Needs work"}</h2>
            <p className="mt-3 text-sm text-muted-foreground">Based on your financial inputs and the simulated buyer panel.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-3">
            {conditionNames.map(([key, label]) => (
              <li key={key} className="flex items-start gap-2 border-l-2 border-border pl-3 text-sm">
                <VerdictMark passed={conditions[key] === true} />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-8 border-b border-border py-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="font-display text-2xl font-semibold">Idea summary</h2>
          <p className="mt-3 whitespace-pre-line leading-7 text-muted-foreground">{data.report.summary}</p>
          <div className="mt-5 border-l-2 border-primary pl-4 text-sm leading-6">
            <p className="font-semibold">Original description</p>
            <p className="mt-1 text-muted-foreground">{data.idea.idea_text}</p>
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">Board review</h2>
            <span className="text-xs text-muted-foreground">Estimates</span>
          </div>
          <div className="mt-4 divide-y divide-border">
            {data.board.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-4">
                <div>
                  <h3 className="font-medium">{item.lens.replaceAll("_", " ")}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.rationale}</p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
                    {Array.isArray(item.risks) ? item.risks.map((risk, index) => <li key={`${item.id}-${index}`}>{String(risk)}</li>) : null}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">What could stop it: {item.kill_condition}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-semibold text-primary">{item.score}/10</p>
                  <p className="text-xs text-muted-foreground">Estimate</p>
                  <p className="mt-2 text-xs font-semibold uppercase text-foreground">{item.vote.replaceAll("_", " ")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-8 border-b border-border py-8 lg:grid-cols-2">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">Buyer panel</h2>
            <span className="text-xs text-muted-foreground">Simulated · {completed.length} of {data.run.buyer_target} completed</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Simulated buy rate · {formatPercent(data.report.buy_rate, 1)}</p>
          <div className="mt-4 grid grid-cols-3 border-y border-border py-4 text-center">
            {(["yes", "maybe", "no"] as const).map((vote) => (
              <div key={vote} className="border-r border-border last:border-r-0">
                <p className="text-2xl font-semibold">{counts[vote]}</p>
                <p className="text-xs text-muted-foreground">Simulated {vote}</p>
              </div>
            ))}
          </div>
          <h3 className="mt-6 text-sm font-semibold">Common objections</h3>
          {topObjections.length > 0 ? (
            <ul className="mt-2 divide-y divide-border">
              {topObjections.map(([objection, count]) => (
                <li key={objection} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span>“{objection}”</span><span className="shrink-0 text-xs text-muted-foreground">Simulated · {count}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">No completed buyer responses.</p>}
          <h3 className="mt-6 text-sm font-semibold">Sample buyer comments</h3>
          <div className="mt-2 space-y-3">
            {completed.filter((answer) => answer.reason).slice(0, 3).map((answer) => (
              <blockquote key={answer.id} className="border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
                “{answer.reason}” <span className="not-italic">— simulated buyer</span>
              </blockquote>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold">Price sensitivity</h2>
          <p className="mt-2 text-sm text-muted-foreground">Van Westendorp estimates from completed simulated answers.</p>
          {data.pricing ? (
            <dl className="mt-4 divide-y divide-border border-y border-border">
              {[
                ["Point of marginal cheapness", data.pricing.point_of_marginal_cheapness],
                ["Point of marginal expensiveness", data.pricing.point_of_marginal_expensiveness],
                ["Optimal price point", data.pricing.optimal_price_point],
                ["Indifference price", data.pricing.indifference_price],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between gap-4 py-3">
                  <dt className="text-sm">{label}</dt>
                  <dd className="text-right font-semibold">{formatCurrency(currency, Number(value))}<span className="ml-2 block text-xs font-normal text-muted-foreground">Estimate</span></dd>
                </div>
              ))}
            </dl>
          ) : <p className="mt-4 text-sm text-muted-foreground">There are not enough completed price answers yet.</p>}
          <p className="mt-3 text-xs text-muted-foreground">Price-answer count · Simulated {data.pricing?.completed_responses ?? 0}</p>
        </div>
      </section>

      <section className="border-b border-border py-8">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-semibold">Unit economics</h2>
            <p className="mt-2 text-sm text-muted-foreground">Calculated from the assumptions you entered. No missing values are filled in.</p>
          </div>
          <span className="text-xs text-muted-foreground">Estimates</span>
        </div>
        {model && data.economics ? (
          <>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Contribution margin", `${data.economics.contributionMarginPercent.toFixed(1)}%`],
                ["Year-one profit", formatCurrency(currency, data.economics.year1Profit)],
                ["Break-even", data.economics.breakEvenUnits === null ? "Not reached" : `${data.economics.breakEvenUnits.toLocaleString("en-IN")} ${data.economics.breakEvenUnitLabel}`],
                ["Cash needed", formatCurrency(currency, data.economics.cashNeeded)],
              ].map(([label, value]) => (
                <div key={label} className="border-l-2 border-primary pl-3">
                  <p className="text-xs text-muted-foreground">{label} · Estimate</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-7 grid gap-8 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold">Your inputs · {MODEL_LABELS[model]}</h3>
                <dl className="mt-3 divide-y divide-border border-y border-border">
                  {FINANCE_FIELDS[model].map((field) => {
                    const value = numberInputValue(data.idea.cfo_inputs, field.key);
                    return (
                      <div key={field.key} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                        <dt>{field.label}<span className="ml-1 text-xs text-muted-foreground">({field.unit})</span></dt>
                        <dd className="font-medium">{value === null ? "—" : field.key.includes("percent") ? `${value}%` : formatCurrency(currency, value)}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
              <div>
                <h3 className="text-sm font-semibold">Year-one monthly profit · Estimate</h3>
                <div className="mt-4 flex h-44 items-end gap-1 border-b border-border px-1">
                  {data.economics.monthly.map((month) => (
                    <div key={month.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                      <div
                        className={`w-full min-w-1 rounded-t-sm ${month.profit >= 0 ? "bg-chart-1" : "bg-destructive"}`}
                        style={{ height: `${Math.max(4, (Math.abs(month.profit) / maximumProfit) * 100)}%` }}
                        title={`Month ${month.month}: ${formatCurrency(currency, month.profit)} estimate`}
                      />
                      <span className="text-[10px] text-muted-foreground">{month.month}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Month</span><span>0 = no operating cash gap</span>
                </div>
              </div>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[540px] border-collapse text-sm">
                <thead><tr className="border-y border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Month</th><th className="py-2 pr-4 font-medium">Revenue · Estimate</th><th className="py-2 pr-4 font-medium">Contribution · Estimate</th><th className="py-2 font-medium">Profit · Estimate</th>
                </tr></thead>
                <tbody>{data.economics.monthly.map((month) => (
                  <tr key={month.month} className="border-b border-border">
                    <td className="py-2 pr-4">{month.month}</td>
                    <td className="py-2 pr-4">{formatCurrency(currency, month.revenue)}</td>
                    <td className="py-2 pr-4">{formatCurrency(currency, month.contribution)}</td>
                    <td className="py-2">{formatCurrency(currency, month.profit)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Payback · Estimate {data.economics.paybackMonth === null ? "not reached in year one" : data.economics.paybackMonth === 0 ? "no cash gap under these inputs" : `month ${data.economics.paybackMonth}`}</p>
          </>
        ) : (
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground"><TriangleAlert className="size-4" aria-hidden="true" />Financial estimates are unavailable because required inputs were missing.</p>
        )}
      </section>

      <section className="py-8">
        <h2 className="font-display text-2xl font-semibold">What to test with real people next</h2>
        <ol className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-3">
          {(() => {
            const nextTests = data.report.next_tests;
            return Array.isArray(nextTests) ? nextTests.map((test, index) => (
              <li key={index} className="border-t-2 border-primary pt-3">
                <span className="text-xs font-semibold uppercase text-primary">Test {index + 1}</span>
                <p className="mt-2 text-sm leading-6">{String(test)}</p>
              </li>
            )) : null;
          })()}
        </ol>
      </section>

      <aside className="border-y border-border bg-secondary px-4 py-5 text-sm leading-6 sm:px-6" role="note">
        <p className="font-semibold">Important limits</p>
        <p className="mt-1">Buyers are simulated by AI, not real customers. Treat the buy rate as an upper bound and confirm with real people. Not financial or legal advice.</p>
      </aside>
    </article>
  );
}