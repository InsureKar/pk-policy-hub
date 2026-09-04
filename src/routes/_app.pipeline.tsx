import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PipelineFunnel } from "@/components/PipelineFunnel";
import { PipelineKanban } from "@/components/PipelineKanban";
import { Button } from "@/components/ui/button";
import { LayoutGrid, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/_app/pipeline")({
  component: PipelinePage,
});

function PipelinePage() {
  const [view, setView] = useState<"kanban" | "funnel">("kanban");
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader
        title="Pipeline"
        subtitle="Fresh, Renewal and Pipeline funnels."
        actions={
          <div className="flex gap-1 rounded-md border p-1">
            <Button
              variant={view === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("kanban")}
            >
              <LayoutGrid className="w-4 h-4 mr-1.5" /> Kanban
            </Button>
            <Button
              variant={view === "funnel" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("funnel")}
            >
              <BarChart3 className="w-4 h-4 mr-1.5" /> Funnel
            </Button>
          </div>
        }
      />
      {view === "kanban" ? <PipelineKanban /> : <PipelineFunnel />}
    </div>
  );
}
