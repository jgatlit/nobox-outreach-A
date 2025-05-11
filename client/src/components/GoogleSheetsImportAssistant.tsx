import * as React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, FileSpreadsheet, HelpCircle, ArrowRight, Clock } from "lucide-react";

interface GoogleSheetsImportAssistantProps {
  importStep: number;
}

export function GoogleSheetsImportAssistant({ importStep }: GoogleSheetsImportAssistantProps) {
  return (
    <Card className="w-full mb-8">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-green-600" />
          <CardTitle className="text-xl">Google Sheets Import Assistant</CardTitle>
        </div>
        <CardDescription>
          Follow these steps to import your leads from Google Sheets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-4 items-center">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center">
              {importStep > 1 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : importStep === 1 ? (
                <Badge variant="outline" className="h-6 w-6 p-1 flex items-center justify-center rounded-full">1</Badge>
              ) : (
                <Badge variant="outline" className="h-6 w-6 p-1 flex items-center justify-center rounded-full text-gray-400">1</Badge>
              )}
            </div>
            <div className="flex-1">
              <h3 className={`font-medium ${importStep === 1 ? 'text-primary-900' : importStep > 1 ? 'text-gray-600' : 'text-gray-400'}`}>
                Enter Google Sheet URL
              </h3>
              <p className={`text-sm ${importStep === 1 ? 'text-gray-600' : importStep > 1 ? 'text-gray-500' : 'text-gray-400'}`}>
                Provide a shared Google Sheet URL containing your leads data
              </p>
            </div>
            {importStep === 1 && (
              <div className="flex-shrink-0">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">Current Step</Badge>
              </div>
            )}
          </div>

          <Separator className="my-2" />

          <div className="flex gap-4 items-center">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center">
              {importStep > 2 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : importStep === 2 ? (
                <Badge variant="outline" className="h-6 w-6 p-1 flex items-center justify-center rounded-full">2</Badge>
              ) : (
                <Badge variant="outline" className="h-6 w-6 p-1 flex items-center justify-center rounded-full text-gray-400">2</Badge>
              )}
            </div>
            <div className="flex-1">
              <h3 className={`font-medium ${importStep === 2 ? 'text-primary-900' : importStep > 2 ? 'text-gray-600' : 'text-gray-400'}`}>
                Select Sheet & Map Columns
              </h3>
              <p className={`text-sm ${importStep === 2 ? 'text-gray-600' : importStep > 2 ? 'text-gray-500' : 'text-gray-400'}`}>
                Choose which sheet to import and map columns to lead fields
              </p>
            </div>
            {importStep === 2 && (
              <div className="flex-shrink-0">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">Current Step</Badge>
              </div>
            )}
          </div>

          <Separator className="my-2" />

          <div className="flex gap-4 items-center">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center">
              {importStep > 3 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : importStep === 3 ? (
                <Badge variant="outline" className="h-6 w-6 p-1 flex items-center justify-center rounded-full">3</Badge>
              ) : (
                <Badge variant="outline" className="h-6 w-6 p-1 flex items-center justify-center rounded-full text-gray-400">3</Badge>
              )}
            </div>
            <div className="flex-1">
              <h3 className={`font-medium ${importStep === 3 ? 'text-primary-900' : importStep > 3 ? 'text-gray-600' : 'text-gray-400'}`}>
                Import Data
              </h3>
              <p className={`text-sm ${importStep === 3 ? 'text-gray-600' : importStep > 3 ? 'text-gray-500' : 'text-gray-400'}`}>
                Review and start import process
              </p>
            </div>
            {importStep === 3 && (
              <div className="flex-shrink-0">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium">Current Step</Badge>
              </div>
            )}
          </div>

          <Separator className="my-2" />

          <div className="flex gap-4 items-center">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-50 flex items-center justify-center">
              {importStep > 4 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : importStep === 4 ? (
                <Badge variant="outline" className="h-6 w-6 p-1 flex items-center justify-center rounded-full">4</Badge>
              ) : (
                <Badge variant="outline" className="h-6 w-6 p-1 flex items-center justify-center rounded-full text-gray-400">4</Badge>
              )}
            </div>
            <div className="flex-1">
              <h3 className={`font-medium ${importStep === 4 ? 'text-primary-900' : importStep > 4 ? 'text-gray-600' : 'text-gray-400'}`}>
                Complete
              </h3>
              <p className={`text-sm ${importStep === 4 ? 'text-gray-600' : importStep > 4 ? 'text-gray-500' : 'text-gray-400'}`}>
                Import complete
              </p>
            </div>
            {importStep === 4 && (
              <div className="flex-shrink-0">
                <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-100 font-medium">Complete</Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-gray-50 py-2 px-6 text-sm text-gray-500 flex items-center gap-2 rounded-b-lg border-t">
        <HelpCircle className="h-4 w-4" />
        <p>The import process will not duplicate leads with the same email</p>
      </CardFooter>
    </Card>
  );
}

export function GoogleSheetsImportProgress({ progress }: { progress: number }) {
  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-medium">Import in progress</span>
        </div>
        <span className="text-sm text-gray-500">{progress}%</span>
      </div>
      <Progress value={progress} className="h-2 w-full" />
      <p className="text-xs text-gray-500">Importing and deduplicating your leads...</p>
    </div>
  );
}