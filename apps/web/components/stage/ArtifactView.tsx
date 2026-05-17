"use client";
import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell,
} from "recharts";
import { Artifact, type ArtifactT } from "@/lib/artifact-schema";
import type { ArtifactItem } from "@/lib/stage-store";

const COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"];

export function ArtifactView({ artifacts }: { artifacts: ArtifactItem[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [artifacts]);

  if (artifacts.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        No artifacts yet. Ask the agent to <span className="text-text font-mono mx-1">render_artifact</span>.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {artifacts.map((a) => {
        const parsed = Artifact.safeParse({ type: a.type, props: a.props });
        if (!parsed.success) {
          return (
            <div key={a.id} className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              Invalid artifact type=&quot;{a.type}&quot;: {parsed.error.message}
            </div>
          );
        }
        return <ArtifactCard key={a.id} artifact={parsed.data} />;
      })}
      <div ref={endRef} />
    </div>
  );
}

function ArtifactCard({ artifact }: { artifact: ArtifactT }) {
  return (
    <div className="rounded-lg border border-border bg-panel p-4">
      <ArtifactBody artifact={artifact} />
    </div>
  );
}

function ArtifactBody({ artifact }: { artifact: ArtifactT }) {
  if (artifact.type === "chart") {
    const { chartType, title, xKey, yKeys, data } = artifact.props;
    return (
      <>
        {title && <h3 className="text-sm font-medium text-text mb-3">{title}</h3>}
        <div className="h-72">
          <ResponsiveContainer>
            {chartType === "line" ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 18%)" />
                <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 18%)" }} />
                <Legend />
                {yKeys.map((k, i) => (
                  <Line key={k} type="monotone" dataKey={k} stroke={COLORS[i % COLORS.length]} />
                ))}
              </LineChart>
            ) : chartType === "bar" ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 18%)" />
                <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 18%)" }} />
                <Legend />
                {yKeys.map((k, i) => (
                  <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} />
                ))}
              </BarChart>
            ) : chartType === "area" ? (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 18%)" />
                <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 18%)" }} />
                <Legend />
                {yKeys.map((k, i) => (
                  <Area key={k} type="monotone" dataKey={k} fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} fillOpacity={0.3} />
                ))}
              </AreaChart>
            ) : (
              <PieChart>
                <Pie data={data} dataKey={yKeys[0]} nameKey={xKey} outerRadius={100} label>
                  {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(0 0% 8%)", border: "1px solid hsl(0 0% 18%)" }} />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>
        </div>
      </>
    );
  }

  if (artifact.type === "table") {
    const { title, columns, rows } = artifact.props;
    return (
      <>
        {title && <h3 className="text-sm font-medium text-text mb-3">{title}</h3>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted border-b border-border">
                {columns.map((c) => <th key={c.key} className="py-2 px-3 font-medium">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-border/50 hover:bg-bg/40">
                  {columns.map((c) => <td key={c.key} className="py-2 px-3 text-text">{String(row[c.key] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (artifact.type === "kanban") {
    const { title, columns } = artifact.props;
    return (
      <>
        {title && <h3 className="text-sm font-medium text-text mb-3">{title}</h3>}
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((col) => (
            <div key={col.id} className="bg-bg rounded-md p-2 min-h-[200px]">
              <div className="text-xs font-medium text-muted mb-2 uppercase tracking-wider">{col.title}</div>
              <div className="space-y-2">
                {col.cards.map((card) => (
                  <div key={card.id} className="bg-panel border border-border rounded p-2 text-xs">
                    <div className="font-medium text-text">{card.title}</div>
                    {card.body && <div className="text-muted mt-1">{card.body}</div>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (artifact.type === "map") {
    const { title, center, zoom, markers } = artifact.props;
    const markerPins = markers.map((m) => `pin-s+0ea5e9(${m.lng},${m.lat})`).join(",");
    const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${center[0]},${center[1]}&zoom=${zoom}&size=600x400&markers=${markers.map((m) => `${m.lat},${m.lng},red-pushpin`).join("|")}`;
    return (
      <>
        {title && <h3 className="text-sm font-medium text-text mb-3">{title}</h3>}
        <img src={url} alt="map" className="w-full rounded-md border border-border" />
        <div className="mt-2 text-xs text-muted">
          {markers.map((m, i) => <div key={i}>{m.label}: {m.lat.toFixed(4)}, {m.lng.toFixed(4)}</div>)}
        </div>
      </>
    );
  }

  if (artifact.type === "markdown") {
    const { title, content } = artifact.props;
    return (
      <>
        {title && <h3 className="text-sm font-medium text-text mb-3">{title}</h3>}
        <div className="prose-chat text-text">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      </>
    );
  }

  if (artifact.type === "iframe") {
    const { title, src, height } = artifact.props;
    return (
      <>
        {title && <h3 className="text-sm font-medium text-text mb-3">{title}</h3>}
        <iframe src={src} style={{ height }} className="w-full rounded border border-border" />
      </>
    );
  }

  return null;
}
