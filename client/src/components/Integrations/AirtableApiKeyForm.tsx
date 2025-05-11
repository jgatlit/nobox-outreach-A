import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "../../hooks/use-toast";
import { apiRequest } from "../../lib/queryClient";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// Interface for the authentication result
interface AuthResult {
  type: "pat" | "classic_key" | "unknown";
  status?: "valid" | "invalid" | "untested";
  hasPrefix?: boolean;
}

const formSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

type FormValues = z.infer<typeof formSchema>;

export function AirtableApiKeyForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apiKey: "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      return await apiRequest("/api/airtable/update-key", "POST", values);
    },
    onSuccess: (data: any) => {
      if (data && data.details) {
        setAuthResult(data.details);
      }
      
      toast({
        title: "Success",
        description: data && data.message ? data.message : "Airtable API key updated successfully",
      });
      
      // Invalidate all Airtable-related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/airtable/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/airtable/diagnostics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      
      // Reset form
      form.reset();
    },
    onError: (error: any) => {
      let errorMessage = "Failed to update API key";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        // Try to extract API error message
        if (error.error) {
          errorMessage = error.error;
        } else if (error.message) {
          errorMessage = error.message;
        } else if (error.details) {
          errorMessage = error.details;
        }
      }
      
      toast({
        title: "Update Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (values: FormValues) => {
    setAuthResult(null);
    updateMutation.mutate(values);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Update Airtable API Key</CardTitle>
        <CardDescription>
          Enter a Personal Access Token (PAT) for Airtable authentication
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Airtable API Key</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter your Airtable Personal Access Token (PAT)"
                      {...field}
                      type="password"
                    />
                  </FormControl>
                  <FormDescription>
                    <div className="text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        For better security, use a Personal Access Token (PAT) that starts with "pat"
                      </span>
                    </div>
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Authentication Result */}
            {authResult && (
              <Alert
                variant="default"
                className="mt-4"
              >
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>API Key Set Successfully</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <strong>Type:</strong> 
                      <Badge variant={authResult.type === "pat" ? "default" : "outline"}>
                        {authResult.type === "pat" 
                          ? "Personal Access Token (PAT)" 
                          : authResult.type === "classic_key" 
                          ? "Classic API Key" 
                          : "Unknown"}
                      </Badge>
                    </div>
                    {authResult.hasPrefix !== undefined && (
                      <div>
                        <strong>Format:</strong> {authResult.hasPrefix ? "Contains proper prefix" : "No prefix detected"}
                      </div>
                    )}
                    {authResult.status && (
                      <div>
                        <strong>Status:</strong> {authResult.status === 'valid' ? 'Valid and authenticated' : 'Unknown'}
                      </div>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Updating..." : "Update Key"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col items-start text-sm text-muted-foreground">
        <p>If you encounter authentication issues with Airtable, try providing a new Personal Access Token (PAT).</p>
        <p className="mt-1">
          <strong>Important:</strong> API keys are temporarily stored in memory and will be reset when the server restarts.
        </p>
      </CardFooter>
    </Card>
  );
}