import { Link, createFileRoute } from "@tanstack/react-router";
import { CircleCheck, FlaskConical, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { HeroPanel } from "@/components/ideatest/hero-panel";
import { BuyCreditsDialog } from "@/components/ideatest/buy-credits-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CREDIT_PACKS } from "@/lib/ideatest/packs";

const TITLE = "IdeaTest — Test your startup idea before you spend a rupee";
const DESCRIPTION =
  "Describe a startup idea in any niche. IdeaTest runs it through an AI board, a panel of simulated buyers, a price analysis and your own unit economics, then gives a computed verdict.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Landing,
});

const steps = [
  {
    title: "Describe your idea",
    text: "Write it in plain words, pick your country and currency. Any niche works: a product, software, a service, a marketplace or a local shop.",
  },
  {
    title: "Add your own numbers",
    text: "IdeaTest works out your business type and asks only the money questions that apply to it. Nothing is guessed, and a missing number stops the run.",
  },
  {
    title: "Get a computed verdict",
    text: "An AI board reviews the idea, 20 or 100 simulated buyers react to it, and the maths for price and profit is done in code, not by the AI.",
  },
] as const;

const reportParts = [
  "A verdict computed from your numbers, with each pass or fail shown",
  "Board review from three lenses: offer, differentiation, product craft",
  "Simulated buyer panel: who would buy, who wouldn't, and the objections in their own words",
  "Price range from the buyers' answers (Van Westendorp)",
  "Year-one unit economics, break-even and cash needed",
  "Three things to test with real people next",
] as const;

function HeaderCta() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSignedIn(Boolean(data.session));
    });
    return () => {
      active = false;
    };
  }, []);
  return signedIn ? (
    <Button asChild size="sm">
      <Link to="/dashboard">Dashboard</Link>
    </Button>
  ) : (
    <div className="flex items-center gap-1">
      <Button asChild variant="ghost" size="sm">
        <Link to="/auth">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link to="/auth">Start free</Link>
      </Button>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold">
            <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground">
              <FlaskConical className="size-5" aria-hidden="true" />
            </span>
            <span className="font-display text-xl">IdeaTest</span>
          </Link>
          <nav
            className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
            aria-label="Page sections"
          >
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#report" className="hover:text-foreground">
              The report
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </nav>
          <HeaderCta />
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-[radial-gradient(60rem_28rem_at_85%_0%,oklch(0.93_0.04_178),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 sm:px-6 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:px-8">
            <div>
              <h1 className="font-display text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl">
                Find out if 100 buyers want it before it costs you anything
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
                Describe your startup idea in any niche. A panel of simulated buyers reacts, your
                own numbers decide the profit, and the code, not the AI, gives the verdict.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="h-12 px-7 text-base">
                  <Link to="/auth">Test my idea free</Link>
                </Button>
                <a
                  href="#how"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  See how it works
                </a>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Your first Quick run is free. No card needed.
              </p>
            </div>
            <HeroPanel />
          </div>
        </section>

        <section id="how" className="border-y border-border bg-secondary/60 py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-semibold">How it works</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3">
              {steps.map((step, index) => (
                <li key={step.title} className="border-t-2 border-primary pt-4">
                  <span className="text-xs font-semibold uppercase text-primary">
                    Step {index + 1}
                  </span>
                  <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="report"
          className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8"
        >
          <div>
            <h2 className="font-display text-3xl font-semibold">What is in the report</h2>
            <p className="mt-3 leading-7 text-muted-foreground">
              Every number is labelled as your input, an estimate or simulated, so you always know
              what you are looking at.
            </p>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {reportParts.map((part) => (
              <li key={part} className="flex items-start gap-3 py-3 text-sm leading-6">
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{part}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 lg:px-8">
          <aside
            className="flex items-start gap-3 border-y border-border bg-secondary px-4 py-5 text-sm leading-6 sm:px-6"
            role="note"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="font-semibold">Honest limits</p>
              <p className="mt-1">
                Buyers are simulated by AI, not real customers. AI buyers tend to be agreeable, so
                treat the buy rate as an upper bound and confirm with real people before you spend.
                Your numbers decide the economics, so they are only as good as what you enter. Not
                financial or legal advice.
              </p>
            </div>
          </aside>
        </section>

        <section id="pricing" className="border-t border-border bg-secondary/60 py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-3xl font-semibold">Pricing</h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              Pay per run with credits. A Quick run (20 simulated buyers) costs 1 credit. A Full run
              (100 simulated buyers) costs 5 credits. Your first Quick run is free.
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {CREDIT_PACKS.map((pack) => (
                <div
                  key={pack.name}
                  className="flex flex-col border-t-2 border-primary bg-background p-5"
                >
                  <h3 className="font-display text-xl font-semibold">{pack.name}</h3>
                  <p className="mt-1 text-3xl font-semibold">{pack.credits} credits</p>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                    {pack.blurb}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">Price announced at launch</p>
                  <BuyCreditsDialog>
                    <Button variant="outline" className="mt-3">
                      Buy credits
                    </Button>
                  </BuyCreditsDialog>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-3xl font-semibold">
            Find the weak spots while they are still cheap to fix
          </h2>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link to="/auth">Test my idea free</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        <p>
          Buyer personas are AI simulations, not real customer research. Not financial or legal
          advice.
        </p>
        <p className="mt-1">
          Method inspired by the MIT-licensed founder-skill by Jake Schincariol.
        </p>
      </footer>
    </div>
  );
}
