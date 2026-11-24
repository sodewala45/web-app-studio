import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

const RUN_ID = "7f1b7b1e-3a0d-4a9a-9d6a-0f2a2a4f9c11";

describe("IdeaTest routes", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it.each([
    ["/", "/"],
    ["/auth", "/auth"],
    ["/dashboard", "/_app/dashboard"],
    ["/new-idea", "/_app/new-idea"],
    ["/admin", "/_app/admin"],
    [`/runs/${RUN_ID}`, "/_app/runs/$runId"],
    [`/reports/${RUN_ID}`, "/_app/reports/$runId"],
  ])("matches %s to a real page", (path, routeId) => {
    const last = router.matchRoutes(path).at(-1);
    expect(last?.routeId).not.toBe(rootRouteId);
    expect(last?.routeId).toBe(routeId);
  });

  it("keeps an unknown path as not found", () => {
    expect(router.matchRoutes("/does-not-exist").at(-1)?.routeId).toBe(rootRouteId);
  });
});
