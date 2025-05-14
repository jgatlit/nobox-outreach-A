import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { LightbulbIcon, RefreshCw, CheckCircle2, FileWarning, MessageSquareDashed, Shield, TrendingUp, PieChart, BarChart, Zap, Award, Sparkles, Loader2 } from "lucide-react";

interface SalesCoachingTip {
  tip: string;
  explanation: string;
  category: 'approach' | 'objection-handling' | 'value-proposition' | 'follow-up' | 'closing';
  relevanceScore: number;
}

interface SalesCoachingData {
  tips: SalesCoachingTip[];
  prospectAnalysis: string;
  suggestedApproach: string;
  potentialObjections: string[];
  keyValuePropositions: string[];
}

interface SalesCoachingPanelProps {
  leadId: number;
  hasEnrichment: boolean;
}

export default function SalesCoachingPanel({ leadId, hasEnrichment }: SalesCoachingPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();

  // Query for retrieving existing sales coaching data
  const { data: coachingData, isLoading, isError } = useQuery({
    queryKey: [`/api/leads/${leadId}/sales-coaching`],
    queryFn: async () => {
      try {
        const response = await fetch(`/api/leads/${leadId}/sales-coaching`);
        if (response.status === 404) {
          // Not found is expected if coaching data hasn't been generated yet
          return null;
        }
        if (!response.ok) {
          throw new Error("Failed to fetch sales coaching data");
        }
        return response.json() as Promise<SalesCoachingData>;
      } catch (error) {
        // If 404, we return null to indicate no coaching data yet
        return null;
      }
    },
    enabled: !!leadId && hasEnrichment,
  });

  // Mutation for generating sales coaching tips
  const generateCoachingMutation = useMutation({
    mutationFn: async () => {
      setIsGenerating(true);
      const response = await fetch(`/api/leads/${leadId}/sales-coaching`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate sales coaching tips");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/sales-coaching`] });
      toast({
        title: "Success",
        description: "Sales coaching tips generated successfully",
        variant: "default",
      });
      setIsGenerating(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate sales coaching tips",
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  // Helper function to get icon for tip category
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'approach':
        return <MessageSquareDashed className="h-4 w-4" />;
      case 'objection-handling':
        return <Shield className="h-4 w-4" />;
      case 'value-proposition':
        return <Award className="h-4 w-4" />;
      case 'follow-up':
        return <TrendingUp className="h-4 w-4" />;
      case 'closing':
        return <CheckCircle2 className="h-4 w-4" />;
      default:
        return <LightbulbIcon className="h-4 w-4" />;
    }
  };

  // Helper function to get color for tip category
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'approach':
        return "bg-blue-100 text-blue-800 border-blue-200";
      case 'objection-handling':
        return "bg-orange-100 text-orange-800 border-orange-200";
      case 'value-proposition':
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case 'follow-up':
        return "bg-purple-100 text-purple-800 border-purple-200";
      case 'closing':
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Helper function to render the tip relevance score
  const renderRelevanceScore = (score: number) => {
    const filled = Math.floor(score / 2);
    return (
      <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
          <Sparkles key={i} className={`h-3 w-3 ${i < filled ? 'text-amber-500' : 'text-gray-300'}`} />
        ))}
      </div>
    );
  };

  if (!hasEnrichment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sales Coaching Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="bg-amber-50 border-amber-200">
            <FileWarning className="h-4 w-4 text-amber-500" />
            <AlertTitle>Enrichment Required</AlertTitle>
            <AlertDescription>
              Lead enrichment is required before generating sales coaching tips. Please enrich this lead first.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sales Coaching Tips</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-6">
          <Loader2 className="h-8 w-8 text-primary-500 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sales Coaching Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <FileWarning className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              Failed to load sales coaching data. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!coachingData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sales Coaching Tips</CardTitle>
          <CardDescription>
            Get AI-powered coaching guidance for your sales approach
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm mb-4">
                Generate personalized sales coaching tips based on this lead's profile and company data.
                The AI will analyze all available information to provide strategic guidance for your outreach.
              </p>
              <Button 
                className="w-full" 
                onClick={() => generateCoachingMutation.mutate()}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating Tips...
                  </>
                ) : (
                  <>
                    <LightbulbIcon className="h-4 w-4 mr-2" />
                    Generate Sales Coaching Tips
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">Sales Coaching Tips</CardTitle>
          <CardDescription>
            AI-powered guidance for your sales approach
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => generateCoachingMutation.mutate()}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Tips
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Prospect Analysis */}
        <div>
          <div className="flex items-center mb-2">
            <PieChart className="h-4 w-4 text-primary-600 mr-2" />
            <h3 className="text-sm font-medium">Prospect Analysis</h3>
          </div>
          <p className="text-sm text-neutral-700 bg-neutral-50 p-3 rounded-md border border-neutral-100">
            {coachingData.prospectAnalysis}
          </p>
        </div>

        {/* Suggested Approach */}
        <div>
          <div className="flex items-center mb-2">
            <BarChart className="h-4 w-4 text-emerald-600 mr-2" />
            <h3 className="text-sm font-medium">Suggested Approach</h3>
          </div>
          <p className="text-sm text-neutral-700 bg-emerald-50 p-3 rounded-md border border-emerald-100">
            {coachingData.suggestedApproach}
          </p>
        </div>

        {/* Coaching Tips */}
        <div>
          <div className="flex items-center mb-2">
            <LightbulbIcon className="h-4 w-4 text-amber-600 mr-2" />
            <h3 className="text-sm font-medium">Coaching Tips</h3>
          </div>
          <div className="space-y-3">
            {coachingData.tips.map((tip, index) => (
              <div 
                key={index} 
                className="border rounded-md p-3 shadow-sm hover:shadow-md transition-shadow duration-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <div className="mr-2">
                      {getCategoryIcon(tip.category)}
                    </div>
                    <h4 className="text-sm font-medium">{tip.tip}</h4>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={`text-xs ${getCategoryColor(tip.category)}`}>
                      {tip.category.replace('-', ' ')}
                    </Badge>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          {renderRelevanceScore(tip.relevanceScore)}
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">Relevance Score: {tip.relevanceScore}/10</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <p className="text-sm text-neutral-600">{tip.explanation}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Potential Objections */}
        <div>
          <div className="flex items-center mb-2">
            <Shield className="h-4 w-4 text-orange-600 mr-2" />
            <h3 className="text-sm font-medium">Potential Objections</h3>
          </div>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {coachingData.potentialObjections.map((objection, index) => (
              <li key={index} className="text-neutral-700">{objection}</li>
            ))}
          </ul>
        </div>

        {/* Key Value Propositions */}
        <div>
          <div className="flex items-center mb-2">
            <Zap className="h-4 w-4 text-blue-600 mr-2" />
            <h3 className="text-sm font-medium">Key Value Propositions</h3>
          </div>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {coachingData.keyValuePropositions.map((prop, index) => (
              <li key={index} className="text-neutral-700">{prop}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}