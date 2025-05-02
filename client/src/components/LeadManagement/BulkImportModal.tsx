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
import { AlertCircle, FileSpreadsheet, Upload, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function BulkImportModal() {
  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
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
      setImportResult(null);
      setUploadProgress(0);
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
  
  const importMutation = useMutation({
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
  
  const downloadSampleTemplate = () => {
    // Create sample CSV content
    const headers = "firstName,lastName,email,company,title,phone,website,linkedin,twitter,source,status,priority,notes";
    const sampleData = [
      "John,Doe,john.doe@example.com,Acme Inc.,CEO,+1234567890,https://acme.com,https://linkedin.com/in/johndoe,@johndoe,manual,active,medium,Initial contact made at conference",
      "Jane,Smith,jane.smith@example.com,Tech Corp,CTO,+0987654321,https://techcorp.com,https://linkedin.com/in/janesmith,@janesmith,manual,active,high,Interested in our new product"
    ].join("\n");
    const csvContent = `${headers}\n${sampleData}`;
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("href", url);
    a.setAttribute("download", "lead_import_template.csv");
    a.click();
    URL.revokeObjectURL(url);
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary-600 text-white hover:bg-primary-700">
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Bulk Import CSV
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
              <div className="flex justify-between items-center">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={downloadSampleTemplate}
                  size="sm"
                >
                  Download Template
                </Button>
                
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
                  <div className="max-h-40 overflow-y-auto text-sm bg-muted/30 p-2 rounded-md">
                    {importResult.errorDetails.map((error, index) => (
                      <div key={index} className="py-1 border-b border-muted last:border-0">
                        {error}
                      </div>
                    ))}
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
