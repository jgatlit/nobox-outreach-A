import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileUp, CheckCircle2, AlertCircle, Database, Mail } from 'lucide-react';

interface ImportHistoricalDataFormProps {
  leadId: number;
}

export function ImportHistoricalDataForm({ leadId }: ImportHistoricalDataFormProps) {
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importType, setImportType] = useState<'asana' | 'gmail'>('asana');

  const handleImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsImporting(true);
    setImportSuccess(false);
    setImportError(null);

    const formData = new FormData(event.currentTarget);
    const file = formData.get('file') as File;

    if (!file || file.size === 0) {
      setImportError('Please select a file to upload');
      setIsImporting(false);
      return;
    }

    try {
      const endpoint = `/api/leads/${leadId}/import/${importType}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import data');
      }

      setImportSuccess(true);
      setImportError(null);

      // Invalidate query to refresh lead data
      await queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] });
    } catch (error) {
      console.error('Import error:', error);
      setImportError((error as Error).message || 'Failed to import data');
      setImportSuccess(false);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="asana" onValueChange={(value) => setImportType(value as 'asana' | 'gmail')}>
        <TabsList className="mb-4">
          <TabsTrigger value="asana">
            <Database className="h-4 w-4 mr-2" />
            Asana Projects
          </TabsTrigger>
          <TabsTrigger value="gmail">
            <Mail className="h-4 w-4 mr-2" />
            Email History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="asana">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleImport}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="asana-file">Upload Asana Project Data</Label>
                    <div className="mt-1 text-sm text-neutral-500 mb-2">
                      Upload your Asana project history as CSV, JSON, XML, or Markdown file
                    </div>
                    <Input 
                      id="asana-file" 
                      name="file" 
                      type="file" 
                      accept=".csv,.json,.xml,.md" 
                      disabled={isImporting}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isImporting}>
                      {isImporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <FileUp className="mr-2 h-4 w-4" />
                          Import Asana Data
                        </>
                      )}
                    </Button>
                  </div>

                  {importSuccess && importType === 'asana' && (
                    <Alert className="mt-4 bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800">Success</AlertTitle>
                      <AlertDescription className="text-green-700">
                        Asana project data imported successfully.
                      </AlertDescription>
                    </Alert>
                  )}

                  {importError && importType === 'asana' && (
                    <Alert className="mt-4 bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertTitle className="text-red-800">Error</AlertTitle>
                      <AlertDescription className="text-red-700">
                        {importError}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gmail">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleImport}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="gmail-file">Upload Email History Data</Label>
                    <div className="mt-1 text-sm text-neutral-500 mb-2">
                      Upload your email exchange history as CSV, JSON, XML, or Markdown file
                    </div>
                    <Input 
                      id="gmail-file" 
                      name="file" 
                      type="file" 
                      accept=".csv,.json,.xml,.md" 
                      disabled={isImporting}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isImporting}>
                      {isImporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <FileUp className="mr-2 h-4 w-4" />
                          Import Email Data
                        </>
                      )}
                    </Button>
                  </div>

                  {importSuccess && importType === 'gmail' && (
                    <Alert className="mt-4 bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800">Success</AlertTitle>
                      <AlertDescription className="text-green-700">
                        Email history data imported successfully.
                      </AlertDescription>
                    </Alert>
                  )}

                  {importError && importType === 'gmail' && (
                    <Alert className="mt-4 bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertTitle className="text-red-800">Error</AlertTitle>
                      <AlertDescription className="text-red-700">
                        {importError}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}