import * as React from "react";
import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, AlertTriangle, ArrowUp, ArrowDown, Edit, RefreshCw, Loader2, Minus, Trash2, AlertCircle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getSourceBadgeColor, getStatusColor, getPriorityColors } from "@/lib/utils";
import { EditLeadModal } from "./EditLeadModal";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LEAD_SEGMENTS = [
  { value: "active", label: "Active Leads" },
  { value: "inactive", label: "Inactive Leads" },
  { value: "instantly", label: "Instantly.ai" },
  { value: "cyberleads", label: "Cyberleads" },
  { value: "linkedin", label: "LinkedIn" },
];

interface LeadTableProps {
  data?: any[];
}

export function LeadTable({ data }: LeadTableProps = {}) {
  const [segment, setSegment] = React.useState("active");
  const [, navigate] = useLocation();
  const [currentLead, setCurrentLead] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  
  // Function to handle bulk delete of leads
  const handleBulkDelete = async () => {
    if (selectedLeadIds.length === 0) {
      toast({
        title: "No leads selected",
        description: "Please select at least one lead to delete.",
        variant: "destructive"
      });
      return;
    }
    
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/leads/bulk-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ leadIds: selectedLeadIds })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete leads");
      }
      
      const result = await response.json();
      
      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      
      toast({
        title: "Success",
        description: result.message || `Successfully deleted selected lead(s)`,
        variant: "default"
      });
      
      // Clear selection after successful delete
      setSelectedLeadIds([]);
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting leads:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete leads",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Function to handle bulk refresh of leads
  const handleBulkRefresh = async () => {
    if (selectedLeadIds.length === 0) {
      toast({
        title: "No leads selected",
        description: "Please select at least one lead to refresh data.",
        variant: "destructive"
      });
      return;
    }
    
    if (selectedLeadIds.length > 10) {
      toast({
        title: "Too many leads selected",
        description: "Cannot refresh more than 10 leads at once. Please select fewer leads.",
        variant: "destructive"
      });
      return;
    }
    
    setIsRefreshing(true);
    
    try {
      const response = await fetch(`/api/leads/bulk-refresh-enrichment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ leadIds: selectedLeadIds })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to refresh lead data");
      }
      
      const result = await response.json();
      
      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      
      toast({
        title: "Success",
        description: `Refreshed ${result.results.filter(r => r.success).length} lead(s) successfully.`,
        variant: "default"
      });
      
      // Clear selection after successful refresh
      setSelectedLeadIds([]);
    } catch (error) {
      console.error("Error refreshing leads:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refresh lead data",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Toggle a single lead selection
  const toggleLeadSelection = (leadId: number) => {
    setSelectedLeadIds(prev => {
      if (prev.includes(leadId)) {
        return prev.filter(id => id !== leadId);
      } else {
        return [...prev, leadId];
      }
    });
  };
  
  // Handle select all checkbox
  const toggleSelectAll = () => {
    // Use data prop if provided, otherwise use fetchedLeads
    const currentLeads = data || fetchedLeads;
    if (currentLeads && currentLeads.length > 0) {
      if (selectedLeadIds.length === currentLeads.length) {
        // If all are selected, unselect all
        setSelectedLeadIds([]);
      } else {
        // Otherwise, select all
        setSelectedLeadIds(currentLeads.map(lead => lead.id));
      }
    }
  };

  // Fetch leads if not provided via props
  const { data: fetchedLeads, isLoading } = useQuery({
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

  // Use data prop if provided, otherwise use fetchedLeads
  const currentLeads = data || fetchedLeads;
  
  const columns = [
    {
      key: "priority_indicator",
      header: "",
      width: "48px",
      render: (lead) => {
        const { indicator, icon, gradient, ring, shadow } = getPriorityColors(lead.priority);
        let PriorityIcon = null;
        
        if (lead.priority === 'urgent') {
          PriorityIcon = AlertTriangle;
        } else if (lead.priority === 'high') {
          PriorityIcon = ArrowUp;
        } else if (lead.priority === 'medium') {
          PriorityIcon = Minus;
        } else if (lead.priority === 'low') {
          PriorityIcon = ArrowDown;
        }

        return (
          <div className="flex justify-center items-center">
            <div className="relative flex items-center justify-center">
              <div 
                className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-20 blur-sm rounded-full`}
              ></div>
              <div 
                className={`w-4 h-4 ${indicator} rounded-full relative ring-2 ${ring} ${shadow}`}
                title={lead.priority ? `${lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)} Priority` : 'No Priority Set'}
              ></div>
              {PriorityIcon && (
                <PriorityIcon className={`w-4 h-4 ${icon} absolute`} />
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "select",
      header: "", // Empty string header
      renderHeader: () => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 text-primary-600 border-neutral-300 rounded"
            checked={currentLeads?.length > 0 && selectedLeadIds.length === currentLeads?.length}
            onChange={toggleSelectAll}
          />
        </div>
      ),
      render: (lead) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-4 w-4 text-primary-600 border-neutral-300 rounded"
            checked={selectedLeadIds.includes(lead.id)}
            onChange={() => toggleLeadSelection(lead.id)}
          />
        </div>
      ),
    },
    {
      key: "name",
      header: "Name / Company",
      render: (lead) => {
        const { border, text, ring, gradient } = getPriorityColors(lead.priority);
        return (
          <div className={`pl-2 border-l-2 ${border} relative group`}>
            <div className={`absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b ${gradient} opacity-70`}></div>
            <div>
              <div className={`text-sm font-medium ${text} group-hover:underline cursor-pointer`}>
                {lead.firstName} {lead.lastName}
              </div>
              <div className="text-sm text-neutral-500">{lead.company}</div>
            </div>
          </div>
        );
      },
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
      key: "priority",
      header: "Priority",
      render: (lead) => {
        const { badgeBg, badgeText, gradient, icon, shadow, ring } = getPriorityColors(lead.priority);
        const priorityText = lead.priority ? lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1) : 'Not Set';
        let PriorityIcon = null;
        
        if (lead.priority === 'urgent') {
          PriorityIcon = AlertTriangle;
        } else if (lead.priority === 'high') {
          PriorityIcon = ArrowUp;
        } else if (lead.priority === 'medium') {
          PriorityIcon = Minus;
        } else if (lead.priority === 'low') {
          PriorityIcon = ArrowDown;
        }
        
        return (
          <div className="flex items-center gap-1.5">
            <Badge 
              variant="outline" 
              className={`${badgeBg} ${badgeText} ${shadow} font-medium border border-solid relative overflow-hidden`}
            >
              <div className={`absolute inset-0 opacity-10 bg-gradient-to-r ${gradient}`}></div>
              <div className="relative flex items-center gap-1">
                {PriorityIcon && <PriorityIcon className={`h-3 w-3 ${icon}`} />}
                {priorityText}
              </div>
            </Badge>
          </div>
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

  const handleEditLead = (lead) => {
    setCurrentLead(lead);
    setIsEditModalOpen(true);
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
        onClick={() => handleEditLead(lead)}
      >
        <Edit className="h-4 w-4 mr-1" />
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

      <div className="p-4 border-b border-neutral-200 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {selectedLeadIds.length > 0 && (
            <>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleBulkRefresh}
                disabled={isRefreshing || isDeleting}
                className="flex items-center gap-2"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refreshing {selectedLeadIds.length} lead(s)...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Refresh {selectedLeadIds.length} selected
                  </>
                )}
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isRefreshing || isDeleting}
                className="flex items-center gap-2 bg-red-50 border-red-200 hover:bg-red-100 text-red-600"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete {selectedLeadIds.length} selected
                  </>
                )}
              </Button>
            </>
          )}
        </div>
        <div>
          {/* This button is for legacy UI, actual button is now in the parent LeadManagement component */}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={currentLeads || []}
        rowKey="id"
        pagination={true}
        itemsPerPage={10}
        isLoading={!data && isLoading}
        actions={actions}
        emptyMessage={`No ${segment} leads found.`}
      />
      
      {/* Edit Lead Modal */}
      {currentLead && (
        <EditLeadModal
          lead={currentLead}
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
        />
      )}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Confirm Deletion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedLeadIds.length} lead{selectedLeadIds.length !== 1 ? 's' : ''}? 
              This action cannot be undone and all associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              disabled={isDeleting}
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>Delete</>  
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
