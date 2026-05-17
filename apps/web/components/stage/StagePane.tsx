"use client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Globe, LayoutDashboard, Code2, ListChecks } from "lucide-react";
import { BrowserView } from "./BrowserView";
import { ArtifactView } from "./ArtifactView";
import { CodeView } from "./CodeView";
import { PlanView } from "./PlanView";
import type { StageState, TabKey } from "@/lib/stage-store";

export function StagePane({
  state,
  onTabChange,
}: {
  state: StageState;
  onTabChange: (tab: TabKey) => void;
}) {
  return (
    <div className="flex flex-col h-full w-full min-h-0 bg-bg">
      <Tabs
        value={state.activeTab}
        onValueChange={(v) => onTabChange(v as TabKey)}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="shrink-0 px-3 py-2 border-b border-border overflow-x-auto">
          <TabsList>
            <TabsTrigger value="browser"><Globe className="w-3.5 h-3.5 mr-1.5" />Browser</TabsTrigger>
            <TabsTrigger value="artifact">
              <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />Artifact
              {state.artifacts.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-accent/30 text-accent px-1 rounded">{state.artifacts.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="code"><Code2 className="w-3.5 h-3.5 mr-1.5" />Code</TabsTrigger>
            <TabsTrigger value="timeline">
              <ListChecks className="w-3.5 h-3.5 mr-1.5" />Plan
              {state.toolCalls.length > 0 && (
                <span className="ml-1.5 text-[10px] bg-border text-muted px-1 rounded">{state.toolCalls.length}</span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="browser" className="flex-1 min-h-0 m-0"><BrowserView activeUrl={state.activeBrowserUrl} /></TabsContent>
        <TabsContent value="artifact" className="flex-1 min-h-0 m-0"><ArtifactView artifacts={state.artifacts} /></TabsContent>
        <TabsContent value="code" className="flex-1 min-h-0 m-0"><CodeView toolCalls={state.toolCalls} /></TabsContent>
        <TabsContent value="timeline" className="flex-1 min-h-0 m-0"><PlanView toolCalls={state.toolCalls} /></TabsContent>
      </Tabs>
    </div>
  );
}
