import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { SheetIcon, FileSpreadsheetIcon, TableIcon, CheckCircleIcon, AlertCircleIcon, ArrowRightIcon } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

// Import assistant components
import { GoogleSheetsImportAssistant } from '@/components/GoogleSheetsImportAssistant';

const leadFieldOptions = [
  { label: 'First Name', value: 'firstName' },
  { label: 'Last Name', value: 'lastName' },
  { label: 'Email', value: 'email' },
  { label: 'Company', value: 'company' },
  { label: 'Title', value: 'title' },
  { label: 'Phone Number', value: 'phoneNumber' },
  { label: 'Website', value: 'website' },
  { label: 'LinkedIn URL', value: 'linkedinUrl' },
  { label: 'Priority', value: 'priority' },
  { label: 'Status', value: 'status' },
  { label: 'Tags', value: 'tags' },
  { label: 'Notes', value: 'notes' },
  { label: 'Last Contact Date', value: 'lastContactDate' },
];

export default function GoogleSheetsImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State
  const [url, setUrl] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [selectedSheet, setSelectedSheet] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [isValidating, setIsValidating] = useState(false);
  const [importStep, setImportStep] = useState(1);
  const [importProgress, setImportProgress] = useState(0);
  
  // Queries
  const validateMutation = useMutation({
    mutationFn: async (url: string) => {
      setIsValidating(true);
      try {
        const response = await apiRequest('POST', '/api/sheets/validate', { url });
        
        if (!response.success) {
          throw new Error(response.message);
        }
        
        return response;
      } finally {
        setIsValidating(false);
      }
    },
    onSuccess: (data) => {
      setSheetId(data.spreadsheetId);
      if (data.workbookInfo.sheets.length > 0) {
        setSelectedSheet(data.workbookInfo.sheets[0].name);
      }
      setImportStep(2);
    },
    onError: (error: Error) => {
      toast({
        title: 'Validation Error',
        description: error.message || 'Failed to validate Google Sheet URL',
        variant: 'destructive',
      });
    },
  });
  
  const importMutation = useMutation({
    mutationFn: async () => {
      setImportProgress(10);
      try {
        const response = await apiRequest('POST', '/api/sheets/import', {
          spreadsheetId: sheetId,
          sheetName: selectedSheet,
          columnMapping,
        });
        
        if (!response.success) {
          throw new Error(response.message);
        }
        
        return response.results;
      } finally {
        setImportProgress(100);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/leads'] });
      
      toast({
        title: 'Import Successful',
        description: `Imported ${data.imported} leads. Skipped ${data.skipped} duplicates. ${data.errors} errors.`,
      });
      
      setImportStep(4);
    },
    onError: (error: Error) => {
      toast({
        title: 'Import Error',
        description: error.message || 'Failed to import leads from Google Sheet',
        variant: 'destructive',
      });
    },
  });
  
  const { data: workbookInfo } = useQuery({
    queryKey: ['sheets', sheetId],
    queryFn: async () => {
      if (!sheetId) return null;
      
      const response = await apiRequest('POST', '/api/sheets/validate', { 
        url: sheetId 
      });
      
      if (!response.success) {
        throw new Error(response.message);
      }
      
      return response.workbookInfo;
    },
    enabled: !!sheetId,
  });
  
  // Functions
  const handleValidate = () => {
    if (!url) {
      toast({
        title: 'Input Required',
        description: 'Please enter a Google Sheets URL',
        variant: 'destructive',
      });
      return;
    }
    
    validateMutation.mutate(url);
  };
  
  const handleSelectSheet = (sheetName: string) => {
    setSelectedSheet(sheetName);
    // Reset column mapping when sheet changes
    setColumnMapping({});
  };
  
  const handleColumnMapping = (leadField: string, sheetColumn: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [leadField]: sheetColumn,
    }));
  };
  
  const handleImport = () => {
    // Validate that we have at least email mapped
    if (!columnMapping.email) {
      toast({
        title: 'Mapping Required',
        description: 'Email field must be mapped to import leads',
        variant: 'destructive',
      });
      return;
    }
    
    setImportStep(3);
    importMutation.mutate();
  };
  
  const getSelectedSheetData = () => {
    if (!workbookInfo || !selectedSheet) return null;
    return workbookInfo.sheets.find(sheet => sheet.name === selectedSheet);
  };
  
  // Render
  return (
    <div className="container py-8">
      <div className="flex items-center gap-4 mb-6">
        <SheetIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Google Sheets Import</h1>
          <p className="text-muted-foreground">Import leads from Google Sheets</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Import from Google Sheets</CardTitle>
              <CardDescription>
                Follow the steps below to import leads from a Google Sheet
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center mb-8">
                <div className={`flex items-center justify-center ${importStep >= 1 ? 'bg-primary' : 'bg-muted'} text-white w-8 h-8 rounded-full`}>
                  1
                </div>
                <div className="h-0.5 w-12 bg-muted mx-2"></div>
                <div className={`flex items-center justify-center ${importStep >= 2 ? 'bg-primary' : 'bg-muted'} text-white w-8 h-8 rounded-full`}>
                  2
                </div>
                <div className="h-0.5 w-12 bg-muted mx-2"></div>
                <div className={`flex items-center justify-center ${importStep >= 3 ? 'bg-primary' : 'bg-muted'} text-white w-8 h-8 rounded-full`}>
                  3
                </div>
                <div className="h-0.5 w-12 bg-muted mx-2"></div>
                <div className={`flex items-center justify-center ${importStep >= 4 ? 'bg-primary' : 'bg-muted'} text-white w-8 h-8 rounded-full`}>
                  4
                </div>
              </div>
              
              {/* Step 1: Enter Google Sheets URL */}
              {importStep === 1 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Step 1: Enter Google Sheets URL</h3>
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label htmlFor="sheets-url">Google Sheets URL</Label>
                      <div className="flex gap-2">
                        <Input
                          id="sheets-url"
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                        />
                        <Button onClick={handleValidate} disabled={isValidating}>
                          {isValidating ? 'Validating...' : 'Validate'}
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Enter the URL of your Google Sheet. Make sure it's publicly accessible or shared with the service account.
                      </p>
                    </div>
                    
                    <Alert>
                      <FileSpreadsheetIcon className="h-4 w-4" />
                      <AlertTitle>Requirements</AlertTitle>
                      <AlertDescription>
                        Your Google Sheet must have a header row with column names. The sheet must be publicly accessible or shared with the appropriate permissions.
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>
              )}
              
              {/* Step 2: Map Fields */}
              {importStep === 2 && workbookInfo && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Step 2: Map Columns</h3>
                  
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      <Label>Select Sheet</Label>
                      <Select value={selectedSheet} onValueChange={handleSelectSheet}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a sheet" />
                        </SelectTrigger>
                        <SelectContent>
                          {workbookInfo.sheets.map((sheet) => (
                            <SelectItem key={sheet.sheetId} value={sheet.name}>
                              {sheet.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Map Fields</h4>
                        <p className="text-sm text-muted-foreground mb-4">
                          Match your Google Sheet columns to lead fields. Email is required.
                        </p>
                      </div>
                      
                      <div className="grid gap-3">
                        {leadFieldOptions.map((fieldOption) => {
                          const isRequired = fieldOption.value === 'email';
                          return (
                            <div key={fieldOption.value} className="grid grid-cols-2 gap-2 items-center">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`map-${fieldOption.value}`} className="mb-0">
                                  {fieldOption.label}
                                </Label>
                                {isRequired && (
                                  <Badge variant="destructive" className="text-xs">Required</Badge>
                                )}
                              </div>
                              
                              <Select 
                                value={columnMapping[fieldOption.value] || ''} 
                                onValueChange={(value) => handleColumnMapping(fieldOption.value, value)}
                              >
                                <SelectTrigger id={`map-${fieldOption.value}`}>
                                  <SelectValue placeholder="Select a column" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="">Not mapped</SelectItem>
                                  {getSelectedSheetData()?.columns.map((column) => (
                                    <SelectItem key={column} value={column}>
                                      {column}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    <Separator />
                    
                    <div>
                      <h4 className="font-medium mb-2">Preview Data</h4>
                      <div className="border rounded-md overflow-auto max-h-60">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {getSelectedSheetData()?.columns.map((column) => (
                                <TableHead key={column} className="whitespace-nowrap">
                                  {column}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {getSelectedSheetData()?.previewData.map((row, rowIndex) => (
                              <TableRow key={rowIndex}>
                                {getSelectedSheetData()?.columns.map((column) => (
                                  <TableCell key={column} className="whitespace-nowrap">
                                    {row[column]}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Showing preview of up to 5 rows
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Step 3: Importing */}
              {importStep === 3 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Step 3: Importing Leads</h3>
                  
                  <div className="space-y-6">
                    <GoogleSheetsImportProgress progress={importProgress} />
                    
                    <div className="flex items-center justify-center p-8">
                      <div className="text-center">
                        <TableIcon className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
                        <h3 className="text-lg font-medium">Importing leads...</h3>
                        <p className="text-muted-foreground">
                          Please wait while we import your leads from Google Sheets
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Step 4: Complete */}
              {importStep === 4 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Step 4: Import Complete</h3>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-center p-8">
                      <div className="text-center">
                        <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-medium">Import Completed</h3>
                        <p className="text-muted-foreground">
                          {importMutation.data?.imported} leads were successfully imported.
                          {importMutation.data?.skipped > 0 && ` ${importMutation.data.skipped} duplicates were skipped.`}
                          {importMutation.data?.errors > 0 && ` ${importMutation.data.errors} errors occurred.`}
                        </p>
                      </div>
                    </div>
                    
                    {importMutation.data?.errorDetails && importMutation.data.errorDetails.length > 0 && (
                      <Alert variant="destructive">
                        <AlertCircleIcon className="h-4 w-4" />
                        <AlertTitle>Import Errors</AlertTitle>
                        <AlertDescription>
                          <ul className="list-disc pl-4 mt-2 space-y-1">
                            {importMutation.data.errorDetails.slice(0, 5).map((error, i) => (
                              <li key={i} className="text-sm">{error}</li>
                            ))}
                            {importMutation.data.errorDetails.length > 5 && (
                              <li className="text-sm">...and {importMutation.data.errorDetails.length - 5} more errors</li>
                            )}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                </div>
              )}
              
            </CardContent>
            <CardFooter className="flex justify-between border-t p-6">
              <Button variant="outline" asChild>
                <Link href="/leads">Cancel</Link>
              </Button>
              
              <div className="flex gap-2">
                {importStep > 1 && importStep < 4 && (
                  <Button variant="outline" onClick={() => setImportStep(importStep - 1)} disabled={importStep === 3}>
                    Back
                  </Button>
                )}
                
                {importStep === 1 && (
                  <Button onClick={handleValidate} disabled={isValidating || !url}>
                    {isValidating ? 'Validating...' : 'Validate & Continue'}
                  </Button>
                )}
                
                {importStep === 2 && (
                  <Button onClick={handleImport} disabled={!columnMapping.email}>
                    Import Leads
                  </Button>
                )}
                
                {importStep === 4 && (
                  <Button asChild>
                    <Link href="/leads">
                      View Leads <ArrowRightIcon className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
        
        <div className="lg:col-span-1">
          <GoogleSheetsImportAssistant importStep={importStep} />
        </div>
      </div>
    </div>
  );
}