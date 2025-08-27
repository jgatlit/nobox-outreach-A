import * as React from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ColumnMapping {
  csvColumn: string;
  schemaField: string;
}

interface MappingAnalysis {
  tempId: string;
  headers: string[];
  sampleData: any[];
  mapping: {
    suggestions: Array<{
      csvColumn: string;
      suggestedField: string;
      confidence: number;
      reasoning: string;
    }>;
    confidence: number;
    warnings: string[];
    requiredMissing: string[];
    detectedMappings: Record<string, string>;
  };
  rowCount: number;
}

export function CSVImportButton() {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showMappingDialog, setShowMappingDialog] = React.useState(false);
  const [analysisResult, setAnalysisResult] = React.useState<MappingAnalysis | null>(null);
  const [columnMappings, setColumnMappings] = React.useState<Record<string, string>>({});
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [schemaFields, setSchemaFields] = React.useState<Record<string, any>>({});
  
  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Fetch schema fields on mount
  React.useEffect(() => {
    const fetchSchema = async () => {
      try {
        const response = await fetch("/api/leads/import/csv/schema");
        const result = await response.json();
        setSchemaFields(result.schemaFields || {});
      } catch (error) {
        console.error("Failed to fetch schema:", error);
      }
    };
    fetchSchema();
  }, []);

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
      setIsAnalyzing(true);
      toast({
        title: "Analyzing CSV",
        description: "AI is analyzing your CSV headers and data...",
      });

      const response = await fetch("/api/leads/import/csv/analyze", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setAnalysisResult(result);
        setColumnMappings(result.mapping.detectedMappings || {});
        setShowMappingDialog(true);
        toast({
          title: "Analysis complete",
          description: `Found ${result.headers.length} columns in ${result.rowCount} rows. Please review the mapping.`,
        });
      } else {
        toast({
          title: "Analysis failed",
          description: result.error || "Failed to analyze CSV file.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Analysis failed",
        description: "There was an error analyzing the CSV file.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleImportWithMapping = async () => {
    if (!analysisResult) return;

    try {
      setIsImporting(true);
      toast({
        title: "Importing leads",
        description: "Processing your leads with the confirmed mapping...",
      });

      const response = await fetch("/api/leads/import/csv/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tempId: analysisResult.tempId,
          mapping: columnMappings,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Import successful",
          description: result.message,
        });
        // Refresh leads list
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
        setShowMappingDialog(false);
        setAnalysisResult(null);
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
      setIsImporting(false);
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
        disabled={isAnalyzing}
        className="bg-primary-600 text-white hover:bg-primary-700"
      >
        {isAnalyzing ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="mr-2 h-4 w-4" />
        )}
        {isAnalyzing ? "Analyzing..." : "Import CSV"}
      </Button>

      <Dialog open={showMappingDialog} onOpenChange={setShowMappingDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review CSV Column Mapping</DialogTitle>
          </DialogHeader>
          
          {analysisResult && (
            <div className="space-y-6">
              {/* Analysis Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    Analysis Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Columns Found</p>
                      <p className="text-muted-foreground">{analysisResult.headers.length}</p>
                    </div>
                    <div>
                      <p className="font-medium">Total Rows</p>
                      <p className="text-muted-foreground">{analysisResult.rowCount}</p>
                    </div>
                    <div>
                      <p className="font-medium">Confidence</p>
                      <div className="flex items-center gap-2">
                        {analysisResult.mapping.confidence > 0.8 ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                        )}
                        <span>{Math.round(analysisResult.mapping.confidence * 100)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Warnings */}
                  {analysisResult.mapping.warnings.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="font-medium text-yellow-800 mb-2">Warnings:</p>
                      <ul className="list-disc list-inside text-sm text-yellow-700">
                        {analysisResult.mapping.warnings.map((warning, i) => (
                          <li key={i}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {/* Missing Required Fields */}
                  {analysisResult.mapping.requiredMissing.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                      <p className="font-medium text-red-800 mb-2">Missing Required Fields:</p>
                      <ul className="list-disc list-inside text-sm text-red-700">
                        {analysisResult.mapping.requiredMissing.map((field, i) => (
                          <li key={i}>{field}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Column Mapping */}
              <Card>
                <CardHeader>
                  <CardTitle>Column Mapping</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Review and adjust how your CSV columns map to our lead fields
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {analysisResult.headers.map((header) => (
                      <div key={header} className="flex items-center gap-4">
                        <div className="flex-1">
                          <p className="font-medium">{header}</p>
                          {analysisResult.sampleData[0]?.[header] && (
                            <p className="text-xs text-muted-foreground">
                              Sample: {analysisResult.sampleData[0][header]}
                            </p>
                          )}
                        </div>
                        <div className="flex-1">
                          <Select
                            value={columnMappings[header] || ""}
                            onValueChange={(value) => {
                              setColumnMappings(prev => ({
                                ...prev,
                                [header]: value === "none" ? "" : value
                              }));
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select field..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Don't import</SelectItem>
                              {Object.entries(schemaFields).map(([field, info]) => (
                                <SelectItem key={field} value={field}>
                                  <div className="flex items-center gap-2">
                                    <span>{field}</span>
                                    {info.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          {analysisResult.mapping.suggestions.find(s => s.csvColumn === header) && (
                            <div className="text-sm">
                              <Badge variant="secondary" className="mb-1">
                                {Math.round(analysisResult.mapping.suggestions.find(s => s.csvColumn === header)!.confidence * 100)}% confidence
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {analysisResult.mapping.suggestions.find(s => s.csvColumn === header)!.reasoning}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Sample Data Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Sample Data Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse border border-gray-200">
                      <thead>
                        <tr className="bg-gray-50">
                          {analysisResult.headers.map(header => (
                            <th key={header} className="border border-gray-200 px-3 py-2 text-left">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {analysisResult.sampleData.slice(0, 3).map((row, i) => (
                          <tr key={i}>
                            {analysisResult.headers.map(header => (
                              <td key={header} className="border border-gray-200 px-3 py-2">
                                {row[header]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setShowMappingDialog(false)}
                  disabled={isImporting}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleImportWithMapping}
                  disabled={isImporting || !columnMappings.email}
                  className="bg-primary-600 text-white hover:bg-primary-700"
                >
                  {isImporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                  )}
                  {isImporting ? "Importing..." : "Import Leads"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
