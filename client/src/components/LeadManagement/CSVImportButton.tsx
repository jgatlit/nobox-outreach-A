import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function CSVImportButton() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast({
        title: "Uploading CSV",
        description: "Please wait while we process your file...",
      });

      const response = await fetch("/api/leads/import/csv", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Import successful",
          description: `Successfully imported ${result.imported} leads.`,
        });
        // Refresh leads list
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else {
        toast({
          title: "Import issues",
          description: result.message || "There were some issues with the import.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "There was an error importing the CSV file.",
        variant: "destructive",
      });
    } finally {
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <>
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        style={{ display: "none" }}
      />
      <Button 
        onClick={handleClick}
        className="bg-primary-600 text-white hover:bg-primary-700"
      >
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        Import CSV
      </Button>
    </>
  );
}
