import { z } from "zod";
import { randomUUID } from "crypto";
import { publishStage } from "../publish.js";

export const renderArtifactSchema = {
  sessionId: z.string().describe("Caller session id"),
  type: z.enum(["chart", "table", "kanban", "map", "markdown", "iframe"])
    .describe("Artifact type"),
  props: z.record(z.unknown()).describe(
    "Props for the artifact. See schemas: " +
    "chart={chartType:line|bar|area|pie,title?,xKey,yKeys:string[],data:object[]}, " +
    "table={title?,columns:[{key,label}],rows:object[]}, " +
    "kanban={title?,columns:[{id,title,cards:[{id,title,body?}]}]}, " +
    "map={title?,center:[lat,lng],zoom?,markers:[{lat,lng,label}]}, " +
    "markdown={title?,content}, " +
    "iframe={title?,src,height?}"
  ),
};

export async function renderArtifact(args: { sessionId: string; type: string; props: Record<string, unknown> }) {
  const id = randomUUID();
  await publishStage(args.sessionId, {
    kind: "artifact",
    id,
    type: args.type,
    props: args.props,
    at: Date.now(),
  });
  return { ok: true, artifactId: id };
}
