import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { MODEL_LABELS, type BusinessModel } from "@/lib/ideatest/domain";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "My ideas — IdeaTest" }] }),
  component: Dashboard,
});

const verdictNames: Record<string, string> = {
  promising: "Promising",
  needs_work: "Needs work",
  not_viable_yet: "Not viable yet",
};

type IdeaRow = {
  id: string;
  idea_text: string;
  summary: string | null;
  business_model: string | null;
  country: string;
  created_at: string;
};
type RunRow = {
  id: string;
  idea_id: string;
  mode: string;
  status: string;
  stage: string;
  stage_progress: number;
};

function isBusinessModel(value: string | null): value is BusinessModel {
  return value !== null && value in MODEL_LABELS;
}

function IdeaStatus({ run, verdict }: { run: RunRow | undefined; verdict: string | undefined }) {
  if (!run) return <Badge variant="outline">Not run yet</Badge>;
  if (run.status === "running")
    return <Badge variant="secondary">Running · {run.stage_progress}%</Badge>;
  if (run.status === "failed")
    return <Badge variant="destructive">Failed · credits refunded</Badge>;
  return <Badge>{verdict ? (verdictNames[verdict] ?? verdict) : "Completed"}</Badge>;
}

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ideatest-dashboard"],
    queryFn: async () => {
      const [ideas, runs, reports] = await Promise.all([
        supabase
          .from("ideas")
          .select("id, idea_text, summary, business_model, country, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("runs")
          .select("id, idea_id, mode, status, stage, stage_progress")
          .order("created_at", { ascending: false }),
        supabase.from("reports").select("run_id, verdict"),
      ]);
      if (ideas.error || runs.error || reports.error)
        throw new Error("Your ideas could not be loaded. Please refresh.");
      const verdictByRun = new Map(
        (reports.data ?? []).map((report) => [report.run_id, report.verdict]),
      );
      const latestRun = new Map<string, RunRow>();
      for (const run of runs.data ?? [])
        if (!latestRun.has(run.idea_id)) latestRun.set(run.idea_id, run);
      return (ideas.data ?? []).map((idea: IdeaRow) => {
        const run = latestRun.get(idea.id);
        return { idea, run, verdict: run ? verdictByRun.get(run.id) : undefined };
      });
    },
    refetchOnWindowFocus: true,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold">My ideas</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every idea you have tested, with its latest run.
          </p>
        </div>
        <Button asChild>
          <Link to="/new-idea">
            <Plus aria-hidden="true" />
            New idea
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="space-y-3" role="status" aria-label="Loading your ideas">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : data && data.length > 0 ? (
          <ul className="divide-y divide-border border-y border-border">
            {data.map(({ idea, run, verdict }) => (
              <li key={idea.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-medium">
                    {idea.summary || idea.idea_text.slice(0, 100)}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isBusinessModel(idea.business_model)
                      ? MODEL_LABELS[idea.business_model]
                      : "Not classified"}{" "}
                    · {idea.country} · {new Date(idea.created_at).toLocaleDateString("en-GB")}
                    {run ? ` · ${run.mode === "full" ? "Full" : "Quick"} run` : ""}
                  </p>
                </div>
                <IdeaStatus run={run} verdict={verdict} />
                <div className="flex gap-2">
                  {run?.status === "running" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/runs/$runId" params={{ runId: run.id }}>
                        View progress
                      </Link>
                    </Button>
                  ) : null}
                  {run?.status === "completed" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/reports/$runId" params={{ runId: run.id }}>
                        Open report
                      </Link>
                    </Button>
                  ) : null}
                  {run?.status !== "running" ? (
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/new-idea" search={{ ideaId: idea.id }}>
                        {run ? "Run again" : "Continue"}
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="border-y border-border py-14 text-center">
            <h2 className="font-display text-2xl font-semibold">No ideas yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Describe a startup idea and IdeaTest will run it through the board, the buyer panel
              and your own numbers. Your first Quick run is free.
            </p>
            <Button asChild className="mt-6">
              <Link to="/new-idea">Test your first idea</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
