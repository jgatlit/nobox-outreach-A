import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Play, Pause, RefreshCw, AlertCircle, CheckCircle, Clock, Plus } from "lucide-react";

const updateWorkflowSchema = z.object({
  status: z.string(),
  processedCount: z.number().optional(),
  totalCount: z.number().optional(),
});

interface WorkflowCardProps {
  workflow: any;
  onStatusChange: (id: number, status: string) => void;
  onRefresh: (id: number) => void;
}

function WorkflowCard({ workflow, onStatusChange, onRefresh }: WorkflowCardProps) {
  const progress = workflow.totalCount > 0 
    ? Math.round((workflow.processedCount / workflow.totalCount) * 100) 
    : 0;
  
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800";
      case "in-progress":
      case "in_progress":
        return "bg-amber-100 text-amber-800";
      case "queued":
        return "bg-neutral-100 text-neutral-800";
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-neutral-100 text-neutral-800";
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <CheckCircle className="h-4 w-4 mr-1" />;
      case "in-progress":
      case "in_progress":
        return <Clock className="h-4 w-4 mr-1" />;
      case "queued":
        return <Clock className="h-4 w-4 mr-1" />;
      case "failed":
        return <AlertCircle className="h-4 w-4 mr-1" />;
      default:
        return null;
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{workflow.name}</CardTitle>
            <CardDescription className="mt-1">
              {workflow.description || "No description provided"}
            </CardDescription>
          </div>
          <Badge className={getStatusColor(workflow.status)} variant="outline">
            <div className="flex items-center">
              {getStatusIcon(workflow.status)}
              {workflow.status}
            </div>
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-neutral-500">Last Run</p>
              <p className="font-medium">
                {workflow.lastRun ? formatRelativeTime(workflow.lastRun) : "Never"}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">Next Run</p>
              <p className="font-medium">
                {workflow.nextScheduledRun ? formatDate(workflow.nextScheduledRun) : "Not scheduled"}
              </p>
            </div>
            <div>
              <p className="text-neutral-500">n8n Workflow ID</p>
              <p className="font-medium">{workflow.n8nWorkflowId || "None"}</p>
            </div>
            <div>
              <p className="text-neutral-500">Processed</p>
              <p className="font-medium">
                {workflow.processedCount}/{workflow.totalCount || 0}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end space-x-2 pt-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onRefresh(workflow.id)}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        {workflow.status === "active" ? (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onStatusChange(workflow.id, "queued")}
          >
            <Pause className="h-4 w-4 mr-2" />
            Pause
          </Button>
        ) : (
          <Button 
            variant={workflow.status === "failed" ? "destructive" : "outline"} 
            size="sm" 
            onClick={() => onStatusChange(workflow.id, "active")}
          >
            <Play className="h-4 w-4 mr-2" />
            {workflow.status === "failed" ? "Retry" : "Start"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

export default function Workflows() {
  const [selectedTab, setSelectedTab] = useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['/api/workflows'],
    staleTime: 30000, // 30 seconds
  });
  
  const updateWorkflowStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const response = await apiRequest(
        "PATCH", 
        `/api/workflows/${id}/status`, 
        { status }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Workflow updated",
        description: "The workflow status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to update workflow",
        description: error.message || "An error occurred while updating the workflow.",
        variant: "destructive",
      });
    },
  });
  
  const refreshWorkflowMutation = useMutation({
    mutationFn: async (id: number) => {
      // This would typically hit an endpoint to refresh workflow status from n8n
      // For now, we'll just log the workflow as having run
      const response = await apiRequest(
        "POST", 
        `/api/workflows/${id}/log-run`,
        { 
          processedCount: Math.floor(Math.random() * 100), 
          totalCount: 100 
        }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Workflow refreshed",
        description: "The workflow status has been refreshed.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to refresh workflow",
        description: error.message || "An error occurred while refreshing the workflow.",
        variant: "destructive",
      });
    },
  });
  
  const handleStatusChange = (id: number, status: string) => {
    updateWorkflowStatusMutation.mutate({ id, status });
  };
  
  const handleRefresh = (id: number) => {
    refreshWorkflowMutation.mutate(id);
  };
  
  const filteredWorkflows = workflows?.filter(workflow => {
    if (selectedTab === "all") return true;
    return workflow.status.toLowerCase() === selectedTab.toLowerCase();
  }) || [];
  
  return (
    <main className="p-6 overflow-auto h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">n8n Workflow Management</h2>
        <Button className="bg-primary-600 hover:bg-primary-700">
          <Plus className="mr-2 h-4 w-4" />
          Create Workflow
        </Button>
      </div>
      
      <div className="mb-6">
        <Tabs defaultValue={selectedTab} value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="all">All Workflows</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="queued">Queued</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-6 bg-neutral-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-neutral-200 rounded w-full"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <div className="h-4 bg-neutral-200 rounded w-16"></div>
                      <div className="h-4 bg-neutral-200 rounded w-10"></div>
                    </div>
                    <div className="h-2 bg-neutral-200 rounded w-full"></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map(j => (
                      <div key={j}>
                        <div className="h-4 bg-neutral-200 rounded w-full mb-1"></div>
                        <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2 pt-2">
                <div className="h-8 bg-neutral-200 rounded w-24"></div>
                <div className="h-8 bg-neutral-200 rounded w-24"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredWorkflows.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredWorkflows.map(workflow => (
            <WorkflowCard 
              key={workflow.id} 
              workflow={workflow} 
              onStatusChange={handleStatusChange}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-neutral-900">No workflows found</h3>
          <p className="mt-2 text-sm text-neutral-500">
            {selectedTab === "all" 
              ? "Get started by creating your first workflow"
              : `No ${selectedTab} workflows found`}
          </p>
          <Button className="mt-4 bg-primary-600 hover:bg-primary-700">
            <Plus className="mr-2 h-4 w-4" />
            Create Your First Workflow
          </Button>
        </div>
      )}
    </main>
  );
}
