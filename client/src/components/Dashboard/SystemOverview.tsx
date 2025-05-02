import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { formatRelativeTime } from "@/lib/utils";

interface IntegrationStatusProps {
  name: string;
  status: string;
}

function IntegrationStatus({ name, status }: IntegrationStatusProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-500";
      case "warning":
        return "bg-amber-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-neutral-300";
    }
  };

  return (
    <li className="flex items-center">
      <div className={`w-3 h-3 rounded-full ${getStatusColor(status)} mr-2`}></div>
      <span className="text-sm">{name}</span>
    </li>
  );
}

interface ActivityItemProps {
  title: string;
  timestamp: string;
}

function ActivityItem({ title, timestamp }: ActivityItemProps) {
  return (
    <div className="text-sm">
      <p className="font-medium">{title}</p>
      <p className="text-neutral-500">{formatRelativeTime(timestamp)}</p>
    </div>
  );
}

export function SystemOverview() {
  const { data: integrations, isLoading: isLoadingIntegrations } = useQuery({
    queryKey: ['/api/integrations'],
    staleTime: 60000, // 1 minute
  });

  // This would be a real API call in a production app
  const recentActivity = [
    { id: 1, title: "Data Enrichment Complete", timestamp: new Date(Date.now() - 42 * 60 * 1000) },
    { id: 2, title: "New Lead Import (LinkedIn)", timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    { id: 3, title: "Email Drafts Generated", timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000) },
  ];

  return (
    <Card>
      <CardHeader className="px-6 py-4 border-b border-neutral-200">
        <CardTitle className="text-lg font-semibold">System Overview</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <div className="mb-6">
          <h3 className="font-medium mb-3">Database Status</h3>
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
            <span className="text-sm">Supabase Connected</span>
          </div>
          <div className="text-sm text-neutral-500 flex justify-between">
            <span>Leads Table: 2,456 records</span>
            <span>Last sync: 5 min ago</span>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="font-medium mb-3">Integrations</h3>
          {isLoadingIntegrations ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-neutral-300 mr-2"></div>
                  <div className="h-4 w-24 bg-neutral-200 animate-pulse rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <ul className="space-y-2">
              {integrations?.map((integration) => (
                <IntegrationStatus
                  key={integration.id}
                  name={integration.name}
                  status={integration.status}
                />
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-medium mb-3">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <ActivityItem
                key={activity.id}
                title={activity.title}
                timestamp={activity.timestamp.toString()}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
