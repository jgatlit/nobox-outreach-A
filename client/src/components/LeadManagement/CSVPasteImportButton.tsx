import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Clipboard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export function CSVPasteImportButton() {
  const [open, setOpen] = React.useState(false);
  const [csvData, setCsvData] = React.useState("");
  const [isImporting, setIsImporting] = React.useState(false);
  const [importResult, setImportResult] = React.useState<{
    success: boolean;
    message: string;
    imported: number;
    duplicates: number;
    errors: number;
    errorDetails?: string[];
  } | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Reset state when dialog is closed
  React.useEffect(() => {
    if (!open) {
      setCsvData("");
      setImportResult(null);
    }
  }, [open]);
  
  const handleImport = async () => {
    if (!csvData.trim()) {
      toast({
        title: "Empty data",
        description: "Please paste CSV data to import.",
        variant: "destructive",
      });
      return;
    }
    
    setIsImporting(true);
    
    try {
      const response = await apiRequest("POST", "/api/leads/import/paste", {
        csvData: csvData
      });
      
      setImportResult(response);
      
      if (response.success) {
        toast({
          title: "Import successful",
          description: `Successfully imported ${response.imported} leads.`,
        });
        // Refresh leads list
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else {
        toast({
          title: "Import issues",
          description: response.message || "There were some issues with the import.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "There was an error importing the CSV data.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          className="bg-white text-primary-600 border-primary-200 hover:bg-primary-50"
        >
          <Clipboard className="mr-2 h-4 w-4" />
          Paste CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV Text</DialogTitle>
          <DialogDescription>
            Paste CSV data with headers from your clipboard to import leads. Data should include at least an email column.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-2">
          <Textarea
            className="font-mono text-sm h-56"
            placeholder="email,firstName,lastName,company,title,phoneNumber,website,linkedinUrl,source,status,priority,notes,tags&#10;john.doe@example.com,John,Doe,Example Inc,CEO,555-1234,example.com,linkedin.com/in/johndoe,import,active,medium,Sample note,tag1,tag2&#10;jane.smith@example.com,Jane,Smith,..."
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            disabled={isImporting}
          />
        </div>
        
        {importResult && (
          <div className={`p-3 text-sm rounded ${importResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            <p><strong>{importResult.message}</strong></p>
            <p>Imported: {importResult.imported} | Duplicates: {importResult.duplicates} | Errors: {importResult.errors}</p>
            
            {importResult.errorDetails && importResult.errorDetails.length > 0 && (
              <div className="mt-2">
                <p><strong>Error details:</strong></p>
                <ul className="list-disc pl-5 mt-1 max-h-32 overflow-y-auto">
                  {importResult.errorDetails.map((error, i) => (
                    <li key={i}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isImporting}>
              Cancel
            </Button>
          </DialogClose>
          <Button 
            onClick={handleImport} 
            disabled={isImporting || !csvData.trim()}
            className="bg-primary-600 hover:bg-primary-700"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Import Leads'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}