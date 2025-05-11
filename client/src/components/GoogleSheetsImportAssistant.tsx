import React from 'react';
import { AlertCircle, CheckCircle, FileSpreadsheetIcon, HelpCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface GoogleSheetsImportAssistantProps {
  importStep: number;
}

export function GoogleSheetsImportAssistant({ importStep }: GoogleSheetsImportAssistantProps) {
  const steps = [
    { id: 1, name: 'Connect', description: 'Connect to Google Sheets' },
    { id: 2, name: 'Map Fields', description: 'Map sheet columns to lead fields' },
    { id: 3, name: 'Import', description: 'Import leads from Google Sheets' },
    { id: 4, name: 'Complete', description: 'Review imported leads' },
  ];

  return (
    <div className="relative">
      <div className="absolute left-0 top-2 bottom-2 w-[2px] bg-neutral-200" />
      
      <div className="space-y-8">
        {steps.map((step) => {
          const isActive = importStep === step.id;
          const isCompleted = importStep > step.id;
          
          return (
            <div key={step.id} className="relative pl-8">
              <div className={`absolute left-[-9px] top-0 h-5 w-5 rounded-full ${
                isCompleted 
                  ? 'bg-green-500' 
                  : isActive 
                    ? 'bg-primary ring-4 ring-primary/20' 
                    : 'bg-neutral-200'
              } flex items-center justify-center`}>
                {isCompleted && <CheckCircle className="h-3 w-3 text-white" />}
              </div>
              
              <div>
                <h3 className={`text-sm font-medium ${
                  isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-neutral-500'
                }`}>
                  Step {step.id}: {step.name}
                </h3>
                <p className={`text-xs ${
                  isActive ? 'text-neutral-700' : 'text-neutral-500'
                }`}>
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function GoogleSheetsImportProgress({ progress }: { progress: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-neutral-500">
        <span>Importing leads...</span>
        <span>{Math.round(progress)}%</span>
      </div>
      <Progress value={progress} className="w-full h-2" />
      
      <div className="rounded-md bg-blue-50 p-3 mt-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <HelpCircle className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Import in progress</h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                We're importing your leads from Google Sheets. This may take a moment depending on the number of records.
                Please do not close this window until the import is complete.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}