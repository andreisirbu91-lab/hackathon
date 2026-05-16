import { NextRequest } from "next/server";
import { runAgent, type ChatMessage } from "@/lib/agent-loop";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { sessionId?: string; messages: ChatMessage[] };
  const sessionId = body.sessionId ?? randomUUID();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      send({ kind: "session", sessionId });
      try {
        for await (const event of runAgent(sessionId, body.messages)) {
          send(event);
          if (event.kind === "done" || event.kind === "error") break;
        }
      } catch (err) {
        send({ kind: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    },
  });
}
