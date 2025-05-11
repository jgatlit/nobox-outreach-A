import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatRelativeTime } from "@/lib/utils";
import { 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle,
  RefreshCw,
  Settings,
  ExternalLink,
  Server,
  Database,
  Users,
  BarChart,
  Brain,
  Puzzle,
  Plus,
  Grid,
  Save,
  ArrowUpDown
} from "lucide-react";

export default function Integrations() {
  const [activeTab, setActiveTab] = React.useState("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: integrations, isLoading } = useQuery({
    queryKey: ['/api/integrations'],
    staleTime: 60000, // 1 minute
  });
  
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: string }) => {
      const response = await apiRequest(
        "PATCH", 
        `/api/integrations/${id}/status`, 
        { status }
      );
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Integration status updated",
        description: "The integration status has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/integrations'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to update status",
        description: error.message || "An error occurred while updating the integration status.",
        variant: "destructive",
      });
    },
  });
  
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-neutral-400" />;
    }
  };
  
  const getIntegrationIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case "workflow_automation":
        return <Server className="h-10 w-10 text-primary-500" />;
      case "crm":
        return <Users className="h-10 w-10 text-blue-500" />;
      case "project_management":
        return <BarChart className="h-10 w-10 text-purple-500" />;
      case "ai":
        return <Brain className="h-10 w-10 text-amber-500" />;
      case "database":
        return <Database className="h-10 w-10 text-green-500" />;
      default:
        return <Puzzle className="h-10 w-10 text-neutral-500" />;
    }
  };
  
  const filteredIntegrations = integrations?.filter(integration => {
    if (activeTab === "all") return true;
    return integration.type === activeTab;
  }) || [];
  
  return (
    <main className="p-6 overflow-auto h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">System Integrations</h2>
        <Button className="bg-primary-600 hover:bg-primary-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>
      
      <div className="mb-6">
        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="workflow_automation">Automation</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            <TabsTrigger value="project_management">Project Management</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="database">Database</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 bg-neutral-200 rounded-full"></div>
                  <div className="h-5 w-5 bg-neutral-200 rounded-full"></div>
                </div>
                <div className="h-6 bg-neutral-200 rounded w-3/4 mt-4"></div>
                <div className="h-4 bg-neutral-200 rounded w-full mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-4 bg-neutral-200 rounded w-full"></div>
                  <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <div className="h-8 bg-neutral-200 rounded w-24"></div>
                <div className="h-8 bg-neutral-200 rounded w-24"></div>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredIntegrations.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map(integration => (
            <Card key={integration.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  {getIntegrationIcon(integration.type)}
                  {getStatusIcon(integration.status)}
                </div>
                <CardTitle className="mt-4">{integration.name}</CardTitle>
                <CardDescription>
                  {integration.type.replace("_", " ").replace(/^\w/, c => c.toUpperCase())}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-neutral-500">
                  <p>Last checked: {formatRelativeTime(integration.lastChecked)}</p>
                  {integration.config?.apiUrl && (
                    <p className="mt-1 truncate">API: {integration.config.apiUrl}</p>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => updateStatusMutation.mutate({
                    id: integration.id,
                    status: integration.status === "active" ? "warning" : "active"
                  })}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-neutral-900">No integrations found</h3>
          <p className="mt-2 text-sm text-neutral-500">
            {activeTab === "all" 
              ? "Get started by adding your first integration"
              : `No ${activeTab.replace("_", " ")} integrations found`}
          </p>
          <Button className="mt-4 bg-primary-600 hover:bg-primary-700">
            <Plus className="mr-2 h-4 w-4" />
            Add Integration
          </Button>
        </div>
      )}
    </main>
  );
}
