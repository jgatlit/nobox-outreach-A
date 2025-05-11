import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle, XCircle, AlertCircle, Table, Key } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface GoogleSheetsConfig {
  apiKeyPresent: boolean;
  isConfigured: boolean;
  error?: string;
}

interface GoogleSheetsStatus {
  config: GoogleSheetsConfig;
}

interface GoogleSheetsStatusTileProps {
  className?: string;
}

export function GoogleSheetsStatusTile({ className }: GoogleSheetsStatusTileProps) {
  const [loading, setLoading] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [status, setStatus] = useState<GoogleSheetsStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const { toast } = useToast();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      // This is a mock implementation until the backend endpoint is created
      // In a real implementation, we would fetch from '/api/google-sheets/status'
      
      // Check if the API key is stored in localStorage for demo purposes
      const storedApiKey = localStorage.getItem('GOOGLE_SHEETS_API_KEY');
      
      // Simulate a response
      const mockStatus: GoogleSheetsStatus = {
        config: {
          apiKeyPresent: !!storedApiKey,
          isConfigured: !!storedApiKey,
        }
      };
      
      setStatus(mockStatus);
    } catch (error) {
      console.error('Error fetching Google Sheets status:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch Google Sheets status. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveApiKey = async () => {
    setConfiguring(true);
    try {
      // In a real implementation, we would POST to '/api/google-sheets/config'
      // For now, store in localStorage for demo purposes
      if (apiKey) {
        localStorage.setItem('GOOGLE_SHEETS_API_KEY', apiKey);
        toast({
          title: 'API Key Saved',
          description: 'Google Sheets API key has been saved successfully.',
        });
        
        // Refresh status
        await fetchStatus();
      } else {
        // Remove API key if field is empty
        localStorage.removeItem('GOOGLE_SHEETS_API_KEY');
        toast({
          title: 'API Key Removed',
          description: 'Google Sheets API key has been removed.',
        });
        
        // Refresh status
        await fetchStatus();
      }
      
      // Close config dialog
      setConfiguring(false);
    } catch (error) {
      console.error('Error saving Google Sheets API key:', error);
      toast({
        title: 'Error',
        description: 'Failed to save Google Sheets API key. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setConfiguring(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getStatusBadge = (configured: boolean) => {
    if (configured) {
      return <Badge className="bg-green-500 hover:bg-green-600">Configured</Badge>;
    }
    return <Badge variant="destructive">Not Configured</Badge>;
  };

  const getOverallStatusIcon = () => {
    if (!status) return <RefreshCw className="h-5 w-5 animate-spin text-neutral-500" />;
    
    if (status.config.isConfigured) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Table className="h-10 w-10 text-green-500" />
          {getOverallStatusIcon()}
        </div>
        <CardTitle className="mt-4">Google Sheets</CardTitle>
        <CardDescription>
          External Spreadsheet Integration
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm space-y-2">
          <div className="flex justify-between items-center">
            <span>Status:</span>
            {status ? getStatusBadge(status.config.isConfigured) : <span>Loading...</span>}
          </div>
          <div className="flex justify-between items-center">
            <span>API Key:</span>
            <span>{status?.config.apiKeyPresent ? 'Configured' : 'Not Set'}</span>
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
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Key className="h-4 w-4 mr-2" />
              Configure
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Google Sheets API Configuration</DialogTitle>
              <DialogDescription>
                Enter your Google Sheets API key to enable integration with Google Sheets
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sheets-api-key">Google Sheets API Key</Label>
                <Input 
                  id="sheets-api-key" 
                  type="password" 
                  placeholder="Enter API key" 
                  value={apiKey} 
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This key will be securely stored and used for Google Sheets imports
                </p>
              </div>
              
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Note</AlertTitle>
                <AlertDescription>
                  To create a Google Sheets API key, visit the 
                  <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline ml-1">
                    Google Cloud Console
                  </a>
                </AlertDescription>
              </Alert>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setApiKey('')} disabled={configuring}>
                Clear
              </Button>
              <Button onClick={saveApiKey} disabled={configuring}>
                {configuring ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}