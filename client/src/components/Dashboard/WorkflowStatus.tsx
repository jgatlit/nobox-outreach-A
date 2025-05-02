import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface WorkflowItemProps {
  name: string;
  status: string;
  progress: number;
  lastRun?: string;
  processed?: string;
  scheduledFor?: string;
  queuePosition?: number;
}

function WorkflowItem({
  name,
  status,
  progress,
  lastRun,
  processed,
  scheduledFor,
  queuePosition,
}: WorkflowItemProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "in progress":
        return "bg-amber-100 text-amber-800";
      case "queued":
        return "bg-neutral-100 text-neutral-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-neutral-100 text-neutral-800";
    }
  };

  const getProgressColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-500";
      case "in progress":
        return "bg-amber-500";
      case "queued":
        return "bg-neutral-300";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-neutral-300";
    }
  };

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium">{name}</h3>
        <Badge variant="outline" className={getStatusColor(status)}>
          {status}
        </Badge>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={`h-full ${getProgressColor(status)} rounded-full`}
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="mt-2 text-sm text-neutral-500 flex justify-between">
        <span>
          {lastRun
            ? `Last run: ${formatRelativeTime(lastRun)}`
            : scheduledFor
            ? `Scheduled for: ${scheduledFor}`
            : "Not scheduled"}
        </span>
        <span>
          {processed ? `Processed: ${processed}` : queuePosition ? `Queue position: ${queuePosition}` : ""}
        </span>
      </div>
    </div>
  );
}

export function WorkflowStatus() {
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['/api/workflows'],
    staleTime: 60000, // 1 minute
  });

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
        <CardTitle className="text-lg font-semibold">n8n Workflow Status</CardTitle>
        <Link href="/workflows">
          <Button variant="link" className="text-primary-600 hover:text-primary-800 text-sm font-medium px-0">
            View All Workflows
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-6">
        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-5 w-32 bg-neutral-200 animate-pulse rounded"></div>
                  <div className="h-5 w-20 bg-neutral-200 animate-pulse rounded"></div>
                </div>
                <div className="h-2 bg-neutral-200 animate-pulse rounded-full"></div>
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-neutral-200 animate-pulse rounded"></div>
                  <div className="h-4 w-24 bg-neutral-200 animate-pulse rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : workflows?.length > 0 ? (
          workflows.map((workflow) => (
            <WorkflowItem
              key={workflow.id}
              name={workflow.name}
              status={workflow.status}
              progress={workflow.totalCount > 0 ? (workflow.processedCount / workflow.totalCount) * 100 : 0}
              lastRun={workflow.lastRun}
              processed={
                workflow.status !== "queued"
                  ? workflow.totalCount > 0
                    ? `${workflow.processedCount}/${workflow.totalCount} leads`
                    : `${workflow.processedCount} leads`
                  : undefined
              }
              scheduledFor={workflow.status === "queued" ? workflow.nextScheduledRun : undefined}
              queuePosition={workflow.status === "queued" ? 1 : undefined}
            />
          ))
        ) : (
          <div className="text-center py-4 text-neutral-500">No workflows found</div>
        )}
      </CardContent>
    </Card>
  );
}
