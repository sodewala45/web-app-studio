import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { IdeaWizard } from "@/components/ideatest/idea-wizard";

export const Route = createFileRoute("/_app/new-idea")({
  head: () => ({ meta: [{ title: "New idea — IdeaTest" }] }),
  validateSearch: (search: Record<string, unknown>): { ideaId?: string } => {
    const parsed = z.string().uuid().safeParse(search["ideaId"]);
    return parsed.success ? { ideaId: parsed.data } : {};
  },
  component: NewIdeaPage,
});

function NewIdeaPage() {
  const { ideaId } = Route.useSearch();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <IdeaWizard key={ideaId ?? "new"} ideaId={ideaId} />
    </div>
  );
}
