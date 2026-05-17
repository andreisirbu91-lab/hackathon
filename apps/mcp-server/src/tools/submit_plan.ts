import { z } from "zod";
import { randomUUID } from "crypto";
import { publishStage } from "../publish.js";

export const submitPlanSchema = {
  sessionId: z.string().describe("Caller session id"),
  goal: z.string().describe("One-sentence statement of what the user is asking for"),
  steps: z.array(z.object({
    title: z.string().describe("Short imperative step name, e.g. 'Search Brave for X'"),
    description: z.string().optional().describe("One-line detail of what this step will do"),
    tools: z.array(z.string()).optional().describe("MCP tools this step will call, e.g. ['web_search']"),
  })).min(1).max(8).describe("Ordered list of 1-8 steps you intend to perform. Be concrete."),
};

export async function submitPlan(args: {
  sessionId: string;
  goal: string;
  steps: Array<{ title: string; description?: string; tools?: string[] }>;
}) {
  const planId = randomUUID();
  await publishStage(args.sessionId, {
    kind: "plan",
    id: planId,
    goal: args.goal,
    steps: args.steps.map((s, i) => ({ id: `${planId}-${i}`, ...s, status: "pending" })),
    at: Date.now(),
  });
  return {
    plan_id: planId,
    accepted: true,
    note: "Plan registered. The user can see it on the right pane. Now execute the steps using the appropriate tools. The plan view will show progress as you call those tools.",
  };
}
