import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/data-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CalendarIcon, Plus, Mail, Image } from "lucide-react";
import { formatDate } from "@/lib/utils";

const campaignFormSchema = z.object({
  name: z.string().min(2, "Campaign name must be at least 2 characters"),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  segmentFilters: z.record(z.string(), z.any()).optional(),
});

export default function Campaigns() {
  const [activeTab, setActiveTab] = React.useState("email");
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: emailCampaigns, isLoading: isLoadingEmailCampaigns } = useQuery({
    queryKey: ['/api/campaigns'],
    staleTime: 60000,
  });

  const { data: adCampaigns, isLoading: isLoadingAdCampaigns } = useQuery({
    queryKey: ['/api/ad-campaigns'],
    staleTime: 60000,
  });

  // Form for adding a new campaign
  const form = useForm<z.infer<typeof campaignFormSchema>>({
    resolver: zodResolver(campaignFormSchema),
    defaultValues: {
      name: "",
      description: "",
      isActive: true,
      segmentFilters: {},
    },
  });

  const addCampaignMutation = useMutation({
    mutationFn: async (values: z.infer<typeof campaignFormSchema>) => {
      const response = await apiRequest("POST", "/api/campaigns", values);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Campaign created",
        description: "Your campaign has been created successfully.",
      });
      form.reset();
      setIsAddDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
    },
    onError: (error) => {
      toast({
        title: "Failed to create campaign",
        description: error.message || "An error occurred while creating the campaign.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: z.infer<typeof campaignFormSchema>) => {
    addCampaignMutation.mutate(values);
  };

  // Email campaigns data table columns
  const emailCampaignsColumns = [
    {
      key: "name",
      header: "Campaign Name",
      render: (campaign) => (
        <div className="font-medium">{campaign.name}</div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (campaign) => campaign.description || "-",
    },
    {
      key: "status",
      header: "Status",
      render: (campaign) => (
        <Badge variant={campaign.isActive ? "default" : "secondary"}>
          {campaign.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (campaign) => formatDate(campaign.createdAt),
    },
  ];

  // Ad campaigns data table columns
  const adCampaignsColumns = [
    {
      key: "name",
      header: "Campaign Name",
      render: (campaign) => (
        <div className="font-medium">{campaign.name}</div>
      ),
    },
    {
      key: "segment",
      header: "Segment",
      render: (campaign) => (
        <Badge variant="outline" className="capitalize">
          {campaign.segment}
        </Badge>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (campaign) => campaign.description || "-",
    },
    {
      key: "createdAt",
      header: "Created",
      render: (campaign) => formatDate(campaign.createdAt),
    },
  ];

  const campaignActions = (campaign) => (
    <>
      <Button variant="ghost" size="sm">
        View
      </Button>
      <Button variant="ghost" size="sm">
        Edit
      </Button>
    </>
  );

  return (
    <main className="p-6 overflow-auto h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Campaign Management</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary-600 hover:bg-primary-700">
              <Plus className="mr-2 h-4 w-4" /> New Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Create New Campaign</DialogTitle>
              <DialogDescription>
                Set up a new outreach campaign for your leads.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Q3 Tech Outreach" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Campaign targeting tech companies for AI automation services" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Active Campaign
                        </FormLabel>
                        <FormDescription>
                          Make this campaign active immediately upon creation.
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
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={addCampaignMutation.isPending}>
                    {addCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue={activeTab} value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="email" className="flex items-center">
            <Mail className="mr-2 h-4 w-4" />
            Email Campaigns
          </TabsTrigger>
          <TabsTrigger value="ad" className="flex items-center">
            <Image className="mr-2 h-4 w-4" />
            Ad Campaigns
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="email">
          <DataTable
            columns={emailCampaignsColumns}
            data={emailCampaigns || []}
            rowKey="id"
            pagination={true}
            isLoading={isLoadingEmailCampaigns}
            actions={campaignActions}
            emptyMessage="No email campaigns found."
          />
        </TabsContent>
        
        <TabsContent value="ad">
          <DataTable
            columns={adCampaignsColumns}
            data={adCampaigns || []}
            rowKey="id"
            pagination={true}
            isLoading={isLoadingAdCampaigns}
            actions={campaignActions}
            emptyMessage="No ad campaigns found."
          />
        </TabsContent>
      </Tabs>
    </main>
  );
}
