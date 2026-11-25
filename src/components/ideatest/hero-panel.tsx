import { Check, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Answer = "yes" | "maybe" | "no";

const TOTAL = 100;
const YES = 34;
const MAYBE = 18;
const STEP_MS = 32;
const START_DELAY_MS = 500;

// A fixed, shuffled sample so the grid looks the same on every visit.
function sampleAnswers(): Answer[] {
  const answers: Answer[] = [
    ...Array<Answer>(YES).fill("yes"),
    ...Array<Answer>(MAYBE).fill("maybe"),
    ...Array<Answer>(TOTAL - YES - MAYBE).fill("no"),
  ];
  let seed = 7;
  for (let i = answers.length - 1; i > 0; i -= 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    const j = seed % (i + 1);
    const a = answers[i] as Answer;
    answers[i] = answers[j] as Answer;
    answers[j] = a;
  }
  return answers;
}

const DOT_CLASS: Record<Answer | "pending", string> = {
  pending: "bg-transparent ring-1 ring-inset ring-foreground/15 scale-75",
  yes: "bg-primary scale-100",
  maybe: "bg-amber-400 scale-100",
  no: "bg-foreground/20 scale-100",
};

const CHECKS = [
  { label: "Contribution is positive", pass: true },
  { label: "More than 20% of buyers say yes", pass: true },
  { label: "Year one is profitable", pass: false },
] as const;

export function HeroPanel() {
  const answers = useMemo(sampleAnswers, []);
  const [shown, setShown] = useState(0);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(TOTAL);
      return;
    }
    setShown(0);
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        setShown((current) => {
          if (current >= TOTAL) {
            if (interval) clearInterval(interval);
            return TOTAL;
          }
          return current + 1;
        });
      }, STEP_MS);
    }, START_DELAY_MS);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [run]);

  const done = shown >= TOTAL;
  const yesSoFar = answers.slice(0, shown).filter((a) => a === "yes").length;

  return (
    <figure
      className="relative rounded-2xl border border-border bg-card p-5 shadow-[0_30px_80px_-40px_oklch(0.42_0.085_178/0.55)] sm:p-7"
      aria-label="Sample run: 34 of 100 simulated buyers would buy, verdict Needs work"
    >
      <figcaption className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">Sourdough subscription for Lahore offices</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Sample run, for illustration. Full run: 100 simulated buyers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Replay
        </button>
      </figcaption>

      <div
        className="mx-auto mt-5 grid max-w-xs grid-cols-10 gap-2 sm:max-w-[19rem]"
        aria-hidden="true"
      >
        {answers.map((answer, index) => (
          <span
            key={index}
            className={`aspect-square rounded-full transition-all duration-300 ease-out ${
              DOT_CLASS[index < shown ? answer : "pending"]
            }`}
          />
        ))}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-border pt-4">
        <p className="font-display text-4xl font-semibold leading-none tabular-nums">
          {yesSoFar}
          <span className="ml-1.5 font-sans text-sm font-normal text-muted-foreground">
            of 100 would buy
          </span>
        </p>
        <ul className="flex gap-3 text-xs text-muted-foreground" aria-hidden="true">
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-primary" />
            Yes
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-amber-400" />
            Maybe
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-foreground/20" />
            No
          </li>
        </ul>
      </div>

      <div
        className={`grid transition-all duration-500 ease-out ${
          done ? "mt-5 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="rounded-xl bg-secondary p-4">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Acceptable price per month</span>
              <span className="font-semibold tabular-nums">Rs 900 to Rs 1,800</span>
            </div>
            <div className="relative mt-3 h-1.5 rounded-full bg-foreground/10">
              <div className="absolute inset-y-0 left-[30%] right-[22%] rounded-full bg-primary" />
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              {CHECKS.map((check) => (
                <li key={check.label} className="flex items-center gap-2">
                  {check.pass ? (
                    <Check className="size-4 text-primary" aria-label="Pass" />
                  ) : (
                    <X className="size-4 text-destructive" aria-label="Fail" />
                  )}
                  <span>{check.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 inline-block rounded-md bg-amber-400 px-2.5 py-1 text-sm font-semibold text-foreground">
              Verdict: Needs work
            </p>
          </div>
        </div>
      </div>
    </figure>
  );
}
