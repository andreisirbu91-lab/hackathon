import { z } from "zod";

export const ChartArtifact = z.object({
  type: z.literal("chart"),
  props: z.object({
    chartType: z.enum(["line", "bar", "area", "pie"]),
    title: z.string().optional(),
    xKey: z.string(),
    yKeys: z.array(z.string()).min(1),
    data: z.array(z.record(z.union([z.string(), z.number()]))),
  }),
});

export const TableArtifact = z.object({
  type: z.literal("table"),
  props: z.object({
    title: z.string().optional(),
    columns: z.array(z.object({ key: z.string(), label: z.string() })),
    rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
  }),
});

export const KanbanArtifact = z.object({
  type: z.literal("kanban"),
  props: z.object({
    title: z.string().optional(),
    columns: z.array(z.object({
      id: z.string(),
      title: z.string(),
      cards: z.array(z.object({ id: z.string(), title: z.string(), body: z.string().optional() })),
    })),
  }),
});

export const MapArtifact = z.object({
  type: z.literal("map"),
  props: z.object({
    title: z.string().optional(),
    center: z.tuple([z.number(), z.number()]),
    zoom: z.number().default(13),
    markers: z.array(z.object({
      lat: z.number(),
      lng: z.number(),
      label: z.string(),
    })),
  }),
});

export const MarkdownArtifact = z.object({
  type: z.literal("markdown"),
  props: z.object({
    title: z.string().optional(),
    content: z.string(),
  }),
});

export const IframeArtifact = z.object({
  type: z.literal("iframe"),
  props: z.object({
    title: z.string().optional(),
    src: z.string().url(),
    height: z.number().default(600),
  }),
});

export const Artifact = z.discriminatedUnion("type", [
  ChartArtifact,
  TableArtifact,
  KanbanArtifact,
  MapArtifact,
  MarkdownArtifact,
  IframeArtifact,
]);

export type ArtifactT = z.infer<typeof Artifact>;
