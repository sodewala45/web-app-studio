import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Point the app's gateway provider at a local fake that streams whatever reply a test queues up.
let port = 0;
vi.mock("../lib/ideatest/gateway.server", async () => {
  const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
  return {
    createLovableAiGatewayProvider: () =>
      createOpenAICompatible({ name: "fake", baseURL: `http://127.0.0.1:${port}/v1` }),
  };
});

import { classifyIdea } from "../lib/ideatest/pipeline.server";

const GOOD = {
  business_model: "local_business",
  confidence: 0.9,
  summary: "A cloud kitchen selling weekly lunch boxes to office workers.",
  followup_questions: [
    "Who is the buyer?",
    "What is the delivery radius?",
    "What does a box cost to make?",
  ],
};

type Reply = { text: string; finish?: string };
let queue: Reply[] = [];
let bodies: Array<Record<string, unknown>> = [];
let server: http.Server;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      bodies.push(JSON.parse(raw) as Record<string, unknown>);
      const reply = queue.shift() ?? { text: "" };
      res.writeHead(200, { "content-type": "text/event-stream" });
      const chunk = (delta: object, finish: string | null) =>
        `data: ${JSON.stringify({ id: "x", object: "chat.completion.chunk", created: 1, model: "m", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;
      res.write(chunk({ role: "assistant", content: "" }, null));
      if (reply.text) res.write(chunk({ content: reply.text }, null));
      res.write(chunk({}, reply.finish ?? "stop"));
      res.end("data: [DONE]\n\n");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});
afterAll(() => server.close());
beforeEach(() => {
  queue = [];
  bodies = [];
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

const input = { idea: "A cloud kitchen in Karachi", country: "Pakistan", currency: "PKR" };
const json = JSON.stringify(GOOD);

describe("AI reply handling", () => {
  it("accepts a plain JSON reply", async () => {
    queue = [{ text: json }];
    expect((await classifyIdea(input, "key")).business_model).toBe("local_business");
  });

  it("accepts JSON wrapped in a code block", async () => {
    queue = [{ text: "```json\n" + json + "\n```" }];
    expect((await classifyIdea(input, "key")).followup_questions).toHaveLength(3);
  });

  it("accepts JSON with a sentence around it", async () => {
    queue = [{ text: `Here is the classification:\n${json}\nHope that helps.` }];
    expect((await classifyIdea(input, "key")).business_model).toBe("local_business");
  });

  it("retries when the first reply uses the wrong field names", async () => {
    queue = [{ text: '{"businessModel":"local_business","questions":["a"]}' }, { text: json }];
    expect((await classifyIdea(input, "key")).business_model).toBe("local_business");
    expect(bodies).toHaveLength(2);
  });

  it("retries when the first reply is cut off", async () => {
    queue = [{ text: json.slice(0, 60), finish: "length" }, { text: json }];
    expect((await classifyIdea(input, "key")).business_model).toBe("local_business");
  });

  it("gives a clear message when every reply is unusable", async () => {
    queue = [{ text: "no" }, { text: "no" }, { text: "no" }];
    await expect(classifyIdea(input, "key")).rejects.toThrow(/not in the expected format/);
  });

  it("tells the model the exact field names and allows enough output tokens", async () => {
    queue = [{ text: json }];
    await classifyIdea(input, "key");
    const prompt = JSON.stringify(bodies[0]?.["messages"]);
    for (const field of ["business_model", "confidence", "summary", "followup_questions"]) {
      expect(prompt).toContain(field);
    }
    expect(
      Number(bodies[0]?.["max_tokens"] ?? bodies[0]?.["max_completion_tokens"]),
    ).toBeGreaterThanOrEqual(3000);
  });
});
