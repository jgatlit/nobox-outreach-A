import * as React from "react";
import { Header } from "@/components/Header";
import { StatsCards } from "@/components/Dashboard/StatsCards";
import { WorkflowStatus } from "@/components/Dashboard/WorkflowStatus";
import { SystemOverview } from "@/components/Dashboard/SystemOverview";
import { LeadTable } from "@/components/LeadManagement/LeadTable";
import { ImportLeadModal } from "@/components/LeadManagement/ImportLeadModal";
import { useQuery } from "@tanstack/react-query";

export default function Dashboard() {
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    staleTime: 60000, // 1 minute
  });

  return (
    <main className="p-6 overflow-auto h-[calc(100vh-64px)]">
      {/* Dashboard Overview */}
      <StatsCards
        totalLeads={stats?.totalLeads || 0}
        activeCampaigns={stats?.activeCampaignCount || 0}
        responseRate={stats?.responseRate || 0}
        opportunities={stats?.opportunityCount || 0}
        isLoading={isLoadingStats}
      />

      {/* Main dashboard content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WorkflowStatus />
        <SystemOverview />
      </div>

      {/* Lead Management Section */}
      <div className="mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Lead Management</h2>
          <div className="flex space-x-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search leads..."
                className="pl-10 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <svg
                className="w-5 h-5 text-neutral-400 absolute left-3 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </div>
            <div>
              <ImportLeadModal />
            </div>
          </div>
        </div>

        <LeadTable />
      </div>
    </main>
  );
}
