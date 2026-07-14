import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { PipelineFunnel } from "@/components/PipelineFunnel";

export const Route = createFileRoute("/_app/pipeline")({
  component: PipelinePage,
});

function PipelinePage() {
  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <PageHeader title="Pipeline" subtitle="Fresh, Renewal and Pipeline funnels." />
      <PipelineFunnel />
    </div>
  );
}
