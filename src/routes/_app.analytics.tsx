import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { PipelineFunnel } from "@/components/PipelineFunnel";

export const Route = createFileRoute("/_app/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <PageHeader title="Analytics" subtitle="Monthly pipeline funnel with date range and user filter." />
      <PipelineFunnel />
    </div>
  );
}
