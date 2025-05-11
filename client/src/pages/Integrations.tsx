import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  Upload,
  Download,
  Table
} from "lucide-react";

// Form schema for Airtable sync
const airtableSyncSchema = z.object({
  tableName: z.string().min(1, { message: "Table name is required" }),
  baseId: z.string().optional(),
  syncDirection: z.enum(["to_airtable", "from_airtable"]),
  dataType: z.enum(["leads", "campaigns"])
});

type AirtableSyncFormValues = z.infer<typeof airtableSyncSchema>;

export default function Integrations() {
  const [activeTab, setActiveTab] = React.useState("all");
  const [isAirtableDialogOpen, setIsAirtableDialogOpen] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Airtable sync form
  const airtableForm = useForm<AirtableSyncFormValues>({
    resolver: zodResolver(airtableSyncSchema),
    defaultValues: {
      tableName: "Leads",
      syncDirection: "to_airtable",
      dataType: "leads"
    },
  });
  
  const { data: integrations, isLoading } = useQuery({
    queryKey: ['/api/integrations'],
    staleTime: 60000, // 1 minute
  });
  
  // Add Airtable card to the list of integrations
  const allIntegrations = React.useMemo(() => {
    const existingIntegrations = integrations || [];
    return [
      ...existingIntegrations,
      {
        id: "airtable",
        name: "Airtable",
        type: "database",
        status: "active",
        lastChecked: new Date().toISOString(),
        description: "Sync leads and campaigns with Airtable",
        config: {
          // The actual base ID is stored in environment variables
          apiUrl: "https://api.airtable.com/v0",
        }
      }
    ];
  }, [integrations]);
  
  // Handle Airtable sync 
  const handleSyncWithAirtable = async (data: AirtableSyncFormValues) => {
    setIsSyncing(true);
    
    try {
      let endpoint = '';
      let successMessage = '';
      let invalidateQueryKey = '';
      
      // Determine the correct endpoint based on data type and sync direction
      if (data.dataType === "leads") {
        invalidateQueryKey = '/api/leads';
        
        if (data.syncDirection === "to_airtable") {
          endpoint = "/api/airtable/sync/leads-to-airtable";
          successMessage = "Successfully synced leads to Airtable";
        } else {
          endpoint = "/api/airtable/sync/leads-from-airtable";
          successMessage = "Successfully synced leads from Airtable";
        }
      } else if (data.dataType === "campaigns") {
        invalidateQueryKey = '/api/campaigns';
        
        if (data.syncDirection === "to_airtable") {
          endpoint = "/api/airtable/sync/campaigns-to-airtable";
          successMessage = "Successfully synced campaigns to Airtable";
        } else {
          endpoint = "/api/airtable/sync/campaigns-from-airtable";
          successMessage = "Successfully synced campaigns from Airtable";
        }
      }
      
      const response = await apiRequest("POST", endpoint, {
        tableName: data.tableName,
        baseId: data.baseId || undefined,
      });
      
      const result = await response.json();
      
      if (response.ok) {
        let successDetails = '';
        
        if (result.created) {
          successDetails += `Created: ${result.created}. `;
        }
        
        if (result.updated) {
          successDetails += `Updated: ${result.updated}. `;
        }
        
        if (result.syncedLeadsCount) {
          successDetails += `Total leads: ${result.syncedLeadsCount}. `;
        }
        
        if (result.syncedCampaignsCount) {
          successDetails += `Total campaigns: ${result.syncedCampaignsCount}. `;
        }
        
        toast({
          title: "Sync completed",
          description: `${successMessage}. ${successDetails}`,
        });
        
        // Refresh the relevant data after sync
        queryClient.invalidateQueries({ queryKey: [invalidateQueryKey] });
        
        // Close the dialog
        setIsAirtableDialogOpen(false);
      } else {
        throw new Error(result.error || "Failed to sync with Airtable");
      }
    } catch (error) {
      console.error("Airtable sync error:", error);
      toast({
        title: "Sync failed",
        description: error.message || "Failed to sync with Airtable",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };
  
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
  
  const filteredIntegrations = allIntegrations.filter(integration => {
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
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {/* Airtable Sync Dialog */}
      <Dialog open={isAirtableDialogOpen} onOpenChange={setIsAirtableDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Sync with Airtable</DialogTitle>
            <DialogDescription>
              Sync your data between the application and Airtable.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...airtableForm}>
            <form onSubmit={airtableForm.handleSubmit(handleSyncWithAirtable)} className="space-y-4">
              {/* Data Type Selector Tabs */}
              <FormField
                control={airtableForm.control}
                name="dataType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data Type</FormLabel>
                    <Tabs 
                      defaultValue={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        // Update default table name based on selected data type
                        if (value === "leads") {
                          airtableForm.setValue("tableName", "Leads");
                        } else if (value === "campaigns") {
                          airtableForm.setValue("tableName", "Campaigns");
                        }
                      }}
                      className="w-full"
                    >
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="leads" className="flex items-center">
                          <Users className="h-4 w-4 mr-2" />
                          Leads
                        </TabsTrigger>
                        <TabsTrigger value="campaigns" className="flex items-center">
                          <BarChart className="h-4 w-4 mr-2" />
                          Campaigns
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <FormDescription>
                      Select which data type you want to synchronize.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={airtableForm.control}
                name="syncDirection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sync Direction</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sync direction" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="to_airtable">
                          <div className="flex items-center">
                            <Upload className="mr-2 h-4 w-4" />
                            <span>PostgreSQL → Airtable</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="from_airtable">
                          <div className="flex items-center">
                            <Download className="mr-2 h-4 w-4" />
                            <span>Airtable → PostgreSQL</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose whether to push data to Airtable or pull data from Airtable.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={airtableForm.control}
                name="tableName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Airtable Table Name</FormLabel>
                    <FormControl>
                      <Input placeholder={`e.g., ${airtableForm.getValues("dataType") === "leads" ? "Leads" : "Campaigns"}`} {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter the name of the Airtable table to sync with.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={airtableForm.control}
                name="baseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base ID (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., appUPDttFgRrz9YiC" {...field} />
                    </FormControl>
                    <FormDescription>
                      If not provided, the system will use the Base ID from your environment variables.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAirtableDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSyncing}
                  className="bg-primary-600 hover:bg-primary-700"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Start Sync
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
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
          {filteredIntegrations.map(integration => {
            // Special case for Airtable integration
            if (integration.id === "airtable") {
              return (
                <Card key={integration.id} className="border-2 border-green-100">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Grid className="h-10 w-10 text-green-500" />
                      {getStatusIcon(integration.status)}
                    </div>
                    <CardTitle className="mt-4">Airtable</CardTitle>
                    <CardDescription>
                      Database Integration
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-neutral-500">
                      <p>Bidirectional sync for leads and campaigns</p>
                      <p className="mt-1">Sync leads, campaigns, and other data with Airtable</p>
                      <div className="mt-3">
                        <Badge variant="outline" className="mr-2 bg-green-50">
                          <Table className="h-3 w-3 mr-1" />
                          Leads
                        </Badge>
                        <Badge variant="outline" className="bg-blue-50">
                          <BarChart className="h-3 w-3 mr-1" />
                          Campaigns
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col space-y-2">
                    <div className="flex justify-between w-full">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          // Set to export data (PostgreSQL to Airtable)
                          airtableForm.setValue("syncDirection", "to_airtable");
                          setIsAirtableDialogOpen(true);
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Export to Airtable
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          // Set to import data (Airtable to PostgreSQL)
                          airtableForm.setValue("syncDirection", "from_airtable");
                          setIsAirtableDialogOpen(true);
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Import from Airtable
                      </Button>
                    </div>
                    <div className="text-xs text-center text-neutral-500 mt-2">
                      Using Airtable Personal Access Token for authentication
                    </div>
                  </CardFooter>
                </Card>
              );
            }
            
            // Standard card for other integrations
            return (
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
                    onClick={() => {
                      if (typeof integration.id === 'number') {
                        updateStatusMutation.mutate({
                          id: integration.id,
                          status: integration.status === "active" ? "warning" : "active"
                        });
                      }
                    }}
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
            );
          })}
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
