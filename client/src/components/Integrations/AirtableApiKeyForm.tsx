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
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

const formSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
});

type FormValues = z.infer<typeof formSchema>;

export function AirtableApiKeyForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isValidating, setIsValidating] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      apiKey: "",
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      return await apiRequest("/api/airtable/validate-key", "POST", values);
    },
    onSuccess: (data) => {
      setValidationResult(data);
    },
    onError: (error) => {
      toast({
        title: "Validation Error",
        description: error instanceof Error ? error.message : "Failed to validate API key",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsValidating(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      return await apiRequest("/api/airtable/update-key", "POST", values);
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Airtable API key updated successfully",
      });
      
      // Invalidate all Airtable-related queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/airtable/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/airtable/diagnostics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
    },
    onError: (error) => {
      toast({
        title: "Update Error",
        description: error instanceof Error ? error.message : "Failed to update API key",
        variant: "destructive",
      });
    },
  });

  const onValidate = (values: FormValues) => {
    setIsValidating(true);
    setValidationResult(null);
    validateMutation.mutate(values);
  };

  const onSubmit = (values: FormValues) => {
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

            {/* Validation Result */}
            {validationResult && (
              <Alert
                variant={validationResult.valid ? "default" : "destructive"}
                className="mt-4"
              >
                {validationResult.valid ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertTitle>
                  {validationResult.valid ? "Valid API Key" : "Invalid API Key"}
                </AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <strong>Type:</strong> 
                      <Badge variant={validationResult.type === "pat" ? "default" : "outline"}>
                        {validationResult.type === "pat" 
                          ? "Personal Access Token (PAT)" 
                          : validationResult.type === "classic_key" 
                          ? "Classic API Key" 
                          : "Unknown"}
                      </Badge>
                    </div>
                    <div>
                      <strong>Message:</strong> {validationResult.message}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onValidate(form.getValues())}
                disabled={isValidating || validateMutation.isPending}
              >
                {isValidating || validateMutation.isPending ? "Validating..." : "Validate Key"}
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending || !validationResult?.valid}
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