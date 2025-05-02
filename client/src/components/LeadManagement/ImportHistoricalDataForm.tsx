import { useState } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, FileUp, CheckCircle2, AlertCircle, Database, Mail, Calendar, MessageSquare } from 'lucide-react';

interface ImportHistoricalDataFormProps {
  leadId: number;
}

export function ImportHistoricalDataForm({ leadId }: ImportHistoricalDataFormProps) {
  const queryClient = useQueryClient();
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importType, setImportType] = useState<'asana' | 'gmail'>('asana');
  
  // Fetch lead enrichment data to display historical context
  const { data: enrichmentData, isLoading: isLoadingEnrichment } = useQuery({
    queryKey: [`/api/leads/${leadId}`],
    queryFn: async () => {
      const response = await fetch(`/api/leads/${leadId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch lead data");
      }
      return response.json();
    },
    enabled: !!leadId,
  });

  const handleImport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsImporting(true);
    setImportSuccess(false);
    setImportError(null);

    const formData = new FormData(event.currentTarget);
    const file = formData.get('file') as File;

    if (!file || file.size === 0) {
      setImportError('Please select a file to upload');
      setIsImporting(false);
      return;
    }

    try {
      const endpoint = `/api/leads/${leadId}/import/${importType}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import data');
      }

      setImportSuccess(true);
      setImportError(null);

      // Invalidate query to refresh lead data
      await queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] });
    } catch (error) {
      console.error('Import error:', error);
      setImportError((error as Error).message || 'Failed to import data');
      setImportSuccess(false);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="asana" onValueChange={(value) => setImportType(value as 'asana' | 'gmail')}>
        <TabsList className="mb-4">
          <TabsTrigger value="asana">
            <Database className="h-4 w-4 mr-2" />
            Asana Projects
          </TabsTrigger>
          <TabsTrigger value="gmail">
            <Mail className="h-4 w-4 mr-2" />
            Email History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="asana">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleImport}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="asana-file">Upload Asana Project Data</Label>
                    <div className="mt-1 text-sm text-neutral-500 mb-2">
                      Upload your Asana project history as CSV, JSON, XML, or Markdown file
                    </div>
                    <Input 
                      id="asana-file" 
                      name="file" 
                      type="file" 
                      accept=".csv,.json,.xml,.md" 
                      disabled={isImporting}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isImporting}>
                      {isImporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <FileUp className="mr-2 h-4 w-4" />
                          Import Asana Data
                        </>
                      )}
                    </Button>
                  </div>

                  {importSuccess && importType === 'asana' && (
                    <Alert className="mt-4 bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800">Success</AlertTitle>
                      <AlertDescription className="text-green-700">
                        Asana project data imported successfully.
                      </AlertDescription>
                    </Alert>
                  )}

                  {importError && importType === 'asana' && (
                    <Alert className="mt-4 bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertTitle className="text-red-800">Error</AlertTitle>
                      <AlertDescription className="text-red-700">
                        {importError}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </form>
              
              {/* Display imported Asana project data */}
              {enrichmentData?.enrichment?.projectHistory && (
                <div className="mt-6">
                  <Separator className="my-4" />
                  <div className="mb-2">
                    <h3 className="text-md font-medium">Imported Asana Project Data</h3>
                    <p className="text-sm text-neutral-500">Historical project data from Asana</p>
                  </div>
                  
                  {isLoadingEnrichment ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Past Projects Section */}
                      {enrichmentData?.enrichment?.projectHistory?.pastProjects?.length > 0 && (
                        <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
                          <h4 className="text-sm font-medium mb-3 flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-neutral-600" />
                            Past Projects
                          </h4>
                          <div className="space-y-3">
                            {enrichmentData.enrichment.projectHistory.pastProjects.map((project: any, index: number) => (
                              <div key={index} className="bg-white p-3 rounded-md border border-neutral-200">
                                <div className="flex justify-between">
                                  <h5 className="text-sm font-medium">{project.name}</h5>
                                  <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">{project.status}</span>
                                </div>
                                {project.description && (
                                  <p className="text-sm text-neutral-600 mt-1">{project.description}</p>
                                )}
                                {project.completionDate && (
                                  <p className="text-xs text-neutral-500 mt-2">Completed: {project.completionDate}</p>
                                )}
                                {project.keyOutcomes && project.keyOutcomes.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-medium">Key Outcomes:</p>
                                    <ul className="text-xs text-neutral-600 pl-4 mt-1 list-disc">
                                      {project.keyOutcomes.map((outcome: string, i: number) => (
                                        <li key={i}>{outcome}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Current Projects Section */}
                      {enrichmentData?.enrichment?.projectHistory?.currentProjects?.length > 0 && (
                        <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
                          <h4 className="text-sm font-medium mb-3 flex items-center">
                            <Calendar className="h-4 w-4 mr-2 text-neutral-600" />
                            Current Projects
                          </h4>
                          <div className="space-y-3">
                            {enrichmentData.enrichment.projectHistory.currentProjects.map((project: any, index: number) => (
                              <div key={index} className="bg-white p-3 rounded-md border border-neutral-200">
                                <div className="flex justify-between">
                                  <h5 className="text-sm font-medium">{project.name}</h5>
                                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">{project.status}</span>
                                </div>
                                {project.description && (
                                  <p className="text-sm text-neutral-600 mt-1">{project.description}</p>
                                )}
                                {project.milestones && project.milestones.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-medium">Milestones:</p>
                                    <ul className="text-xs text-neutral-600 pl-4 mt-1 list-disc">
                                      {project.milestones.map((milestone: string, i: number) => (
                                        <li key={i}>{milestone}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Show message when no project data available */}
                      {(!enrichmentData?.enrichment?.projectHistory?.pastProjects || enrichmentData.enrichment.projectHistory.pastProjects.length === 0) && 
                       (!enrichmentData?.enrichment?.projectHistory?.currentProjects || enrichmentData.enrichment.projectHistory.currentProjects.length === 0) && (
                        <div className="text-center p-4 text-neutral-500">
                          <p>No project data available</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gmail">
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleImport}>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="gmail-file">Upload Email History Data</Label>
                    <div className="mt-1 text-sm text-neutral-500 mb-2">
                      Upload your email exchange history as CSV, JSON, XML, or Markdown file
                    </div>
                    <Input 
                      id="gmail-file" 
                      name="file" 
                      type="file" 
                      accept=".csv,.json,.xml,.md" 
                      disabled={isImporting}
                    />
                  </div>
                  
                  <div className="flex justify-end">
                    <Button type="submit" disabled={isImporting}>
                      {isImporting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <FileUp className="mr-2 h-4 w-4" />
                          Import Email Data
                        </>
                      )}
                    </Button>
                  </div>

                  {importSuccess && importType === 'gmail' && (
                    <Alert className="mt-4 bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800">Success</AlertTitle>
                      <AlertDescription className="text-green-700">
                        Email history data imported successfully.
                      </AlertDescription>
                    </Alert>
                  )}

                  {importError && importType === 'gmail' && (
                    <Alert className="mt-4 bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertTitle className="text-red-800">Error</AlertTitle>
                      <AlertDescription className="text-red-700">
                        {importError}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </form>
              
              {/* Display imported email history data */}
              {enrichmentData?.enrichment?.emailHistory && (
                <div className="mt-6">
                  <Separator className="my-4" />
                  <div className="mb-2">
                    <h3 className="text-md font-medium">Imported Email History</h3>
                    <p className="text-sm text-neutral-500">Historical email exchanges and key contacts</p>
                  </div>
                  
                  {isLoadingEnrichment ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Recent Email Threads Section */}
                      {enrichmentData?.enrichment?.emailHistory?.recentThreads?.length > 0 && (
                        <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
                          <h4 className="text-sm font-medium mb-3 flex items-center">
                            <MessageSquare className="h-4 w-4 mr-2 text-neutral-600" />
                            Recent Email Threads
                          </h4>
                          <div className="space-y-3">
                            {enrichmentData.enrichment.emailHistory.recentThreads.map((thread: any, index: number) => (
                              <div key={index} className="bg-white p-3 rounded-md border border-neutral-200">
                                <div className="flex justify-between">
                                  <h5 className="text-sm font-medium">{thread.topic}</h5>
                                  <span className="text-xs text-neutral-500">{thread.date}</span>
                                </div>
                                <p className="text-sm text-neutral-600 mt-1">{thread.summary}</p>
                                {thread.sentiment && (
                                  <div className="mt-2 flex items-center">
                                    <span className="text-xs mr-2">Sentiment:</span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                      thread.sentiment.toLowerCase().includes('positive') ? 'bg-green-100 text-green-800' : 
                                      thread.sentiment.toLowerCase().includes('negative') ? 'bg-red-100 text-red-800' : 
                                      'bg-blue-100 text-blue-800'
                                    }`}>
                                      {thread.sentiment}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Key Contacts Section */}
                      {enrichmentData?.enrichment?.emailHistory?.keyContacts?.length > 0 && (
                        <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
                          <h4 className="text-sm font-medium mb-3">Key Contacts</h4>
                          <div className="flex flex-wrap gap-2">
                            {enrichmentData.enrichment.emailHistory.keyContacts.map((contact: string, index: number) => (
                              <span key={index} className="text-xs px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                                {contact}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Show message when no email data available */}
                      {(!enrichmentData?.enrichment?.emailHistory?.recentThreads || enrichmentData.enrichment.emailHistory.recentThreads.length === 0) && 
                       (!enrichmentData?.enrichment?.emailHistory?.keyContacts || enrichmentData.enrichment.emailHistory.keyContacts.length === 0) && (
                        <div className="text-center p-4 text-neutral-500">
                          <p>No email history data available</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Previous Proposals Section - Common to both tabs */}
      {enrichmentData?.enrichment?.previousProposals && (
        <div className="mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-2">
                <h3 className="text-md font-medium">Previous Proposals</h3>
                <p className="text-sm text-neutral-500">History of past proposals and services offered</p>
              </div>
              
              {isLoadingEnrichment ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : (
                <div className="space-y-4">
                  {enrichmentData?.enrichment?.previousProposals?.length > 0 ? (
                    <div className="bg-neutral-50 p-4 rounded-md border border-neutral-200">
                      <div className="space-y-3">
                        {enrichmentData.enrichment.previousProposals.map((proposal: any, index: number) => (
                          <div key={index} className="bg-white p-3 rounded-md border border-neutral-200">
                            <div className="flex justify-between">
                              <h5 className="text-sm font-medium">{proposal.title}</h5>
                              <div className="flex items-center space-x-2">
                                <span className="text-xs text-neutral-500">{proposal.date}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  proposal.status.toLowerCase().includes('accepted') ? 'bg-green-100 text-green-800' : 
                                  proposal.status.toLowerCase().includes('rejected') ? 'bg-red-100 text-red-800' : 
                                  'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {proposal.status}
                                </span>
                              </div>
                            </div>
                            {proposal.value && (
                              <p className="text-sm font-medium text-emerald-600 mt-1">Value: {proposal.value}</p>
                            )}
                            {proposal.services && proposal.services.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium">Services:</p>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {proposal.services.map((service: string, i: number) => (
                                    <span key={i} className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full">
                                      {service}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-4 text-neutral-500">
                      <p>No previous proposals available</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}