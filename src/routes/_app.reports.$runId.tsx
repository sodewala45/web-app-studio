import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";

import { ReportView, type ReportViewData } from "@/components/ideatest/report-view";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Economics } from "@/lib/ideatest/domain";

export const Route = createFileRoute("/_app/reports/$runId")({
  head: () => ({ meta: [{ title: "Report — IdeaTest" }] }),
  component: ReportPage,
});

type LoadedReport = { kind: "ready"; data: ReportViewData } | { kind: "not-ready" };

function ReportPage() {
  const { runId } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["ideatest-report", runId],
    queryFn: async (): Promise<LoadedReport> => {
      const { data: run, error: runError } = await supabase
        .from("runs")
        .select("*")
        .eq("id", runId)
        .maybeSingle();
      if (runError || !run) throw new Error("This report could not be found.");
      const [report, idea, board, answers, pricing, cfo] = await Promise.all([
        supabase.from("reports").select("*").eq("run_id", runId).maybeSingle(),
        supabase.from("ideas").select("*").eq("id", run.idea_id).maybeSingle(),
        supabase.from("board_results").select("*").eq("run_id", runId).order("created_at"),
        supabase.from("panel_answers").select("*").eq("run_id", runId).order("persona_index"),
        supabase.from("pricing_results").select("*").eq("run_id", runId).maybeSingle(),
        supabase.from("cfo_results").select("outputs").eq("run_id", runId).maybeSingle(),
      ]);
      if (
        report.error ||
        idea.error ||
        board.error ||
        answers.error ||
        pricing.error ||
        cfo.error
      ) {
        throw new Error("The report could not be loaded. Please refresh.");
      }
      if (!report.data || !idea.data) return { kind: "not-ready" };
      return {
        kind: "ready",
        data: {
          report: report.data,
          idea: idea.data,
          run,
          board: board.data ?? [],
          answers: answers.data ?? [],
          pricing: pricing.data,
          economics: cfo.data ? (cfo.data.outputs as unknown as Economics) : null,
        },
      };
    },
  });

  if (isLoading) {
    return (
      <div
        className="mx-auto max-w-7xl space-y-4 px-4 py-10 sm:px-6 lg:px-8"
        role="status"
        aria-label="Loading report"
      >
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/dashboard">Back to my ideas</Link>
        </Button>
      </div>
    );
  }

  if (!data || data.kind === "not-ready") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="font-display text-2xl font-semibold">This report is not ready yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The run is still going, or it did not finish.
        </p>
        <Button asChild className="mt-6">
          <Link to="/runs/$runId" params={{ runId }}>
            View the run
          </Link>
        </Button>
      </div>
    );
  }

  return <ReportView data={data.data} />;
}
