import { NextRequest } from "next/server";
import { anthropic, MODEL, SYSTEM_PROMPT } from "@/lib/anthropic";
import { listToolsForAnthropic } from "@/lib/mcp-client";
import { costOf } from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lightweight pre-flight check: how big would my next prompt be, and roughly
// what will it cost on the configured model? Wraps Anthropic's
// /v1/messages/count_tokens endpoint.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { text: string; history?: Array<{ role: string; content: string }> };
  try {
    const tools = await listToolsForAnthropic();
    const messages = [...(body.history ?? []), { role: "user" as const, content: body.text }];
    const res = await anthropic.messages.countTokens({
      model: MODEL,
      system: SYSTEM_PROMPT,
      tools: tools as never,
      messages: messages as never,
    });
    const inputTokens = (res as { input_tokens?: number }).input_tokens ?? 0;
    // Assume modest output (1k tokens) for cost estimate
    const estimated = costOf(MODEL, {
      input_tokens: inputTokens,
      output_tokens: 1000,
    });
    return Response.json({ model: MODEL, input_tokens: inputTokens, estimated_max_cost_usd: estimated });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
