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
import { checkAirtableConnection, syncLeadsToAirtable, syncLeadsFromAirtable } from "@/lib/airtable";
import { Link } from "wouter";
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
  ArrowRight
} from "lucide-react";

export default function Integrations() {
  const [activeTab, setActiveTab] = React.useState("all");
  const [airtableStatus, setAirtableStatus] = React.useState<'unchecked' | 'connected' | 'error'>('unchecked');
  const [airtableConnectionMessage, setAirtableConnectionMessage] = React.useState("");
  const [airtableBaseId, setAirtableBaseId] = React.useState("");
  const [airtableSyncingTo, setAirtableSyncingTo] = React.useState(false);
  const [airtableSyncingFrom, setAirtableSyncingFrom] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: integrations, isLoading } = useQuery({
    queryKey: ['/api/integrations'],
    staleTime: 60000, // 1 minute
  });
  
  // Check Airtable connection when component mounts
  React.useEffect(() => {
    checkAirtableConnectionStatus();
  }, []);
  
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
  
  const [airtableNeedsSetup, setAirtableNeedsSetup] = React.useState(false);
  const [airtableNeedsTable, setAirtableNeedsTable] = React.useState(false);

  // Function to check Airtable connection
  const checkAirtableConnectionStatus = async () => {
    try {
      setAirtableStatus('unchecked');
      setAirtableConnectionMessage("Checking connection...");
      setAirtableNeedsSetup(false);
      setAirtableNeedsTable(false);
      
      const result = await checkAirtableConnection();
      
      if (result.success) {
        setAirtableStatus('connected');
        
        if (result.needsSetup) {
          setAirtableNeedsSetup(true);
          setAirtableConnectionMessage(result.message || "Connected to Airtable, but table structure needs setup.");
        } else if (result.needsTable) {
          setAirtableNeedsTable(true);
          setAirtableConnectionMessage(result.message || "Connected to Airtable, but 'Leads' table doesn't exist.");
        } else {
          setAirtableConnectionMessage(`Successfully connected to Airtable. Records: ${result.recordCount || 0}`);
        }
        
        if (result.baseId) {
          setAirtableBaseId(result.baseId);
        }
      } else {
        setAirtableStatus('error');
        setAirtableConnectionMessage(result.message || "Failed to connect to Airtable.");
      }
    } catch (error) {
      setAirtableStatus('error');
      setAirtableConnectionMessage("Error checking Airtable connection.");
      console.error("Airtable connection check error:", error);
    }
  };
  
  // Function to sync leads to Airtable
  const syncLeadsToAirtableHandler = async () => {
    try {
      setAirtableSyncingTo(true);
      
      try {
        const result = await syncLeadsToAirtable();
        
        if (result.success) {
          toast({
            title: "Leads synced to Airtable",
            description: `Successfully synced ${result.syncedCount || 0} leads to Airtable.`,
          });
          // After successful sync, refresh connection status
          checkAirtableConnectionStatus();
        } else {
          // Handle specific error cases
          if (result.fieldError && result.missingField) {
            toast({
              title: "Field error in Airtable",
              description: `You need to create a field named "${result.missingField}" in your Airtable "Leads" table.`,
              variant: "destructive",
            });
            
            // We should also update the connection status to show the need for setup
            setAirtableNeedsSetup(true);
            setAirtableConnectionMessage(`Connected to Airtable, but you need to create a field named "${result.missingField}" in your Airtable "Leads" table.`);
          }
          else if (result.tableError) {
            toast({
              title: "Table error in Airtable",
              description: "You need to create a 'Leads' table in your Airtable base first.",
              variant: "destructive",
            });
            
            // Update connection status to show need for table
            setAirtableNeedsTable(true);
            setAirtableConnectionMessage("Connected to Airtable, but 'Leads' table doesn't exist. Create a table named 'Leads' in your Airtable base first.");
          }
          else {
            toast({
              title: "Failed to sync leads",
              description: result.message || "An error occurred while syncing leads to Airtable.",
              variant: "destructive",
            });
          }
        }
      } catch (error: any) {
        // Handle error response from API - check for any HTTP error code
        if (error.message && /\d{3}:/.test(error.message)) {
          try {
            // Try to parse the error response - need to handle different formats
            const errorMatch = error.message.match(/\d+: (.*)/);
            const errorText = errorMatch ? errorMatch[1] : error.message;
            console.log("Error text to parse:", errorText);
            const errorJson = JSON.parse(errorText);
            
            if (errorJson.fieldError && errorJson.missingField) {
              toast({
                title: "Field error in Airtable",
                description: `You need to create a field named "${errorJson.missingField}" in your Airtable "Leads" table.`,
                variant: "destructive",
              });
              
              // Update connection status
              setAirtableNeedsSetup(true);
              setAirtableConnectionMessage(`Connected to Airtable, but you need to create a field named "${errorJson.missingField}" in your Airtable "Leads" table.`);
              return;
            } 
            
            if (errorJson.emailFieldError) {
              toast({
                title: "Email field format error",
                description: "The email field in your Airtable is likely set as 'Email' type which is validating emails. Change it to 'Single line text' to fix this issue.",
                variant: "destructive",
              });
              
              // Update connection status
              setAirtableNeedsSetup(true);
              setAirtableConnectionMessage("Connected to Airtable, but there's an issue with the email field format. Change the email field in Airtable from 'Email' to 'Single line text' type.");
              return;
            }
            
            if (errorJson.tagsFieldError) {
              toast({
                title: "Tags field format error",
                description: "The tags field in your Airtable can't accept array values. Change it to 'Single line text' type to fix this issue.",
                variant: "destructive",
              });
              
              // Update connection status
              setAirtableNeedsSetup(true);
              setAirtableConnectionMessage("Connected to Airtable, but there's an issue with the tags field format. Change the tags field in Airtable to 'Single line text' type.");
              return;
            }
            
            if (errorJson.dateFieldError) {
              toast({
                title: "Date field format error",
                description: "The lastContactDate field in your Airtable can't accept the provided date format. Make sure it's set to 'Date' type.",
                variant: "destructive",
              });
              
              // Update connection status
              setAirtableNeedsSetup(true);
              setAirtableConnectionMessage("Connected to Airtable, but there's an issue with the date field format. Ensure the lastContactDate field in Airtable is set to 'Date' type.");
              return;
            }
            
            if (errorJson.tableError) {
              toast({
                title: "Table error in Airtable",
                description: "You need to create a 'Leads' table in your Airtable base first.",
                variant: "destructive",
              });
              
              // Update connection status
              setAirtableNeedsTable(true);
              setAirtableConnectionMessage("Connected to Airtable, but 'Leads' table doesn't exist. Create a table named 'Leads' in your Airtable base first.");
              return;
            }
            
            // Generic error with message from server
            if (errorJson.message) {
              toast({
                title: "Airtable sync error",
                description: errorJson.message,
                variant: "destructive",
              });
              return;
            }
          } catch (parseError) {
            // Error response wasn't in JSON format, use generic error
            console.log("Error parsing error response:", parseError);
          }
        }
        
        toast({
          title: "Sync error",
          description: error.message ? `Failed to sync leads: ${error.message}` : "Failed to sync leads to Airtable.",
          variant: "destructive",
        });
        console.error("Sync to Airtable error:", error);
      }
    } catch (error) {
      toast({
        title: "Sync error",
        description: "An unexpected error occurred during sync.",
        variant: "destructive",
      });
      console.error("Unexpected error in syncLeadsToAirtableHandler:", error);
    } finally {
      setAirtableSyncingTo(false);
    }
  };
  
  // Function to sync leads from Airtable
  const syncLeadsFromAirtableHandler = async () => {
    try {
      setAirtableSyncingFrom(true);
      
      const result = await syncLeadsFromAirtable();
      
      if (result.success) {
        toast({
          title: "Leads imported from Airtable",
          description: `Successfully imported leads from Airtable. Created: ${result.results?.created || 0}, Updated: ${result.results?.updated || 0}`,
        });
        // Refresh leads data
        queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      } else {
        toast({
          title: "Failed to import leads",
          description: result.message || "An error occurred while importing leads from Airtable.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import error",
        description: "Failed to import leads from Airtable.",
        variant: "destructive",
      });
      console.error("Sync from Airtable error:", error);
    } finally {
      setAirtableSyncingFrom(false);
    }
  };
  
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
  
  // Google Sheets card component
  const GoogleSheetsCard = () => (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-10 w-10">
              <rect width="24" height="24" rx="4" fill="#F8FAFC" />
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" fill="#0F9D58"/>
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14h-4v-2h4v2zm5-4H5v-2h14v2zm0-4H5V7h14v2z" fill="#0F9D58"/>
            </svg>
            <div>
              <CardTitle className="text-lg font-semibold">Google Sheets</CardTitle>
              <CardDescription>Import leads directly from Google Sheets</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-neutral-500">
          <p>Import your leads data from Google Sheets spreadsheets into your lead database.</p>
          <p className="mt-2">Features:</p>
          <ul className="list-disc list-inside mt-1 space-y-1 text-xs">
            <li>Map spreadsheet columns to lead fields</li>
            <li>Preview data before import</li>
            <li>Automatic duplicate detection</li>
          </ul>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4 flex justify-end">
        <Link href="/google-sheets-import">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Import From Sheets
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );

  // Function to get Airtable status icon
  const getAirtableStatusIcon = () => {
    switch (airtableStatus) {
      case "connected":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-neutral-400" />;
    }
  };
  
  // Airtable card component
  const AirtableCard = () => (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-10 w-10">
              <rect width="24" height="24" rx="4" fill="#F8FAFC" />
              <path d="M12 4L4 8.5V9.8L7.2 11.6V16.7L12 19.5L16.8 16.7V11.6L18.4 10.7V15.5H20V8.5L12 4ZM16.1 8.7L12 11L7.9 8.7L12 6.4L16.1 8.7ZM15.2 15.3L12 17.1L8.8 15.3V12.4L12 14.2L15.2 12.4V15.3Z" fill="#2563EB" />
            </svg>
            <div>
              <h3 className="text-lg font-semibold">Airtable</h3>
              <p className="text-sm text-neutral-500">Bi-directional lead sync</p>
            </div>
          </div>
          {getAirtableStatusIcon()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm">
          <p className="my-2">{airtableConnectionMessage}</p>
          {airtableStatus === 'connected' && !airtableNeedsSetup && !airtableNeedsTable && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="text-center p-2 bg-neutral-100 rounded-md">
                <p className="text-sm font-medium">Base ID</p>
                <p className="truncate text-xs">{airtableBaseId || "Not specified"}</p>
              </div>
              <div className="text-center p-2 bg-neutral-100 rounded-md">
                <p className="text-sm font-medium">Table</p>
                <p className="text-xs">Leads</p>
              </div>
            </div>
          )}
          
          {airtableNeedsTable && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
              <h4 className="font-medium mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Table Missing
              </h4>
              <p className="text-sm mb-2">
                Your Airtable base is missing the "Leads" table required for synchronization.
              </p>
              <ol className="list-decimal list-inside text-sm space-y-1">
                <li>Open your Airtable base</li>
                <li>Click the "+" icon to add a new table</li>
                <li>Name it exactly "Leads" (case sensitive)</li>
                <li>Click "Check Connection" once you're done</li>
              </ol>
              <a 
                href={`https://airtable.com/${airtableBaseId}`} 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs text-blue-600 hover:underline flex items-center mt-3"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open in Airtable
              </a>
            </div>
          )}
          
          {airtableNeedsSetup && !airtableNeedsTable && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
              <h4 className="font-medium mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Missing Fields
              </h4>
              <p className="text-sm mb-2">
                Your "Leads" table needs these fields to work with our system:
              </p>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs mt-2">
                {[
                  "PostgreSQL_ID", "firstName", "lastName", "email", 
                  "company", "title", "website", "phoneNumber", 
                  "status", "source", "notes", "priority", 
                  "tags", "lastContactDate"
                ].map(field => (
                  <li key={field} className="flex items-center">
                    <span className="h-1.5 w-1.5 bg-amber-500 rounded-full mr-1"></span>
                    {field}
                  </li>
                ))}
              </ul>
              <p className="text-xs mt-2">
                In Airtable, click "+" in your Fields section and add these fields.
              </p>
              <a 
                href={`https://airtable.com/${airtableBaseId}`} 
                target="_blank" 
                rel="noreferrer" 
                className="text-xs text-blue-600 hover:underline flex items-center mt-3"
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open in Airtable
              </a>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          size="sm"
          onClick={checkAirtableConnectionStatus}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${airtableStatus === 'unchecked' ? 'animate-spin' : ''}`} />
          Check Connection
        </Button>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={syncLeadsToAirtableHandler}
            disabled={airtableStatus !== 'connected' || airtableSyncingTo}
          >
            {airtableSyncingTo ? 
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> :
              <ExternalLink className="h-4 w-4 mr-2" />
            }
            Sync to Airtable
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={syncLeadsFromAirtableHandler}
            disabled={airtableStatus !== 'connected' || airtableSyncingFrom || airtableNeedsSetup || airtableNeedsTable}
          >
            {airtableSyncingFrom ? 
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> :
              <ExternalLink className="h-4 w-4 mr-2 rotate-180" />
            }
            Import from Airtable
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
  
  return (
    <main className="p-6 overflow-auto h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">System Integrations</h2>
        <Button className="bg-primary-600 hover:bg-primary-700">
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </div>
      
      {/* Airtable Integration Card */}
      <AirtableCard />
      
      {/* Google Sheets Integration Card */}
      <GoogleSheetsCard />
      
      <div className="mb-6">
        <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="workflow_automation">Automation</TabsTrigger>
            <TabsTrigger value="crm">CRM</TabsTrigger>
            <TabsTrigger value="project_management">Project Management</TabsTrigger>
            <TabsTrigger value="ai">AI</TabsTrigger>
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
