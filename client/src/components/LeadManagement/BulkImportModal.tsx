import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, FileSpreadsheet, Upload, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ImportResult {
  success: boolean;
  message: string;
  results: {
    totalRows: number;
    processed: number;
    inserted: number;
    duplicates: number;
    transformationErrors: number;
    dbErrors: number;
    errorDetails: {
      transformation: string[];
      database: string[];
    };
  };
}

export function BulkImportModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [importResult, setImportResult] = React.useState<ImportResult | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Direct CSV import mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      // Use fetch directly for longer timeout support (5 minutes for large CSV processing)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
      
      try {
        const response = await fetch("/api/leads/import/csv", {
          method: "POST",
          body: formData,
          credentials: "include",
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const text = await response.text() || response.statusText;
          throw new Error(`${response.status}: ${text}`);
        }
        
        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    },
    // Set timeout for React Query to 6 minutes (longer than fetch timeout)
    meta: {
      timeout: 360000,
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      
      const { results } = data;
      const hasErrors = results.transformationErrors > 0 || results.dbErrors > 0;
      
      if (data.success) {
        if (results.inserted > 0 && !hasErrors) {
          // Complete success
          toast({
            title: "Import Successful",
            description: `Successfully imported ${results.inserted} leads`,
          });
        } else if (results.inserted > 0 && hasErrors) {
          // Partial success
          toast({
            title: "Import Partially Successful",
            description: `Imported ${results.inserted} leads with ${results.transformationErrors + results.dbErrors} warnings/errors`,
            variant: "default",
          });
        } else {
          // Success but no imports
          toast({
            title: "Import Complete",
            description: data.message + (results.duplicates > 0 ? ` (${results.duplicates} duplicates skipped)` : ''),
          });
        }
      } else {
        toast({
          title: "Import Issues",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("Import error:", error);
      
      // Check if it's a timeout error
      if (error.name === 'AbortError' || error.message?.includes('timeout')) {
        toast({
          title: "Import May Still Be Processing",
          description: "The import is taking longer than expected. Please check the lead count in a moment - your import may have succeeded.",
          variant: "default",
        });
      } else if (error.response?.data?.error) {
        // Server returned an error message
        toast({
          title: "Import Failed",
          description: error.response.data.error,
          variant: "destructive",
        });
      } else if (error.message) {
        // Network or other error
        toast({
          title: "Import Failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Unknown error
        toast({
          title: "Import Failed",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = () => {
    if (!selectedFile) return;
    importMutation.mutate(selectedFile);
  };

  const resetModal = () => {
    setSelectedFile(null);
    setImportResult(null);
    setIsOpen(false);
  };

  const renderImportResult = () => {
    if (!importResult) return null;

    const { results } = importResult;
    const hasErrors = results.transformationErrors > 0 || results.dbErrors > 0;

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Processed: {results.processed}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Imported: {results.inserted}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <span>Duplicates: {results.duplicates}</span>
            </div>
            {hasErrors && (
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span>Errors: {results.transformationErrors + results.dbErrors}</span>
              </div>
            )}
          </div>
        </div>

        {results.inserted > 0 && (
          <Progress 
            value={(results.inserted / results.totalRows) * 100} 
            className="h-2"
          />
        )}

        {hasErrors && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Error Details:</h4>
            {results.errorDetails.transformation.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Data Processing Errors</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1 text-xs">
                    {results.errorDetails.transformation.slice(0, 3).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {results.errorDetails.transformation.length > 3 && (
                      <li>... and {results.errorDetails.transformation.length - 3} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {results.errorDetails.database.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Database Errors</AlertTitle>
                <AlertDescription>
                  <ul className="mt-2 space-y-1 text-xs">
                    {results.errorDetails.database.slice(0, 3).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {results.errorDetails.database.length > 3 && (
                      <li>... and {results.errorDetails.database.length - 3} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
          <DialogDescription>
            Upload your CSV file and our AI will intelligently map the columns to lead fields.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!selectedFile && (
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Drag and drop your CSV file here
                </p>
                <p className="text-xs text-gray-500">or</p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-file"
                />
                <label htmlFor="csv-file">
                  <Button variant="outline" size="sm" asChild>
                    <span>Choose CSV File</span>
                  </Button>
                </label>
              </div>
            </div>
          )}

          {selectedFile && !importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 border rounded-lg">
                <FileSpreadsheet className="w-8 h-8 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Ready to Import</AlertTitle>
                <AlertDescription>
                  Our AI will automatically detect and map your CSV columns to lead fields. 
                  The system handles various formats including ZoomInfo, LinkedIn Sales Navigator, and custom exports.
                  Large files (50+ records) may take 2-3 minutes to process.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {importResult && renderImportResult()}

          {importMutation.isPending && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing CSV with AI intelligence... Large files may take 2-3 minutes.</span>
              </div>
              <Progress value={undefined} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={resetModal}>
            {importResult ? "Done" : "Cancel"}
          </Button>
          {selectedFile && !importResult && (
            <Button 
              onClick={handleImport}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                "Import Leads"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}