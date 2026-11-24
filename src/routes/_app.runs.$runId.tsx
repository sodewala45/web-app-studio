import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, CircleX, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { messageOf } from "@/lib/ideatest/errors";
import { advanceIdeaRunFn } from "@/lib/ideatest/pipeline.functions";

export const Route = createFileRoute("/_app/runs/$runId")({
  head: () => ({ meta: [{ title: "Run in progress — IdeaTest" }] }),
  component: RunProgress,
});

type RunRow = Tables<"runs">;

const STAGES = ["board", "panel", "pricing", "cfo", "report"] as const;
const STAGE_INDEX: Record<string, number> = {
  board: 0,
  panel: 1,
  pricing: 2,
  cfo: 3,
  report: 4,
  completed: 5,
};
const MAX_STEPS = 400;

function stageLabel(stage: (typeof STAGES)[number], run: RunRow) {
  switch (stage) {
    case "board":
      return {
        title: "Board review",
        detail: "Three lenses score the idea and name what could kill it.",
      };
    case "panel":
      return {
        title: "Buyer panel",
        detail: `${run.buyers_completed} of ${run.buyer_target} simulated buyers have answered.`,
      };
    case "pricing":
      return {
        title: "Price analysis",
        detail: "Working out the acceptable price range from the buyers' answers.",
      };
    case "cfo":
      return {
        title: "Unit economics",
        detail: "Calculating margins, break-even and cash needed from your numbers.",
      };
    case "report":
      return { title: "Report", detail: "Computing the verdict and writing the summary." };
  }
}

function RunProgress() {
  const { runId } = Route.useParams();
  const navigate = useNavigate();
  const [run, setRun] = useState<RunRow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const driving = useRef(false);
  const stopped = useRef(false);

  const loadRun = useCallback(async () => {
    const { data, error } = await supabase.from("runs").select("*").eq("id", runId).maybeSingle();
    if (error || !data) {
      setLoadError("This run could not be found.");
      return null;
    }
    setRun(data);
    return data;
  }, [runId]);

  useEffect(() => {
    void loadRun();
  }, [loadRun]);

  // Live updates from the database, so a run opened on a second device stays current.
  useEffect(() => {
    const channel = supabase
      .channel(`run-${runId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "runs", filter: `id=eq.${runId}` },
        (payload) => setRun(payload.new as RunRow),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [runId]);

  const drive = useCallback(async () => {
    if (driving.current) return;
    driving.current = true;
    setStepError(null);
    try {
      for (let index = 0; index < MAX_STEPS && !stopped.current; index += 1) {
        const next = await advanceIdeaRunFn({ data: { runId } });
        setRun((current) =>
          current
            ? {
                ...current,
                status: next.status,
                stage: next.stage,
                stage_progress: next.stageProgress,
                buyers_completed: next.buyersCompleted,
                error_message: next.errorMessage,
              }
            : current,
        );
        if (next.status !== "running") break;
      }
    } catch (caught) {
      setStepError(messageOf(caught, "The analysis could not continue."));
      await loadRun();
    } finally {
      driving.current = false;
    }
  }, [runId, loadRun]);

  useEffect(() => {
    stopped.current = false;
    return () => {
      stopped.current = true;
    };
  }, []);

  const status = run?.status;
  useEffect(() => {
    if (status === "running") void drive();
  }, [status, drive]);

  useEffect(() => {
    if (status === "completed")
      void navigate({ to: "/reports/$runId", params: { runId }, replace: true });
  }, [status, navigate, runId]);

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Alert variant="destructive" role="alert">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/dashboard">Back to my ideas</Link>
        </Button>
      </div>
    );
  }
  if (!run) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted-foreground" role="status">
        Loading run…
      </p>
    );
  }

  const currentIndex = STAGE_INDEX[run.stage] ?? 0;
  const failed = run.status === "failed";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">
        {failed
          ? "This run did not finish"
          : run.status === "completed"
            ? "Your report is ready"
            : "Testing your idea"}
      </h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        {run.mode === "full"
          ? "Full run · 100 simulated buyers"
          : "Quick run · 20 simulated buyers"}
      </p>

      {failed ? (
        <Alert variant="destructive" className="mt-6" role="alert">
          <AlertDescription>
            {run.error_message ?? "The analysis could not be completed."}
            {run.credits_refunded ? " Your credits have been refunded." : ""}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="mt-6">
          <Progress value={run.stage_progress} aria-label="Overall progress" />
          <p className="mt-2 text-xs text-muted-foreground">{run.stage_progress}% complete</p>
        </div>
      )}

      <ol className="mt-8 divide-y divide-border border-y border-border">
        {STAGES.map((stage, index) => {
          const done = run.status === "completed" || index < currentIndex;
          const active = !failed && !done && index === currentIndex;
          const broke = failed && index === currentIndex;
          const text = stageLabel(stage, run);
          return (
            <li
              key={stage}
              className="flex items-start gap-3 py-4"
              aria-current={active ? "step" : undefined}
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
                {done ? (
                  <Check className="size-4 text-primary" aria-label="Done" />
                ) : active ? (
                  <Loader2 className="size-4 animate-spin text-primary" aria-label="In progress" />
                ) : broke ? (
                  <CircleX className="size-4 text-destructive" aria-label="Stopped" />
                ) : (
                  <span className="size-2 rounded-full bg-border" aria-label="Waiting" />
                )}
              </span>
              <div>
                <p className={done || active ? "font-medium" : "font-medium text-muted-foreground"}>
                  {text.title}
                </p>
                {active || (stage === "panel" && done) ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{text.detail}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {stepError && !failed ? (
        <Alert variant="destructive" className="mt-6" role="alert">
          <AlertDescription>
            {stepError}
            <Button className="mt-3 block" size="sm" variant="outline" onClick={() => void drive()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {!failed && run.status === "running" ? (
        <p className="mt-6 text-sm leading-6 text-muted-foreground">
          Keep this tab open. The analysis moves forward while this page is open; if you close it,
          open the run again from your dashboard and it carries on from where it stopped.
        </p>
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {failed ? (
          <Button asChild>
            <Link to="/new-idea" search={{ ideaId: run.idea_id }}>
              Try again
            </Link>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <Link to="/dashboard">Back to my ideas</Link>
        </Button>
      </div>
    </div>
  );
}
