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
import { 
  AlertCircle, 
  ChevronDown, 
  Database, 
  FileQuestion, 
  FileSpreadsheet, 
  FileText, 
  Mail, 
  Upload, 
  X,
  Table,
  Clipboard
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function BulkImportModal() {
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [csvContent, setCsvContent] = React.useState('');
  const [spreadsheetId, setSpreadsheetId] = React.useState('');
  const [sheetsApiKey, setSheetsApiKey] = React.useState('');
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [activeTab, setActiveTab] = React.useState<'file' | 'paste' | 'sheets'>('file');
  const [importResult, setImportResult] = React.useState<{
    success: boolean;
    message: string;
    imported: number;
    duplicates: number;
    errors: number;
    errorDetails?: string[];
  } | null>(null);
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Reset state when dialog is closed
  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setCsvContent('');
      setSpreadsheetId('');
      setSheetsApiKey('');
      setImportResult(null);
      setUploadProgress(0);
      setActiveTab('file');
    }
  }, [open]);
  
  // Simulate progress during upload
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isUploading && uploadProgress < 90) {
      interval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 300);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isUploading, uploadProgress]);
  
  // File upload mutation
  const fileImportMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      setIsUploading(true);
      setUploadProgress(0);
      try {
        const response = await apiRequest(
          "POST", 
          "/api/leads/import/csv", 
          formData, 
          { isFormData: true }
        );
        const result = await response.json();
        setUploadProgress(100);
        return result;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: (data) => {
      setImportResult(data);
      
      if (data.success) {
        toast({
          title: "Import completed",
          description: `Successfully imported ${data.imported} leads`,
        });
        // Invalidate leads query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else {
        toast({
          title: "Import partially completed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error.message || "There was an error importing leads",
        variant: "destructive",
      });
    },
  });
  
  // CSV paste mutation
  const csvPasteMutation = useMutation({
    mutationFn: async (csvContent: string) => {
      setIsUploading(true);
      setUploadProgress(0);
      try {
        const response = await apiRequest(
          "POST", 
          "/api/leads/import/csv-paste", 
          { csvContent }
        );
        const result = await response.json();
        setUploadProgress(100);
        return result;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: (data) => {
      setImportResult(data);
      
      if (data.success) {
        toast({
          title: "Import completed",
          description: `Successfully imported ${data.imported} leads`,
        });
        // Invalidate leads query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else {
        toast({
          title: "Import partially completed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error.message || "There was an error importing leads",
        variant: "destructive",
      });
    },
  });
  
  // Google Sheets import mutation
  const googleSheetsImportMutation = useMutation({
    mutationFn: async (data: { spreadsheetId: string, apiKey: string }) => {
      setIsUploading(true);
      setUploadProgress(0);
      try {
        const response = await apiRequest(
          "POST", 
          "/api/leads/import/google-sheet", 
          data
        );
        const result = await response.json();
        setUploadProgress(100);
        return result;
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: (data) => {
      setImportResult(data);
      
      if (data.success) {
        toast({
          title: "Import completed",
          description: `Successfully imported ${data.imported} leads from Google Sheet`,
        });
        // Invalidate leads query to refresh the list
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else {
        toast({
          title: "Import partially completed",
          description: data.message,
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error.message || "There was an error importing leads from Google Sheet",
        variant: "destructive",
      });
    },
  });
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      // Validate file type
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        toast({
          title: "Invalid file type",
          description: "Please select a CSV file",
          variant: "destructive",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };
  
  const handleImport = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to import",
        variant: "destructive",
      });
      return;
    }
    
    const formData = new FormData();
    formData.append("file", file);
    
    importMutation.mutate(formData);
  };
  
  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const downloadTemplate = (templateName: 'leads' | 'gmail' | 'asana' | 'proposals' | 'readme') => {
    // Download template from API
    let endpoint = '';
    let filename = '';
    
    if (templateName === 'readme') {
      endpoint = '/api/templates/csv/readme';
      filename = 'csv_import_instructions.md';
    } else {
      endpoint = `/api/templates/csv/${templateName}`;
      filename = `${templateName}_import_template.csv`;
    }
    
    // Create download anchor and trigger it
    const a = document.createElement('a');
    a.href = endpoint;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-white text-black border border-gray-200 hover:bg-gray-50">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Import Leads from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file containing multiple leads to import them in bulk.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 my-4">
          {!importResult ? (
            <>
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => downloadTemplate('leads')}
                    size="sm"
                  >
                    Download Template
                  </Button>
                  
                  <div className="relative">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-56">
                        <DropdownMenuLabel>CSV Templates</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => downloadTemplate('leads')}>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          <span>Leads Template</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadTemplate('gmail')}>
                          <Mail className="mr-2 h-4 w-4" />
                          <span>Email History Template</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadTemplate('asana')}>
                          <Database className="mr-2 h-4 w-4" />
                          <span>Asana Projects Template</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => downloadTemplate('proposals')}>
                          <FileText className="mr-2 h-4 w-4" />
                          <span>Proposals Template</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => downloadTemplate('readme')}>
                          <FileQuestion className="mr-2 h-4 w-4" />
                          <span>Import Instructions</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  CSV must include email column (required)
                </p>
              </div>
              
              <div className="grid w-full items-center gap-2">
                {file ? (
                  <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-6 w-6 text-primary-500" />
                      <div className="text-sm">
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleRemoveFile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md border-gray-300 dark:border-gray-700">
                    <Input
                      type="file"
                      ref={fileInputRef}
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                      id="csv-file-input"
                    />
                    <label 
                      htmlFor="csv-file-input"
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">Click to upload CSV file</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or drag and drop
                      </p>
                    </label>
                  </div>
                )}
              </div>
              
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <Alert variant={importResult.success ? "default" : "destructive"}>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{importResult.success ? "Success" : "Partial Import"}</AlertTitle>
                <AlertDescription>{importResult.message}</AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 border rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{importResult.imported}</p>
                  <p className="text-sm text-muted-foreground">Imported</p>
                </div>
                <div className="p-4 border rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{importResult.duplicates}</p>
                  <p className="text-sm text-muted-foreground">Duplicates</p>
                </div>
                <div className="p-4 border rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{importResult.errors}</p>
                  <p className="text-sm text-muted-foreground">Errors</p>
                </div>
              </div>
              
              {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium mb-2">Error Details:</p>
                  <div className="max-h-60 overflow-y-auto text-sm bg-muted/30 p-2 rounded-md">
                    {importResult.errorDetails.map((error, index) => {
                      // Extract more user-friendly error messages
                      let displayError = error;
                      
                      // Make validation errors more readable
                      if (error.includes('Invalid url')) {
                        const field = error.includes('website') ? 'Website' : 
                                    error.includes('linkedinUrl') ? 'LinkedIn URL' : 'URL';
                        displayError = `${field} format is invalid. Please ensure it's a complete URL with https://`;
                      }
                      else if (error.includes('email')) {
                        displayError = `Email address is invalid or missing (required field).`;
                      }
                      else if (error.includes('source')) {
                        displayError = `Source value is invalid. Valid options: manual, email, pipedrive, asana, instantly, cyberleads, linkedin`;
                      }
                      else if (error.includes('status')) {
                        displayError = `Status value is invalid. Valid options: active, inactive, contacted, responded, qualified, disqualified`;
                      }
                      else if (error.includes('priority')) {
                        displayError = `Priority value is invalid. Valid options: low, medium, high, urgent`;
                      }
                      
                      return (
                        <div key={index} className="py-1 border-b border-muted last:border-0">
                          {displayError}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-1">Common Import Tips</h4>
                    <ul className="list-disc pl-5 text-xs text-amber-700 dark:text-amber-400 space-y-1">
                      <li>Email field is required and must be a valid email format</li>
                      <li>Website and LinkedIn URLs should include https:// (we'll try to add this automatically)</li>
                      <li>Use valid values for source, status, and priority fields</li>
                      <li>Multiple tags should be comma-separated in a single field</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => setOpen(false)}
          >
            {importResult ? "Close" : "Cancel"}
          </Button>
          
          {!importResult && (
            <Button 
              type="button" 
              onClick={handleImport}
              disabled={!file || isUploading || importMutation.isPending}
            >
              {isUploading ? "Importing..." : "Import"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
