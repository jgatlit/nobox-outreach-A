import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Database, Key, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AirtableStatus {
  config: {
    isConfigured: boolean;
    apiKeyPresent: boolean;
    baseIdPresent: boolean;
    baseIdCorrect: boolean;
    usedBaseId: string;
    error?: string;
  };
  mcpServer: {
    running: boolean;
    status: any;
  };
  apiConnection: {
    status: number;
    isSuccess: boolean;
    error?: string;
    tablesAccess?: {
      success: boolean;
      tables: Record<string, {
        status: number;
        success: boolean;
        error?: string;
        hasRecords?: boolean;
      }>;
    };
  };
}

interface AirtableStatusTileProps {
  className?: string;
}

export function AirtableStatusTile({ className }: AirtableStatusTileProps) {
  const [loading, setLoading] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [status, setStatus] = useState<AirtableStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseId, setBaseId] = useState('');
  const { toast } = useToast();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/airtable/diagnostics');
      const data = await response.json();
      
      if (data.success && data.diagnostics) {
        setStatus(data.diagnostics);
        
        // If we have a stored baseId, set it in the form
        if (data.diagnostics.config.usedBaseId) {
          setBaseId(data.diagnostics.config.usedBaseId);
        }
      } else {
        throw new Error('Failed to fetch Airtable status');
      }
    } catch (error) {
      console.error('Error fetching Airtable status:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch Airtable status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const saveApiConfig = async () => {
    setConfiguring(true);
    try {
      // In a real implementation, we would POST to '/api/airtable/config'
      // For now, store in localStorage for demo purposes
      if (apiKey || baseId) {
        // If API key is provided, update it
        if (apiKey) {
          localStorage.setItem('AIRTABLE_API_KEY', apiKey);
        }
        
        // If Base ID is provided, update it
        if (baseId) {
          localStorage.setItem('AIRTABLE_BASE_ID', baseId);
        }
        
        toast({
          title: 'Configuration Saved',
          description: 'Airtable configuration has been updated successfully.',
        });
        
        // Refresh status
        await fetchStatus();
      } else {
        toast({
          title: 'No Changes',
          description: 'No configuration changes were made.',
        });
      }
    } catch (error) {
      console.error('Error saving Airtable configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to save Airtable configuration. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setConfiguring(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusBadge = (success: boolean) => {
    if (success) {
      return <Badge className="bg-green-500 hover:bg-green-600">Connected</Badge>;
    }
    return <Badge variant="destructive">Disconnected</Badge>;
  };

  const getOverallStatusIcon = () => {
    if (!status) return <RefreshCw className="h-5 w-5 animate-spin text-neutral-500" />;
    
    // Check table access which is more important than metadata API access
    const tablesAccessible = status.apiConnection.tablesAccess?.success || false;
    
    if (status.config.isConfigured && tablesAccessible) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else if (status.config.isConfigured && !tablesAccessible) {
      return <AlertCircle className="h-5 w-5 text-amber-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getTableStatusSummary = () => {
    if (!status?.apiConnection.tablesAccess) return "Unknown";
    
    const tables = status.apiConnection.tablesAccess.tables;
    const tableNames = Object.keys(tables);
    const connectedTables = tableNames.filter(name => tables[name].success).length;
    
    return `${connectedTables}/${tableNames.length} tables connected`;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Database className="h-10 w-10 text-blue-500" />
          {getOverallStatusIcon()}
        </div>
        <CardTitle className="mt-4">Airtable</CardTitle>
        <CardDescription>
          External Database Integration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm space-y-2">
          <div className="flex justify-between items-center">
            <span>Connection:</span>
            {status ? getStatusBadge(status.apiConnection.tablesAccess?.success || false) : <span>Loading...</span>}
          </div>
          <div className="flex justify-between items-center">
            <span>Base ID:</span>
            <span className="font-mono text-xs">{status?.config.usedBaseId || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Tables:</span>
            <span>{status ? getTableStatusSummary() : 'Loading...'}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStatus}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        
        <div className="flex gap-2">
          {/* Configure Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Key className="h-4 w-4 mr-2" />
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Airtable API Configuration</DialogTitle>
                <DialogDescription>
                  Configure your Airtable API key and Base ID to enable integration
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="airtable-api-key">Airtable API Key</Label>
                  <Input 
                    id="airtable-api-key" 
                    type="password" 
                    placeholder="Enter API key" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="airtable-base-id">Base ID</Label>
                  <Input 
                    id="airtable-base-id" 
                    placeholder="Enter Base ID" 
                    value={baseId} 
                    onChange={(e) => setBaseId(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Current Base ID: {status?.config.usedBaseId || 'Not configured'}
                  </p>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Note</AlertTitle>
                  <AlertDescription>
                    Find your API key in the 
                    <a href="https://airtable.com/account" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-1">
                      Airtable account settings
                    </a>
                  </AlertDescription>
                </Alert>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setApiKey('');
                  if (status?.config.usedBaseId) {
                    setBaseId(status.config.usedBaseId);
                  } else {
                    setBaseId('');
                  }
                }} disabled={configuring}>
                  Reset
                </Button>
                <Button onClick={saveApiConfig} disabled={configuring}>
                  {configuring ? 'Saving...' : 'Save Configuration'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Details Dialog */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Details
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Airtable Integration Status</DialogTitle>
              <DialogDescription>
                Detailed diagnostics for the Airtable connection
              </DialogDescription>
            </DialogHeader>
            
            {status ? (
              <div className="mt-4 space-y-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      Configuration Status
                      {status.config.isConfigured ? (
                        <Badge className="bg-green-500 hover:bg-green-600">Configured</Badge>
                      ) : (
                        <Badge variant="destructive">Not Configured</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">API Key Present:</p>
                          <p className="flex items-center mt-1">
                            {status.config.apiKeyPresent ? (
                              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mr-2" />
                            )}
                            {status.config.apiKeyPresent ? 'Yes' : 'No'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Base ID Present:</p>
                          <p className="flex items-center mt-1">
                            {status.config.baseIdPresent ? (
                              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mr-2" />
                            )}
                            {status.config.baseIdPresent ? 'Yes' : 'No'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Base ID:</p>
                          <p className="text-sm font-mono mt-1">{status.config.usedBaseId}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Base ID Valid:</p>
                          <p className="flex items-center mt-1">
                            {status.config.baseIdCorrect ? (
                              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mr-2" />
                            )}
                            {status.config.baseIdCorrect ? 'Yes' : 'No'}
                          </p>
                        </div>
                      </div>

                      {status.config.error && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Configuration Error</AlertTitle>
                          <AlertDescription>{status.config.error}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      API Connection
                      {status.apiConnection.tablesAccess?.success ? (
                        <Badge className="bg-green-500 hover:bg-green-600">Connected</Badge>
                      ) : (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">Metadata API Status:</p>
                          <p className="text-sm mt-1">
                            {status.apiConnection.status === 200 ? (
                              <span className="text-green-600">{status.apiConnection.status}</span>
                            ) : (
                              <span className="text-amber-600">{status.apiConnection.status}</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Data API Status:</p>
                          <p className="text-sm mt-1">
                            {status.apiConnection.tablesAccess?.success ? (
                              <span className="text-green-600">200 (OK)</span>
                            ) : (
                              <span className="text-red-600">Failed</span>
                            )}
                          </p>
                        </div>
                      </div>

                      {status.apiConnection.error && (
                        <Alert variant={status.apiConnection.tablesAccess?.success ? "default" : "destructive"}>
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Metadata API Error</AlertTitle>
                          <AlertDescription>
                            <div className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-40">
                              {status.apiConnection.error}
                            </div>
                            {status.apiConnection.tablesAccess?.success && (
                              <p className="mt-2 font-medium text-amber-600">
                                Note: This is a permission issue with the metadata API only. Table data access is working correctly, which is what matters for application functionality.
                              </p>
                            )}
                          </AlertDescription>
                        </Alert>
                      )}

                      {status.apiConnection.tablesAccess && (
                        <div className="mt-2">
                          <h3 className="text-md font-medium mb-2">Tables Status</h3>
                          <Accordion type="single" collapsible className="w-full">
                            {Object.entries(status.apiConnection.tablesAccess.tables).map(([tableName, tableStatus]) => (
                              <AccordionItem key={tableName} value={tableName}>
                                <AccordionTrigger className="flex items-center justify-between py-2">
                                  <div className="flex items-center">
                                    {tableName}
                                    {tableStatus.success ? (
                                      <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-500 ml-2" />
                                    )}
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="px-2 py-2 bg-gray-50 rounded-md dark:bg-gray-800">
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <p className="font-medium">Status Code:</p>
                                        <p>{tableStatus.status}</p>
                                      </div>
                                      <div>
                                        <p className="font-medium">Has Records:</p>
                                        <p className="flex items-center">
                                          {tableStatus.hasRecords ? (
                                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                                          ) : (
                                            <XCircle className="h-4 w-4 text-red-500 mr-2" />
                                          )}
                                          {tableStatus.hasRecords ? 'Yes' : 'No'}
                                        </p>
                                      </div>
                                    </div>
                                    {tableStatus.error && (
                                      <Alert variant="destructive" className="mt-2">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>
                                          <div className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-20">
                                            {tableStatus.error}
                                          </div>
                                        </AlertDescription>
                                      </Alert>
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            ))}
                          </Accordion>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg flex items-center justify-between">
                      MCP Server Status
                      {status.mcpServer.running ? (
                        <Badge className="bg-green-500 hover:bg-green-600">Running</Badge>
                      ) : (
                        <Badge variant="destructive">Not Running</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {status.mcpServer.status ? (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="details">
                          <AccordionTrigger>Server Details</AccordionTrigger>
                          <AccordionContent>
                            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto max-h-60">
                              <pre className="text-xs">
                                {JSON.stringify(status.mcpServer.status, null, 2)}
                              </pre>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ) : (
                      <p>No MCP server information available</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex justify-center items-center h-40">
                <RefreshCw className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading status information...</span>
              </div>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </CardFooter>
    </Card>
  );
}