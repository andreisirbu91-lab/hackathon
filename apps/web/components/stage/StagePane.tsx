"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Globe, LayoutDashboard, Code2, ListChecks } from "lucide-react";
import { BrowserView } from "./BrowserView";
import { ArtifactView } from "./ArtifactView";
import { CodeView } from "./CodeView";
import { Timeline } from "./Timeline";
import type { StageState } from "@/lib/stage-store";

export function StagePane({
  state,
  onTabChange,
}: {
  state: StageState;
  onTabChange: (tab: StageState["activeTab"]) => void;
}) {
  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="border-b border-border px-3 py-2.5 flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <h2 className="text-sm font-medium text-text">Agent stage</h2>
      </div>
      <Tabs
        value={state.activeTab}
        onValueChange={(v) => onTabChange(v as StageState["activeTab"])}
        className="flex-1 flex flex-col"
      >
        <div className="px-3 py-2 border-b border-border">
          <TabsList>
            <TabsTrigger value="browser"><Globe className="w-3.5 h-3.5 mr-1.5" />Browser</TabsTrigger>
            <TabsTrigger value="artifact"><LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />Artifact</TabsTrigger>
            <TabsTrigger value="code"><Code2 className="w-3.5 h-3.5 mr-1.5" />Code</TabsTrigger>
            <TabsTrigger value="timeline">
              <ListChecks className="w-3.5 h-3.5 mr-1.5" />Timeline
              {state.toolCalls.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-border text-muted px-1 rounded">{state.toolCalls.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="browser" className="flex-1 m-0"><BrowserView activeUrl={state.activeBrowserUrl} /></TabsContent>
        <TabsContent value="artifact" className="flex-1 m-0"><ArtifactView artifacts={state.artifacts} /></TabsContent>
        <TabsContent value="code" className="flex-1 m-0"><CodeView toolCalls={state.toolCalls} /></TabsContent>
        <TabsContent value="timeline" className="flex-1 m-0"><Timeline toolCalls={state.toolCalls} /></TabsContent>
      </Tabs>
    </div>
  );
}
