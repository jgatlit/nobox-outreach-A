import * as React from "react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  campaignPurpose: z.string().min(5, "Campaign purpose is required"),
  serviceOffering: z.string().min(5, "Service offering is required"),
  tone: z.string().default("professional"),
  formality: z.number().min(1).max(5).default(3),
  usePersonalizedHooks: z.boolean().default(true),
  customHooks: z.string().optional(),
  includeRecentEvents: z.boolean().default(true),
  subjectLineStyle: z.string().default("direct"),
  attentionHookStyle: z.string().default("curiosity"),
  emailLength: z.string().default("medium"),
  callToAction: z.string().min(5, "Call to action is required").optional(),
  // Historical context fields
  useHistoricalContext: z.boolean().default(false),
  includeProjectHistory: z.boolean().default(true),
  includeEmailHistory: z.boolean().default(true),
  includeProposalHistory: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

const toneOptions = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "friendly", label: "Friendly" },
  { value: "authoritative", label: "Authoritative" },
  { value: "empathetic", label: "Empathetic" },
];

const subjectLineOptions = [
  { value: "direct", label: "Direct" },
  { value: "question", label: "Question" },
  { value: "benefit", label: "Value/Benefit" },
  { value: "curiosity", label: "Curiosity" },
];

const attentionHookOptions = [
  { value: "curiosity", label: "Curiosity - Break expectations, create intrigue" },
  { value: "ego-trigger", label: "Ego Trigger - Novel, personalized praise" },
  { value: "open-loop", label: "Open Loop - Create unanswered questions" },
  { value: "hyper-relevance", label: "Hyper Relevance - Show specific research" },
  { value: "pattern-break", label: "Pattern Break - Flip the script" },
];

const lengthOptions = [
  { value: "short", label: "Short (100-150 words)" },
  { value: "medium", label: "Medium (150-200 words)" },
  { value: "long", label: "Long (200-250 words)" },
];

interface EmailGeneratorFormProps {
  leadId: number;
  lead: any;
  enrichment: any;
}

export function EmailGeneratorForm({ leadId, lead, enrichment }: EmailGeneratorFormProps) {
  const [previewEmail, setPreviewEmail] = useState(null);
  const [activeTab, setActiveTab] = useState("form");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      campaignPurpose: "",
      serviceOffering: "",
      tone: "professional",
      formality: 3,
      usePersonalizedHooks: true,
      includeRecentEvents: true,
      subjectLineStyle: "direct",
      emailLength: "medium",
      callToAction: "Would you be available for a 15-minute call next week to discuss this further?",
      // Historical context defaults
      useHistoricalContext: false,
      includeProjectHistory: true,
      includeEmailHistory: true,
      includeProposalHistory: true,
    },
  });

  const generateEmail = useMutation({
    mutationFn: async (values: FormValues) => {
      // Combine form values with tone/style for advanced personalization
      const payload = {
        ...values,
        // Add additional parameters for style and tone
        styleParams: {
          formality: values.formality,
          includeRecentEvents: values.includeRecentEvents,
          subjectLineStyle: values.subjectLineStyle,
          emailLength: values.emailLength,
        }
      };

      const response = await fetch(`/api/leads/${leadId}/generate-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate email");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setPreviewEmail(data);
      setActiveTab("preview");
      toast({
        title: "Email Generated",
        description: "Your personalized email has been created.",
      });
      
      // Invalidate email drafts query to refresh the list
      queryClient.invalidateQueries({ queryKey: [`/api/leads/${leadId}/email-drafts`] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: error.message,
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    generateEmail.mutate(values);
  };

  const saveEmailDraft = useMutation({
    mutationFn: async () => {
      if (!previewEmail) return null;
      
      // This would typically save the already generated email draft
      // but in our case, it's already saved when generated
      return { success: true };
    },
    onSuccess: () => {
      toast({
        title: "Email Saved",
        description: "The email draft has been saved successfully.",
      });
      
      // Clear the preview and go back to the form
      setPreviewEmail(null);
      setActiveTab("form");
      form.reset();
    },
  });

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="form">Settings</TabsTrigger>
        <TabsTrigger value="preview" disabled={!previewEmail}>
          Preview
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="form">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="campaignPurpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campaign Purpose</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Introduce our AI automation services to potential clients in the SaaS industry"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The main goal of your outreach campaign.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="serviceOffering"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Offering</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Our AI-driven workflow automation reduces manual tasks by 75% and improves team productivity."
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      The specific service or product you're offering this lead.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Separator />
            
            <h3 className="text-lg font-medium">Email Style & Tone</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="tone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tone</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select tone" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {toneOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The overall tone of your email.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="formality"
                  render={({ field: { value, onChange } }) => (
                    <FormItem>
                      <FormLabel>Formality Level (1-5)</FormLabel>
                      <div className="pt-2">
                        <div className="flex justify-between text-xs text-neutral-500 mb-1">
                          <span>More Casual</span>
                          <span>More Formal</span>
                        </div>
                        <FormControl>
                          <Slider
                            min={1}
                            max={5}
                            step={1}
                            value={[value]}
                            onValueChange={(vals) => onChange(vals[0])}
                            className="cursor-pointer"
                          />
                        </FormControl>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs text-neutral-500">1</span>
                          <span className="text-xs text-neutral-500">2</span>
                          <span className="text-xs text-neutral-500">3</span>
                          <span className="text-xs text-neutral-500">4</span>
                          <span className="text-xs text-neutral-500">5</span>
                        </div>
                      </div>
                      <FormDescription>
                        How formal or casual the language should be.
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="subjectLineStyle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Subject Line Style</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select style" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subjectLineOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The style of the email subject line.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="emailLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Length</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select length" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {lengthOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        The preferred length of the email content.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            <Separator />
            
            <h3 className="text-lg font-medium">Personalization</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="usePersonalizedHooks"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Use Personalization Hooks
                        </FormLabel>
                        <FormDescription>
                          Include personalized hooks from enrichment data
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="includeRecentEvents"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Reference Recent Events
                        </FormLabel>
                        <FormDescription>
                          Mention recent company events or news
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                {/* Historical Context Main Toggle */}
                <FormField
                  control={form.control}
                  name="useHistoricalContext"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg bg-slate-50">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-semibold">
                          Use Historical Context
                        </FormLabel>
                        <FormDescription>
                          Reference past projects and email history
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                
                {/* Historical Context Sub-Options - Only show when Historical Context is enabled */}
                {form.watch("useHistoricalContext") && (
                  <div className="pl-4 border-l-2 border-l-slate-200 space-y-4 ml-2">
                    <FormField
                      control={form.control}
                      name="includeProjectHistory"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-3 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">
                              Include Asana Project History
                            </FormLabel>
                            <FormDescription className="text-xs">
                              Reference past and current projects
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="includeEmailHistory"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-3 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">
                              Include Email History
                            </FormLabel>
                            <FormDescription className="text-xs">
                              Reference previous email conversations
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="includeProposalHistory"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between p-3 border rounded-lg">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">
                              Include Proposal History
                            </FormLabel>
                            <FormDescription className="text-xs">
                              Reference previous proposals and services
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                )}
              </div>
              
              <FormField
                control={form.control}
                name="customHooks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Custom Personalization Hooks (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., Reference their recent blog post on AI implementation"
                        className="min-h-[110px]"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Additional personalization elements to include in the email.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="callToAction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Call to Action</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Would you be available for a 15-minute call next week?"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The specific action you want the recipient to take.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end">
              <Button
                type="submit"
                className="min-w-[150px]"
                disabled={generateEmail.isPending}
              >
                {generateEmail.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Email"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </TabsContent>
      
      <TabsContent value="preview">
        {previewEmail ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="mb-6">
                  <p className="text-sm text-neutral-500 mb-1">Subject</p>
                  <p className="text-lg font-medium">{previewEmail.subject}</p>
                </div>
                
                <Separator className="my-4" />
                
                <div>
                  <p className="text-sm text-neutral-500 mb-2">Body</p>
                  <div className="prose prose-sm max-w-none">
                    {previewEmail.body.split('\n').map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setActiveTab("form");
                }}
              >
                Edit Parameters
              </Button>
              
              <Button 
                onClick={() => {
                  // Instead of a separate save, display success message
                  // Since our API already saves the draft on generation
                  toast({
                    title: "Email Saved",
                    description: "The email draft has been saved to the lead's profile.",
                  });
                  
                  // Reset the form and preview
                  setPreviewEmail(null);
                  setActiveTab("form"); 
                  form.reset();
                }}
              >
                Save & Create New
              </Button>
            </div>
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>No Email Preview</AlertTitle>
            <AlertDescription>
              Please generate an email first to see the preview.
            </AlertDescription>
          </Alert>
        )}
      </TabsContent>
    </Tabs>
  );
}
