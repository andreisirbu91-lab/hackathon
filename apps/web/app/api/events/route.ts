import { NextRequest } from "next/server";
import { subscriber, CHANNEL } from "@/lib/event-bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return new Response("missing sessionId", { status: 400 });

  const sub = subscriber();
  const channel = `${CHANNEL}:${sessionId}`;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const onMessage = (_chan: string, message: string) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`));
      };
      sub.subscribe(channel).catch((e) => {
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: String(e) })}\n\n`));
      });
      sub.on("message", onMessage);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      const close = () => {
        clearInterval(heartbeat);
        sub.off("message", onMessage);
        sub.unsubscribe(channel).catch(() => {});
        sub.quit().catch(() => {});
      };
      req.signal.addEventListener("abort", () => {
        close();
        controller.close();
      });
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
