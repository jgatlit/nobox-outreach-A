import * as React from "react";
import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Search, Plus } from "lucide-react";

import { LeadTable } from "@/components/LeadManagement/LeadTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

// Define schemas for the forms
const addLeadFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email"),
  company: z.string().min(1, "Company name is required"),
  title: z.string().optional(),
  phoneNumber: z.string().optional(),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal('')),
  linkedinUrl: z.string().url("Please enter a valid LinkedIn URL").optional().or(z.literal('')),
  source: z.enum(["pipedrive", "asana", "email", "instantly", "cyberleads", "linkedin", "manual"]),
  notes: z.string().optional(),
});

type AddLeadFormValues = z.infer<typeof addLeadFormSchema>;

export default function LeadManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch leads or search results
  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ['/api/leads/search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return null;
      const response = await fetch(`/api/leads/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error("Search failed");
      }
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  // Form for adding new leads
  const addLeadForm = useForm<AddLeadFormValues>({
    resolver: zodResolver(addLeadFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      company: "",
      title: "",
      phoneNumber: "",
      website: "",
      linkedinUrl: "",
      source: "manual",
      notes: "",
    },
  });

  // Handlers
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is triggered by the useQuery hook
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCsvImportClick = () => {
    if (csvFileInputRef.current) {
      csvFileInputRef.current.click();
    }
  };

  const handleCsvFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast({
        title: "Invalid file type",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      toast({
        title: "Uploading CSV",
        description: "Please wait while we process your file...",
      });

      const response = await fetch("/api/leads/import/csv", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Import successful",
          description: `Successfully imported ${result.imported} leads.`,
        });
        // Refresh leads list
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else {
        toast({
          title: "Import issues",
          description: result.message || "There were some issues with the import.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Import failed",
        description: "There was an error importing the CSV file.",
        variant: "destructive",
      });
    } finally {
      // Reset the file input
      if (csvFileInputRef.current) {
        csvFileInputRef.current.value = "";
      }
    }
  };

  const onAddLeadSubmit = async (values: AddLeadFormValues) => {
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const result = await response.json();

      if (response.ok) {
        toast({
          title: "Lead added",
          description: "New lead has been successfully added",
        });
        setAddLeadOpen(false);
        addLeadForm.reset();
        queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
      } else if (response.status === 409) {
        // Duplicate email
        toast({
          title: "Duplicate lead",
          description: `A lead with email ${values.email} already exists`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to add lead",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "There was an error adding the lead",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="p-6 overflow-auto h-[calc(100vh-64px)]">
      {/* Header with title */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Lead Management</h2>
      </div>

      {/* Lead management toolbar - separate search from buttons completely */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Search */}
        <div className="order-2 md:order-1">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="w-5 h-5 text-neutral-400 absolute left-3 top-2.5" />
            <Input
              type="text"
              placeholder="Search leads..."
              className="pl-10 pr-4 py-2 w-full"
              value={searchQuery}
              onChange={handleInputChange}
            />
          </form>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-3 order-1 md:order-2">
          {/* Add Lead Dialog */}
          <Dialog open={addLeadOpen} onOpenChange={setAddLeadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 text-white hover:bg-blue-700">
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <DialogDescription>
                  Enter the lead's information below to add them to your database.
                </DialogDescription>
              </DialogHeader>
              <Form {...addLeadForm}>
                <form onSubmit={addLeadForm.handleSubmit(onAddLeadSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={addLeadForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input placeholder="John" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addLeadForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Doe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={addLeadForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="john.doe@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={addLeadForm.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company</FormLabel>
                          <FormControl>
                            <Input placeholder="Acme Inc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addLeadForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Title</FormLabel>
                          <FormControl>
                            <Input placeholder="CTO" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={addLeadForm.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a source" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pipedrive">Pipedrive</SelectItem>
                            <SelectItem value="asana">Asana</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="instantly">Instantly.ai</SelectItem>
                            <SelectItem value="cyberleads">Cyberleads</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                            <SelectItem value="manual">Manual Entry</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addLeadForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 (555) 123-4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={addLeadForm.control}
                      name="website"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Website</FormLabel>
                          <FormControl>
                            <Input placeholder="https://example.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={addLeadForm.control}
                      name="linkedinUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>LinkedIn URL</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://linkedin.com/in/johndoe"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={addLeadForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Additional information about this lead..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setAddLeadOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={addLeadForm.formState.isSubmitting}
                    >
                      {addLeadForm.formState.isSubmitting ? "Adding..." : "Add Lead"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          
          {/* CSV Import Button */}
          <Button 
            onClick={handleCsvImportClick}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          
          {/* Hidden file input for CSV import */}
          <input 
            type="file" 
            ref={csvFileInputRef}
            onChange={handleCsvFileChange}
            accept=".csv"
            className="hidden"
          />
        </div>
      </div>

      {/* Search results indicator */}
      {searchQuery.length >= 2 ? (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-neutral-500 mb-2">
            {isSearchLoading 
              ? "Searching..." 
              : searchResults 
                ? `Found ${searchResults.length} results for "${searchQuery}"` 
                : `No results found for "${searchQuery}"`}
          </h3>
          {searchResults && searchResults.length > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSearchQuery("")}
            >
              Clear search
            </Button>
          )}
        </div>
      ) : null}

      {/* Leads table */}
      <LeadTable data={searchQuery.length >= 2 ? searchResults : undefined} />
    </main>
  );
}
