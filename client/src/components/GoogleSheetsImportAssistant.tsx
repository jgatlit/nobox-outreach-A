import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { HelpCircleIcon, FileSpreadsheetIcon, TableIcon, CheckCircleIcon } from 'lucide-react';

interface GoogleSheetsImportAssistantProps {
  importStep: number;
}

export function GoogleSheetsImportAssistant({ importStep }: GoogleSheetsImportAssistantProps) {
  return (
    <Card>
      <CardHeader className="bg-muted/50">
        <CardTitle className="flex items-center gap-2">
          <HelpCircleIcon className="h-5 w-5" />
          <span>Import Assistant</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {importStep === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium">Getting Started</h3>
            <p className="text-sm text-muted-foreground">
              Import leads directly from Google Sheets. Follow these steps to get started:
            </p>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 text-xs">1</div>
                <p className="text-sm">
                  <span className="font-medium">Prepare your sheet</span> with a header row containing column names.
                </p>
              </div>
              
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 text-xs">2</div>
                <p className="text-sm">
                  <span className="font-medium">Share your sheet</span> to be publicly accessible or with view permissions.
                </p>
              </div>
              
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 text-xs">3</div>
                <p className="text-sm">
                  <span className="font-medium">Copy the URL</span> from your browser address bar.
                </p>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-medium mb-2">URL Format Example</h3>
              <p className="text-xs text-muted-foreground break-all">
                https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
              </p>
            </div>
          </div>
        )}
        
        {importStep === 2 && (
          <div className="space-y-4">
            <h3 className="font-medium">Mapping Fields</h3>
            <p className="text-sm text-muted-foreground">
              Match your Google Sheet columns to the corresponding lead fields in our system.
            </p>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <FileSpreadsheetIcon className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Email field is required</span> for import. Make sure to map it.
                </p>
              </div>
              
              <div className="flex gap-2">
                <TableIcon className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Preview your data</span> before importing to ensure correct mapping.
                </p>
              </div>
            </div>
            
            <Separator />
            
            <div>
              <h3 className="font-medium mb-2">Tips</h3>
              <ul className="text-sm space-y-2 list-disc pl-4">
                <li>For tags, use comma-separated values in a single column.</li>
                <li>Dates should be in YYYY-MM-DD format for reliable imports.</li>
                <li>Duplicate emails will be skipped during import.</li>
              </ul>
            </div>
          </div>
        )}
        
        {importStep === 3 && (
          <div className="space-y-4">
            <h3 className="font-medium">Importing in Progress</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we process your data. This may take a moment depending on the size of your sheet.
            </p>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <CheckCircleIcon className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Validation:</span> Each row is validated for required fields
                </p>
              </div>
              
              <div className="flex gap-2">
                <CheckCircleIcon className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Deduplication:</span> Checking for existing leads by email
                </p>
              </div>
              
              <div className="flex gap-2">
                <CheckCircleIcon className="h-5 w-5 text-primary flex-shrink-0" />
                <p className="text-sm">
                  <span className="font-medium">Import:</span> Adding new leads to your database
                </p>
              </div>
            </div>
          </div>
        )}
        
        {importStep === 4 && (
          <div className="space-y-4">
            <h3 className="font-medium">Import Complete</h3>
            <p className="text-sm text-muted-foreground">
              Your leads have been successfully imported. Here's what you can do next:
            </p>
            
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 text-xs">1</div>
                <p className="text-sm">
                  <span className="font-medium">Review your leads</span> to ensure all data was imported correctly.
                </p>
              </div>
              
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 text-xs">2</div>
                <p className="text-sm">
                  <span className="font-medium">Enrich your leads</span> with additional data like company information.
                </p>
              </div>
              
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center flex-shrink-0 text-xs">3</div>
                <p className="text-sm">
                  <span className="font-medium">Create email campaigns</span> to engage with your newly imported leads.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}