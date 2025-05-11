import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Database, CloudSync } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

export function LeadsSyncStatus() {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch sync status
  const { data: syncStatus, isLoading, refetch } = useQuery({
    queryKey: ['/api/airtable/sync/status'],
    staleTime: 60000,
  });
  
  // Mutation for triggering sync
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/airtable/sync/leads');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Sync completed',
        description: `Lead data has been synchronized with Airtable. ${data.totalSynced} leads synced.`,
      });
      setSyncing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/airtable/sync/status'] });
    },
    onError: (error) => {
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync lead data with Airtable',
        variant: 'destructive',
      });
      setSyncing(false);
    }
  });
  
  const handleSync = () => {
    setSyncing(true);
    syncMutation.mutate();
  };
  
  const formatSyncTime = (time: string | null) => {
    if (!time) return 'Never';
    return new Date(time).toLocaleString();
  };
  
  const getStatusBadge = () => {
    if (isLoading) {
      return <Badge className="bg-gray-500 hover:bg-gray-600">Loading...</Badge>;
    }
    
    if (!syncStatus || !syncStatus.lastSyncSuccess) {
      return <Badge variant="destructive">Not Synced</Badge>;
    }
    
    // Check if last sync was within 10 minutes
    const lastSyncTime = syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).getTime() : 0;
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    
    if (lastSyncTime > tenMinutesAgo) {
      return <Badge className="bg-green-500 hover:bg-green-600">Synced</Badge>;
    }
    
    return <Badge className="bg-yellow-500 hover:bg-yellow-600">Sync Needed</Badge>;
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CloudSync className="h-10 w-10 text-purple-500" />
          {getStatusBadge()}
        </div>
        <CardTitle className="mt-4">Leads Sync</CardTitle>
        <CardDescription>
          Two-way synchronization with Airtable
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm space-y-2">
          <div className="flex justify-between items-center">
            <span>Last sync:</span>
            <span>{formatSyncTime(syncStatus?.lastSyncTime)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Records synced:</span>
            <span>{syncStatus?.totalSynced || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Status:</span>
            <span>{syncStatus?.lastSyncSuccess ? 'Successful' : 'Failed'}</span>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </CardFooter>
    </Card>
  );
}