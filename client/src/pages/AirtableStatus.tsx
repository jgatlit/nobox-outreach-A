import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, RefreshCw, XCircle } from "lucide-react";

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

interface ConnectionTestResult {
  success: boolean;
  baseId: string;
  meta: {
    status: number;
    success: boolean;
    error?: string;
  };
  data: {
    status: number;
    success: boolean;
    error?: string;
  };
}

export default function AirtableStatus() {
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [status, setStatus] = useState<AirtableStatus | null>(null);
  const [connectionTest, setConnectionTest] = useState<ConnectionTestResult | null>(null);
  const { toast } = useToast();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/airtable/diagnostics');
      const data = await response.json();
      
      if (data.success && data.diagnostics) {
        setStatus(data.diagnostics);
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

  const testConnection = async () => {
    setTestLoading(true);
    try {
      const response = await fetch('/api/airtable/test-connection');
      const data = await response.json();
      
      setConnectionTest(data);
    } catch (error) {
      console.error('Error testing Airtable connection:', error);
      toast({
        title: 'Error',
        description: 'Failed to test Airtable connection. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setTestLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusBadge = (success: boolean) => {
    if (success) {
      return <Badge className="bg-green-500 hover:bg-green-600">Success</Badge>;
    }
    return <Badge variant="destructive">Failed</Badge>;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Airtable Integration Status</h1>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={fetchStatus}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="default"
            onClick={testConnection}
            disabled={testLoading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${testLoading ? 'animate-spin' : ''}`} />
            Test Connection
          </Button>
        </div>
      </div>

      {status ? (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Configuration Status
                {status.config.isConfigured ? (
                  <Badge className="bg-green-500 hover:bg-green-600">Configured</Badge>
                ) : (
                  <Badge variant="destructive">Not Configured</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Status of Airtable environment configuration
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    <p className="text-sm font-medium">Base ID Correct:</p>
                    <p className="flex items-center mt-1">
                      {status.config.baseIdCorrect ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 mr-2" />
                      )}
                      {status.config.baseIdCorrect ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Used Base ID:</p>
                    <p className="text-sm font-mono mt-1">{status.config.usedBaseId}</p>
                  </div>
                </div>

                {status.config.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{status.config.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                MCP Server Status
                {status.mcpServer.running ? (
                  <Badge className="bg-green-500 hover:bg-green-600">Running</Badge>
                ) : (
                  <Badge variant="destructive">Not Running</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Status of the Airtable MCP server process
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status.mcpServer.status ? (
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="details">
                    <AccordionTrigger>Server Details</AccordionTrigger>
                    <AccordionContent>
                      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto max-h-80">
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                API Connection Status
                {status.apiConnection.isSuccess ? (
                  <Badge className="bg-green-500 hover:bg-green-600">Connected</Badge>
                ) : (
                  <Badge variant="destructive">Disconnected</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Status of the Airtable API connection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Status Code:</p>
                    <p className="text-sm mt-1">{status.apiConnection.status}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Success:</p>
                    <p className="flex items-center mt-1">
                      {status.apiConnection.isSuccess ? (
                        <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 mr-2" />
                      )}
                      {status.apiConnection.isSuccess ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>

                {status.apiConnection.error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>
                      <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md overflow-auto max-h-40">
                        <pre className="text-xs whitespace-pre-wrap">
                          {status.apiConnection.error}
                        </pre>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                {status.apiConnection.tablesAccess && (
                  <div className="mt-4">
                    <h3 className="text-lg font-medium mb-2">Tables Access Status</h3>
                    <div className="grid gap-4">
                      {Object.entries(status.apiConnection.tablesAccess.tables).map(([tableName, tableStatus]) => (
                        <Card key={tableName}>
                          <CardHeader className="py-3">
                            <CardTitle className="text-md flex items-center justify-between">
                              {tableName}
                              {getStatusBadge(tableStatus.success)}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="py-2">
                            <div className="grid grid-cols-2 gap-4 text-sm">
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
                                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md overflow-auto max-h-20">
                                    <pre className="text-xs whitespace-pre-wrap">
                                      {tableStatus.error}
                                    </pre>
                                  </div>
                                </AlertDescription>
                              </Alert>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex justify-center items-center h-64">
          <div className="flex flex-col items-center">
            <RefreshCw className="h-8 w-8 animate-spin mb-4" />
            <p className="text-lg">Loading Airtable status...</p>
          </div>
        </div>
      )}

      {connectionTest && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Connection Test Results
              {connectionTest.meta.success || connectionTest.data.success ? (
                <Badge className="bg-green-500 hover:bg-green-600">Success</Badge>
              ) : (
                <Badge variant="destructive">Failed</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Results from direct API connection test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <div>
                <p className="text-sm font-medium">Base ID:</p>
                <p className="text-sm font-mono mt-1">{connectionTest.baseId}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-md flex items-center justify-between">
                      Meta API
                      {getStatusBadge(connectionTest.meta.success)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <p className="text-sm font-medium">Status Code: {connectionTest.meta.status}</p>
                    {connectionTest.meta.error && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                          <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md overflow-auto max-h-40">
                            <pre className="text-xs whitespace-pre-wrap">
                              {connectionTest.meta.error}
                            </pre>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-md flex items-center justify-between">
                      Data API
                      {getStatusBadge(connectionTest.data.success)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-2">
                    <p className="text-sm font-medium">Status Code: {connectionTest.data.status}</p>
                    {connectionTest.data.error && (
                      <Alert variant="destructive" className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                          <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-md overflow-auto max-h-40">
                            <pre className="text-xs whitespace-pre-wrap">
                              {connectionTest.data.error}
                            </pre>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t pt-6">
            <p className="text-sm text-gray-500">
              Test conducted at: {new Date().toLocaleString()}
            </p>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}