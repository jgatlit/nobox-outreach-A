import * as React from "react";
import { Suspense, useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { formatDate, getSourceBadgeColor, getStatusColor, getPriorityColors, getPriorityDescription } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Mail, User, Building, Phone, Globe, Linkedin, Calendar, AlertTriangle, CheckCircle, ArrowUp, ArrowDown, Minus, Flag, History, Edit, RefreshCw, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ImportHistoricalDataForm } from "@/components/LeadManagement/ImportHistoricalDataForm";
import { EditLeadModal } from "@/components/LeadManagement/EditLeadModal";

// Lazy-load EmailGeneratorForm to avoid circular imports
const EmailGeneratorForm = React.lazy(() => import("@/components/LeadManagement/EmailGeneratorFormWrapped"));


export default function LeadDetail() {
  const [, params] = useRoute<{ id: string }>("/leads/:id");
  const leadId = params?.id ? parseInt(params.id, 10) : 0;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [editingDraft, setEditingDraft] = useState<any>(null);
  const [isEmailEditModalOpen, setIsEmailEditModalOpen] = useState(false);
  const [useEnhancedScraping, setUseEnhancedScraping] = useState(true);
  
  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/leads/${leadId}`],
    queryFn: async () => {
      const response = await fetch(`/api/leads/${leadId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch lead");
      }
      return response.json();
    },
    enabled: !!leadId,
  });

  const { data: emailDrafts, isLoading: isLoadingDrafts } = useQuery({
    queryKey: [`/api/leads/${leadId}/email-drafts`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/leads/${leadId}/email-drafts`);
        if (!response.ok) {
          throw new Error("Failed to fetch email drafts");
        }
        return response.json();
      } catch (error) {
        // If endpoint doesn't exist yet, return empty array
        console.error("Error fetching email drafts:", error);
        return [];
      }
    },
    enabled: !!leadId,
  });

  // Extract data
  const lead = data?.lead;
  const enrichment = data?.enrichment;
  
  // Initialize the useEnhancedScraping state from enrichment data when it loads
  React.useEffect(() => {
    if (enrichment && typeof enrichment.useEnhancedScraping === 'boolean') {
      setUseEnhancedScraping(enrichment.useEnhancedScraping);
    }
  }, [enrichment]);
  
  const updateEnhancedScrapingSetting = async (enabled: boolean) => {
    if (!enrichment) {
      toast({
        title: "Cannot update setting",
        description: "Enrichment data not available.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await fetch(`/api/leads/${leadId}/enrichment-settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ useEnhancedScraping: enabled })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to update enrichment settings");
      }
      
      // Update local state
      setUseEnhancedScraping(enabled);
      
      // Invalidate the queries to refresh the data
      await queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] });
      
      toast({
        title: "Success",
        description: `AI-enhanced scraping ${enabled ? 'enabled' : 'disabled'}.`,
        variant: "default"
      });
    } catch (error) {
      console.error("Error updating enrichment settings:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update enrichment settings",
        variant: "destructive"
      });
    }
  };
  
  const refreshEnrichment = async () => {
    if (!lead || !lead.website) {
      toast({
        title: "Cannot refresh lead data",
        description: "Lead must have a website URL to refresh enrichment data.",
        variant: "destructive"
      });
      return;
    }
    
    setIsRefreshing(true);
    
    try {
      const response = await fetch(`/api/leads/${leadId}/refresh-enrichment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to refresh lead data");
      }
      
      // Invalidate the queries to refresh the data
      await queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}`] });
      
      toast({
        title: "Success",
        description: "Lead enrichment data has been refreshed.",
        variant: "default"
      });
    } catch (error) {
      console.error("Error refreshing lead data:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to refresh lead data",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load lead details. Please try again later.
        </AlertDescription>
      </Alert>
    );
  }

  const { bg: sourceBg, text: sourceText } = getSourceBadgeColor(lead.source);
  const { bg: statusBg, text: statusText } = getStatusColor(lead.status);
  const { bg: priorityBg, text: priorityText, icon: priorityIcon } = getPriorityColors(lead.priority);

  return (
    <main className="p-6 overflow-auto h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">
            {lead.firstName} {lead.lastName}
          </h2>
          <p className="text-neutral-500">{lead.title} at {lead.company}</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Lead
          </Button>
          <Button>Send Email</Button>
        </div>
        
        {/* Edit Lead Modal */}
        {lead && <EditLeadModal 
          lead={lead} 
          open={isEditModalOpen} 
          onOpenChange={setIsEditModalOpen} 
        />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Lead details */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Lead Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="outline" className={`${sourceBg} ${sourceText}`}>
                  {lead.source}
                </Badge>
                <Badge variant="outline" className={`${statusBg} ${statusText}`}>
                  {lead.status}
                </Badge>
                {lead.priority && (
                  <TooltipProvider>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <Badge variant="outline" className={`${getPriorityColors(lead.priority).badgeBg} ${priorityText} border relative overflow-hidden ${getPriorityColors(lead.priority).border} ${getPriorityColors(lead.priority).shadow} cursor-help hover:brightness-105 transition-all duration-200`}>
                          <div className={`absolute inset-0 opacity-10 bg-gradient-to-r ${getPriorityColors(lead.priority).gradient}`}></div>
                          <div className="relative flex items-center gap-1.5">
                            {(() => {
                              let PriorityIcon;
                              if (lead.priority === 'urgent') PriorityIcon = AlertTriangle;
                              else if (lead.priority === 'high') PriorityIcon = ArrowUp;
                              else if (lead.priority === 'medium') PriorityIcon = Minus;
                              else if (lead.priority === 'low') PriorityIcon = ArrowDown;
                              
                              return PriorityIcon ? <PriorityIcon className={`h-3 w-3 ${priorityIcon}`} /> : null;
                            })()}
                            {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)} Priority
                          </div>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[250px] p-3">
                        <p className="font-medium mb-1 text-sm">{lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)} Priority</p>
                        <p className="text-xs text-neutral-500">{getPriorityDescription(lead.priority)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start">
                  <User className="h-5 w-5 text-neutral-400 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Full Name</p>
                    <p className="text-sm">{lead.firstName} {lead.lastName}</p>
                  </div>
                </div>
                
                <div className="flex items-start">
                  <Mail className="h-5 w-5 text-neutral-400 mr-2 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm break-all">{lead.email}</p>
                  </div>
                </div>
                
                {lead.title && (
                  <div className="flex items-start">
                    <User className="h-5 w-5 text-neutral-400 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Title</p>
                      <p className="text-sm">{lead.title}</p>
                    </div>
                  </div>
                )}
                
                {lead.company && (
                  <div className="flex items-start">
                    <Building className="h-5 w-5 text-neutral-400 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Company</p>
                      <p className="text-sm">{lead.company}</p>
                    </div>
                  </div>
                )}
                
                {lead.phoneNumber && (
                  <div className="flex items-start">
                    <Phone className="h-5 w-5 text-neutral-400 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm">{lead.phoneNumber}</p>
                    </div>
                  </div>
                )}
                
                {lead.website && (
                  <div className="flex items-start">
                    <Globe className="h-5 w-5 text-neutral-400 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <p className="text-sm break-all">
                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                          {lead.website}
                        </a>
                      </p>
                    </div>
                  </div>
                )}
                
                {lead.linkedinUrl && (
                  <div className="flex items-start">
                    <Linkedin className="h-5 w-5 text-neutral-400 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">LinkedIn</p>
                      <p className="text-sm break-all">
                        <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                          {lead.linkedinUrl}
                        </a>
                      </p>
                    </div>
                  </div>
                )}
                
                {lead.lastContactDate && (
                  <div className="flex items-start">
                    <Calendar className="h-5 w-5 text-neutral-400 mr-2 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Last Contact</p>
                      <p className="text-sm">{formatDate(lead.lastContactDate)}</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Priority Information */}
              {lead.priority && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <div className="flex items-center mb-2">
                      <Flag className={`h-5 w-5 ${priorityIcon} mr-2`} />
                      <p className="text-sm font-medium">Priority Information</p>
                    </div>
                    <div className={`p-3 rounded-md relative overflow-hidden border ${getPriorityColors(lead.priority).border}`}>
                      {/* Background gradient effect */}
                      <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${getPriorityColors(lead.priority).gradient}`}></div>
                      
                      <div className="relative">
                        <div className="flex items-center mb-3">
                          {/* Icon based on priority level */}
                          {(() => {
                            let PriorityIcon;
                            if (lead.priority === 'urgent') PriorityIcon = AlertTriangle;
                            else if (lead.priority === 'high') PriorityIcon = ArrowUp;
                            else if (lead.priority === 'medium') PriorityIcon = Minus;
                            else if (lead.priority === 'low') PriorityIcon = ArrowDown;
                            
                            return PriorityIcon ? (
                              <TooltipProvider>
                                <Tooltip delayDuration={300}>
                                  <TooltipTrigger asChild>
                                    <div className="relative flex items-center justify-center mr-3 cursor-help transition-transform hover:scale-110 duration-200">
                                      <div className={`absolute inset-0 bg-gradient-to-br ${getPriorityColors(lead.priority).gradient} opacity-20 blur-sm rounded-full`}></div>
                                      <div className={`w-6 h-6 ${getPriorityColors(lead.priority).indicator} rounded-full flex items-center justify-center ${getPriorityColors(lead.priority).ring}`}>
                                        <PriorityIcon className="h-3.5 w-3.5 text-white" />
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[250px] p-3">
                                    <p className="font-medium mb-1 text-sm">{lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)} Priority</p>
                                    <p className="text-xs text-neutral-500">{getPriorityDescription(lead.priority)}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : null;
                          })()}
                          
                          <span className={`text-sm font-medium ${priorityText}`}>
                            {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)} Priority
                          </span>
                        </div>
                        
                        {lead.priorityReason && (
                          <div className="mb-2 pl-1">
                            <p className="text-sm text-neutral-600">
                              <span className="font-medium">Reason:</span> {lead.priorityReason}
                            </p>
                          </div>
                        )}
                        
                        {lead.priorityScore && (
                          <div className="mb-2 pl-1">
                            <p className="text-sm text-neutral-600">
                              <span className="font-medium">Score:</span> {lead.priorityScore}/100
                            </p>
                          </div>
                        )}
                        
                        {lead.priorityUpdatedAt && (
                          <p className="text-xs text-neutral-500 mt-2 pl-1">
                            Last updated {formatDate(lead.priorityUpdatedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              {lead.notes && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-neutral-600">{lead.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {enrichment && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Enrichment Data</CardTitle>
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enhanced-scraping"
                      checked={useEnhancedScraping}
                      onCheckedChange={updateEnhancedScrapingSetting}
                    />
                    <label
                      htmlFor="enhanced-scraping"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      AI Enhanced
                    </label>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={refreshEnrichment} 
                    disabled={isRefreshing || !lead.website}
                  >
                    {isRefreshing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh Data
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Company Info - Always show */}
                {enrichment.companyInfo && (
                  <div>
                    <p className="text-sm font-medium mb-2">Company Info</p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {enrichment.companyInfo.industry && (
                        <>
                          <dt className="text-neutral-500">Industry:</dt>
                          <dd>{enrichment.companyInfo.industry}</dd>
                        </>
                      )}
                      {enrichment.companyInfo.employeeCount && (
                        <>
                          <dt className="text-neutral-500">Employees:</dt>
                          <dd>{enrichment.companyInfo.employeeCount}</dd>
                        </>
                      )}
                      {enrichment.companyInfo.founded && (
                        <>
                          <dt className="text-neutral-500">Founded:</dt>
                          <dd>{enrichment.companyInfo.founded}</dd>
                        </>
                      )}
                      {enrichment.companyInfo.location && (
                        <>
                          <dt className="text-neutral-500">Location:</dt>
                          <dd>{enrichment.companyInfo.location}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                )}

                {/* Tech Stack - Always show */}
                {enrichment.techStack && (
                  <div>
                    <p className="text-sm font-medium mb-2">Tech Stack</p>
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      {enrichment.techStack.frontend && enrichment.techStack.frontend.length > 0 && (
                        <>
                          <dt className="text-neutral-500">Frontend:</dt>
                          <dd>{enrichment.techStack.frontend.join(", ")}</dd>
                        </>
                      )}
                      {enrichment.techStack.backend && enrichment.techStack.backend.length > 0 && (
                        <>
                          <dt className="text-neutral-500">Backend:</dt>
                          <dd>{enrichment.techStack.backend.join(", ")}</dd>
                        </>
                      )}
                      {enrichment.techStack.database && enrichment.techStack.database.length > 0 && (
                        <>
                          <dt className="text-neutral-500">Database:</dt>
                          <dd>{enrichment.techStack.database.join(", ")}</dd>
                        </>
                      )}
                      {enrichment.techStack.cloud && enrichment.techStack.cloud.length > 0 && (
                        <>
                          <dt className="text-neutral-500">Cloud:</dt>
                          <dd>{enrichment.techStack.cloud.join(", ")}</dd>
                        </>
                      )}
                    </dl>
                  </div>
                )}

                {/* Recent Events - Always show */}
                {enrichment.recentEvents && (
                  <div>
                    <p className="text-sm font-medium mb-2">Recent Events</p>
                    {enrichment.recentEvents.news && enrichment.recentEvents.news.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm font-medium text-neutral-500">News:</p>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {enrichment.recentEvents.news.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {enrichment.recentEvents.blogPosts && enrichment.recentEvents.blogPosts.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-neutral-500">Blog Posts:</p>
                        <ul className="list-disc pl-5 text-sm space-y-1">
                          {enrichment.recentEvents.blogPosts.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* AI-Enhanced Only: Insights */}
                {useEnhancedScraping && enrichment.insights && enrichment.insights.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">AI Insights</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {enrichment.insights.map((insight, i) => (
                        <li key={i}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Show Personalization Hooks regardless of enhancement setting */}
                {enrichment.personalizationHooks && enrichment.personalizationHooks.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Personalization Hooks</p>
                    <ul className="list-disc pl-5 text-sm space-y-1">
                      {enrichment.personalizationHooks.map((hook, i) => (
                        <li key={i}>{hook}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Show a notice when AI Enhancement is disabled */}
                {!useEnhancedScraping && (
                  <Alert variant="outline" className="bg-blue-50 border-blue-200 mt-2">
                    <AlertTitle className="text-blue-800 font-medium text-sm">AI Enhancement Disabled</AlertTitle>
                    <AlertDescription className="text-blue-700 text-xs">
                      Enable AI Enhancement to get additional insights based on the company's website data.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Email Generation */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Email Generator</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="generate">
                <TabsList className="mb-4">
                  <TabsTrigger value="generate">Generate Email</TabsTrigger>
                  <TabsTrigger value="drafts">Drafts {emailDrafts?.length > 0 && `(${emailDrafts.length})`}</TabsTrigger>
                  <TabsTrigger value="historical">
                    <History className="h-4 w-4 mr-2" />
                    Historical Context
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="generate">
                  <Suspense fallback={<div className="flex justify-center p-6"><Loader2 className="animate-spin h-6 w-6 text-primary-500" /></div>}>
                    <EmailGeneratorForm leadId={leadId} lead={lead} enrichment={enrichment} />
                  </Suspense>
                </TabsContent>
                
                <TabsContent value="drafts">
                  {isLoadingDrafts ? (
                    <div className="flex justify-center p-6">
                      <Loader2 className="animate-spin h-6 w-6 text-primary-500" />
                    </div>
                  ) : emailDrafts && emailDrafts.length > 0 ? (
                    <div className="space-y-6">
                      {emailDrafts.map((draft) => (
                        <Card key={draft.id} className="overflow-hidden">
                          <CardHeader className="bg-neutral-50 pb-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold">{draft.subject}</p>
                                <p className="text-sm text-neutral-500">{formatDate(draft.createdAt)}</p>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => {
                                  setEditingDraft(draft);
                                  setIsEmailEditModalOpen(true);
                                }}>Edit</Button>
                                <Button size="sm">Use Template</Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <div className="prose prose-sm max-w-none">
                              {draft.body.split('\n').map((line, i) => (
                                <p key={i}>{line}</p>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <Mail className="h-12 w-12 text-neutral-300 mb-3" />
                      <h3 className="text-lg font-medium">No email drafts</h3>
                      <p className="text-neutral-500 mt-1 mb-4">Generate your first personalized email with the form.</p>
                      <TabsList>
                        <TabsTrigger value="generate">Create Email</TabsTrigger>
                      </TabsList>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="historical">
                  <ImportHistoricalDataForm leadId={leadId} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Email Edit Modal */}
      <Dialog open={isEmailEditModalOpen} onOpenChange={setIsEmailEditModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Email Draft</DialogTitle>
            <DialogDescription>
              Make changes to the email content below.
            </DialogDescription>
          </DialogHeader>
          
          {editingDraft && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label htmlFor="subject" className="text-sm font-medium">Subject Line:</label>
                <Input
                  id="subject"
                  value={editingDraft.subject || ''}
                  onChange={(e) => setEditingDraft({...editingDraft, subject: e.target.value})}
                  placeholder="Email subject line"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="body" className="text-sm font-medium">Email Body:</label>
                <Textarea
                  id="body"
                  value={editingDraft.body || ''}
                  onChange={(e) => setEditingDraft({...editingDraft, body: e.target.value})}
                  placeholder="Email body text"
                  className="min-h-[300px]"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailEditModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={async () => {
                if (!editingDraft) return;
                
                try {
                  const response = await fetch(`/api/leads/email-drafts/${editingDraft.id}`, {
                    method: 'PATCH',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      subject: editingDraft.subject,
                      body: editingDraft.body
                    })
                  });
                  
                  if (!response.ok) {
                    throw new Error('Failed to update email draft');
                  }
                  
                  // Refresh the drafts list
                  await queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/email-drafts`] });
                  
                  setIsEmailEditModalOpen(false);
                  toast({
                    title: 'Success',
                    description: 'Email draft updated successfully',
                  });
                } catch (error) {
                  toast({
                    title: 'Error',
                    description: error instanceof Error ? error.message : 'Failed to update email draft',
                    variant: 'destructive'
                  });
                }
              }}
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
