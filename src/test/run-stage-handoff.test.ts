import { beforeEach, describe, expect, it, vi } from "vitest";

// A tiny fake of the database client. Row-level security is modelled the way the real database
// behaves for a signed-in user: reading `runs` works, but an update changes zero rows and raises no error.
type Row = Record<string, unknown>;
type Fake = ReturnType<typeof makeClient>;

const state = vi.hoisted(() => ({
  run: {} as Record<string, unknown>,
  answers: [] as Array<Record<string, unknown>>,
  idea: {} as Record<string, unknown>,
  adminUpdatesApply: true,
  failed: [] as string[],
}));

function makeClient(kind: "user" | "admin") {
  const from = (table: string) => {
    let op: "select" | "update" = "select";
    let values: Row = {};
    const rows = () => {
      if (table === "runs") return [state.run];
      if (table === "panel_answers") return state.answers;
      if (table === "ideas") return [state.idea];
      return [];
    };
    const result = () => {
      if (op === "update" && table === "runs") {
        const allowed = kind === "admin" && state.adminUpdatesApply;
        if (allowed) Object.assign(state.run, values);
        return { data: allowed ? [{ id: state.run["id"] }] : [], error: null };
      }
      return { data: rows(), error: null };
    };
    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      update: (v: Row) => {
        op = "update";
        values = v;
        return builder;
      },
      maybeSingle: () => Promise.resolve({ data: rows()[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject),
    };
    return builder;
  };
  return {
    from,
    rpc: (name: string, args: Row) => {
      if (name === "fail_run_and_refund") state.failed.push(String(args["_message"]));
      return Promise.resolve({ data: null, error: null });
    },
  };
}

vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: makeClient("admin") }));

import { advanceRun } from "../lib/ideatest/pipeline.server";

const RUN_ID = "7f1b7b1e-3a0d-4a9a-9d6a-0f2a2a4f9c11";

beforeEach(() => {
  state.failed = [];
  state.adminUpdatesApply = true;
  state.run = {
    id: RUN_ID,
    idea_id: "idea-1",
    user_id: "user-1",
    status: "running",
    stage: "panel",
    stage_progress: 20,
    mode: "quick",
    buyer_target: 20,
    buyers_completed: 20,
    error_message: null,
    credits_refunded: false,
  };
  state.idea = {
    id: "idea-1",
    business_model: "local_business",
    cfo_inputs: {},
    followup_answers: [],
  };
  state.answers = Array.from({ length: 20 }, (_, index) => ({
    persona_index: index,
    status: "completed",
    persona: {},
  }));
});

describe("run stage hand-offs", () => {
  it("saves the move from panel to pricing so the run really advances", async () => {
    const user = makeClient("user") as Fake;
    const next = await advanceRun(user as never, RUN_ID, "key");
    expect(next.stage).toBe("pricing");
    // The saved row, not just the reply, must have moved on; otherwise the page loops forever.
    expect(state.run["stage"]).toBe("pricing");
  });

  it("saves the move from board to panel when the board results already exist", async () => {
    state.run["stage"] = "board";
    // Three stored board results mean the board stage is done.
    const user = makeClient("user") as Fake;
    const original = user.from;
    user.from = ((table: string) => {
      if (table === "board_results") {
        const b: Record<string, unknown> = {
          select: () => b,
          eq: () => b,
          then: (r: (v: unknown) => unknown) =>
            Promise.resolve({ data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null }).then(r),
        };
        return b;
      }
      return original(table);
    }) as typeof user.from;
    const next = await advanceRun(user as never, RUN_ID, "key");
    expect(next.stage).toBe("panel");
    expect(state.run["stage"]).toBe("panel");
  });

  it("fails loudly, instead of looping, when a stage save changes no rows", async () => {
    state.adminUpdatesApply = false;
    const user = makeClient("user") as Fake;
    await expect(advanceRun(user as never, RUN_ID, "key")).rejects.toThrow(
      /Run progress could not be saved/,
    );
    expect(state.failed.join(" ")).toMatch(/Run progress could not be saved/);
  });
});
