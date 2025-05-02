import * as React from "react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getSourceBadgeColor, getStatusColor } from "@/lib/utils";

const LEAD_SEGMENTS = [
  { value: "active", label: "Active Leads" },
  { value: "inactive", label: "Inactive Leads" },
  { value: "instantly", label: "Instantly.ai" },
  { value: "cyberleads", label: "Cyberleads" },
  { value: "linkedin", label: "LinkedIn" },
];

export function LeadTable() {
  const [segment, setSegment] = React.useState("active");
  const [, navigate] = useLocation();

  const { data: leads, isLoading } = useQuery({
    queryKey: ['/api/leads', segment],
    queryFn: async ({ queryKey }) => {
      const [_, segment] = queryKey;
      const response = await fetch(`/api/leads?segment=${segment}`);
      if (!response.ok) {
        throw new Error("Failed to fetch leads");
      }
      return response.json();
    },
  });

  const columns = [
    {
      key: "select",
      header: "",
      render: () => (
        <div className="flex items-center">
          <input
            type="checkbox"
            className="h-4 w-4 text-primary-600 border-neutral-300 rounded"
          />
        </div>
      ),
    },
    {
      key: "name",
      header: "Name / Company",
      render: (lead) => (
        <div>
          <div className="text-sm font-medium text-neutral-900">
            {lead.firstName} {lead.lastName}
          </div>
          <div className="text-sm text-neutral-500">{lead.company}</div>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (lead) => (
        <div className="text-sm text-neutral-900">{lead.email}</div>
      ),
    },
    {
      key: "source",
      header: "Source",
      render: (lead) => {
        const { bg, text } = getSourceBadgeColor(lead.source);
        return (
          <Badge variant="outline" className={`${bg} ${text}`}>
            {lead.source}
          </Badge>
        );
      },
    },
    {
      key: "enrichment",
      header: "Enrichment",
      render: (lead) => {
        const isComplete = lead.enrichmentStatus === "complete";
        const isInProgress = lead.enrichmentStatus === "in_progress";
        
        const { icon } = getStatusColor(lead.enrichmentStatus);
        
        return (
          <span className="flex items-center">
            {isComplete ? (
              <CheckCircle className={`w-5 h-5 ${icon} mr-1.5`} />
            ) : isInProgress ? (
              <Clock className={`w-5 h-5 ${icon} mr-1.5`} />
            ) : (
              <div className={`w-5 h-5 ${icon} mr-1.5`} />
            )}
            <span className="text-sm">
              {isComplete
                ? "Complete"
                : isInProgress
                ? "In Progress"
                : "Not Started"}
            </span>
          </span>
        );
      },
    },
  ];

  const handleSegmentChange = (value: string) => {
    setSegment(value);
  };

  const handleViewLead = (lead) => {
    navigate(`/leads/${lead.id}`);
  };

  const actions = (lead) => (
    <>
      <Button
        variant="link"
        size="sm"
        className="text-primary-600 hover:text-primary-900 mr-3"
        onClick={() => handleViewLead(lead)}
      >
        View
      </Button>
      <Button
        variant="link"
        size="sm"
        className="text-neutral-600 hover:text-neutral-900"
      >
        Edit
      </Button>
    </>
  );

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="border-b border-neutral-200">
        <Tabs
          defaultValue={segment}
          value={segment}
          onValueChange={handleSegmentChange}
          className="w-full"
        >
          <TabsList className="border-b border-neutral-200 w-full justify-start rounded-none bg-transparent p-0">
            {LEAD_SEGMENTS.map((seg) => (
              <TabsTrigger
                key={seg.value}
                value={seg.value}
                className="data-[state=active]:border-b-2 data-[state=active]:border-primary-500 data-[state=active]:text-primary-600 border-b-2 border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300 py-4 px-6 font-medium text-sm rounded-none data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {seg.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <DataTable
        columns={columns}
        data={leads || []}
        rowKey="id"
        pagination={true}
        itemsPerPage={10}
        isLoading={isLoading}
        actions={actions}
        emptyMessage={`No ${segment} leads found.`}
      />
    </div>
  );
}
