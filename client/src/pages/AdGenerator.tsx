import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const adPromptSchema = z.object({
  industry: z.string().min(1, "Industry is required"),
  campaignPurpose: z.string().min(1, "Campaign purpose is required"),
  targetAudience: z.string().min(1, "Target audience is required"),
  style: z.string().optional(),
  mood: z.string().optional(),
});

export default function AdGenerator() {
  const { toast } = useToast();
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  
  const { data: adCampaigns, isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ['/api/ad-campaigns'],
    staleTime: 60000,
  });
  
  const { data: selectedCampaignData, isLoading: isLoadingCampaignData } = useQuery({
    queryKey: ['/api/ad-campaigns', selectedCampaign],
    queryFn: async ({ queryKey }) => {
      const [_, campaignId] = queryKey;
      if (!campaignId) return null;
      
      const response = await fetch(`/api/ad-campaigns/${campaignId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch campaign data");
      }
      return response.json();
    },
    enabled: !!selectedCampaign,
  });
  
  const form = useForm<z.infer<typeof adPromptSchema>>({
    resolver: zodResolver(adPromptSchema),
    defaultValues: {
      industry: "",
      campaignPurpose: "",
      targetAudience: "",
      style: "modern",
      mood: "professional",
    },
  });
  
  const generatePromptMutation = useMutation({
    mutationFn: async (values: z.infer<typeof adPromptSchema>) => {
      const response = await apiRequest("POST", "/api/generate-midjourney-prompt", values);
      return response.json();
    },
    onSuccess: (data) => {
      setGeneratedPrompt(data.prompt);
      toast({
        title: "Prompt generated",
        description: "Your Midjourney prompt has been generated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate prompt",
        description: error.message || "An error occurred while generating the prompt.",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (values: z.infer<typeof adPromptSchema>) => {
    generatePromptMutation.mutate(values);
  };
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
    toast({
      title: "Copied to clipboard",
      description: "The Midjourney prompt has been copied to your clipboard.",
    });
  };
  
  return (
    <main className="p-6 overflow-auto h-[calc(100vh-64px)]">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Ad Campaign Generator</h2>
        <p className="text-neutral-500">
          Generate compelling ad creative prompts for Midjourney based on your campaign details.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Generate Ad Prompt</CardTitle>
            <CardDescription>
              Fill in the details below to generate a tailored Midjourney prompt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Industry</FormLabel>
                      <FormControl>
                        <Input placeholder="Technology, Healthcare, Finance, etc." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="campaignPurpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Purpose</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="e.g., Promoting AI automation solutions to streamline operations" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="targetAudience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Audience</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="e.g., CTOs and IT Directors at mid-size companies" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="style"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Visual Style</FormLabel>
                        <Select 
                          defaultValue={field.value} 
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select style" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="modern">Modern</SelectItem>
                            <SelectItem value="futuristic">Futuristic</SelectItem>
                            <SelectItem value="minimal">Minimal</SelectItem>
                            <SelectItem value="corporate">Corporate</SelectItem>
                            <SelectItem value="abstract">Abstract</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="mood"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mood/Tone</FormLabel>
                        <Select 
                          defaultValue={field.value} 
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select mood" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="professional">Professional</SelectItem>
                            <SelectItem value="ambitious">Ambitious</SelectItem>
                            <SelectItem value="innovative">Innovative</SelectItem>
                            <SelectItem value="trustworthy">Trustworthy</SelectItem>
                            <SelectItem value="energetic">Energetic</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={generatePromptMutation.isPending}
                >
                  {generatePromptMutation.isPending ? "Generating..." : "Generate Prompt"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generated Midjourney Prompt</CardTitle>
              <CardDescription>
                Copy this prompt to use in Midjourney for generating ad creatives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-neutral-50 p-4 rounded-md min-h-[200px] border border-neutral-200">
                {generatePromptMutation.isPending ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                    <div className="h-4 bg-neutral-200 rounded w-full"></div>
                    <div className="h-4 bg-neutral-200 rounded w-5/6"></div>
                    <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                  </div>
                ) : generatedPrompt ? (
                  <p className="whitespace-pre-wrap">{generatedPrompt}</p>
                ) : (
                  <p className="text-neutral-400 italic">
                    Fill out the form and click "Generate Prompt" to create a Midjourney prompt
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button 
                variant="outline" 
                onClick={copyToClipboard}
                disabled={!generatedPrompt}
              >
                Copy to Clipboard
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Existing Ad Variants</CardTitle>
              <CardDescription>
                View existing ad variants from previous campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCampaigns ? (
                      <SelectItem value="loading">Loading campaigns...</SelectItem>
                    ) : adCampaigns && adCampaigns.length > 0 ? (
                      adCampaigns.map((campaign) => (
                        <SelectItem key={campaign.id} value={campaign.id.toString()}>
                          {campaign.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none">No campaigns available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                
                {isLoadingCampaignData ? (
                  <div className="animate-pulse space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 bg-neutral-200 rounded w-1/3"></div>
                        <div className="h-3 bg-neutral-200 rounded w-full"></div>
                        <div className="h-3 bg-neutral-200 rounded w-2/3"></div>
                      </div>
                    ))}
                  </div>
                ) : selectedCampaignData?.variants && selectedCampaignData.variants.length > 0 ? (
                  <div className="space-y-4">
                    {selectedCampaignData.variants.map((variant) => (
                      <div key={variant.id} className="border p-3 rounded-md">
                        <h4 className="font-medium">{variant.headline}</h4>
                        <p className="text-sm text-neutral-600 mt-1">{variant.body}</p>
                        {variant.midjourneyPrompt && (
                          <div className="mt-2">
                            <p className="text-xs text-neutral-400">Prompt:</p>
                            <p className="text-xs mt-1 text-neutral-600 italic">
                              {variant.midjourneyPrompt}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : selectedCampaign ? (
                  <p className="text-neutral-500 p-4 text-center">
                    No ad variants found for this campaign
                  </p>
                ) : (
                  <p className="text-neutral-500 p-4 text-center">
                    Select a campaign to view its ad variants
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
