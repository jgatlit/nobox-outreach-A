import * as React from "react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Users,
  Download,
  Send,
  Filter,
  Sparkles,
  Building2,
  Mail,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ListPlus,
  Zap,
} from "lucide-react";

import { AdvancedFilters } from "@/components/Apollo/AdvancedFilters";
import { SendToApolloModal } from "@/components/Apollo/SendToApolloModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  useApolloSearch,
  useImportContacts,
  useApolloHealth,
  useICPPresets,
  apolloApi,
  ApolloPerson,
  ApolloSearchFilters,
  ApolloSearchMode,
} from "@/lib/apolloApi";

export default function ApolloDiscovery() {
  // State
  const [filters, setFilters] = useState<ApolloSearchFilters>({});
  const [searchMode, setSearchMode] = useState<ApolloSearchMode>("structured");
  const [searchResults, setSearchResults] = useState<ApolloPerson[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total_entries: 0,
    total_pages: 0,
  });
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [selectedIcpKey, setSelectedIcpKey] = useState<string>("");
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [importedLeadIds, setImportedLeadIds] = useState<number[]>([]);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Queries & Mutations
  const { data: healthData, isLoading: isHealthLoading } = useApolloHealth();
  const { data: presetsData } = useICPPresets();
  const searchMutation = useApolloSearch();
  const importMutation = useImportContacts();

  const presets = presetsData?.presets || {};
  const isConfigured = healthData?.status === "configured";

  // Handlers
  const handleFiltersChange = (newFilters: ApolloSearchFilters, mode: ApolloSearchMode) => {
    setFilters(newFilters);
    setSearchMode(mode);
  };

  const handleSearch = async (searchFilters: ApolloSearchFilters, mode: ApolloSearchMode) => {
    try {
      const result = await searchMutation.mutateAsync({
        filters: searchFilters,
        mode,
        page: pagination.page,
        per_page: pagination.per_page,
      });

      setSearchResults(result.results);
      setPagination(result.pagination);
      setSelectedContacts(new Set());

      toast({
        title: "Search Complete",
        description: `Found ${result.pagination.total_entries.toLocaleString()} contacts`,
      });
    } catch (error: any) {
      toast({
        title: "Search Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePageChange = async (newPage: number) => {
    try {
      const result = await searchMutation.mutateAsync({
        filters,
        mode: searchMode,
        page: newPage,
        per_page: pagination.per_page,
      });

      setSearchResults(result.results);
      setPagination(result.pagination);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load page",
        variant: "destructive",
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === searchResults.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(searchResults.map((c) => c.id)));
    }
  };

  const toggleSelectContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const handleImportSelected = async () => {
    const selectedArray = Array.from(selectedContacts);
    const contactsToImport = searchResults.filter((c) =>
      selectedArray.includes(c.id)
    );

    if (contactsToImport.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select contacts to import",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await importMutation.mutateAsync({
        contacts: contactsToImport,
        preset_key: selectedIcpKey || undefined,
      });

      toast({
        title: "Import Complete",
        description: `Imported ${result.summary.imported} leads (${result.summary.skipped} duplicates skipped)`,
      });

      setImportedLeadIds(result.imported.map((l) => l.id));
      setSelectedContacts(new Set());

      // Invalidate leads query to refresh lists
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleImportAll = async () => {
    if (searchResults.length === 0) {
      toast({
        title: "No Results",
        description: "Run a search first",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await importMutation.mutateAsync({
        contacts: searchResults,
        preset_key: selectedIcpKey || undefined,
      });

      toast({
        title: "Import Complete",
        description: `Imported ${result.summary.imported} leads`,
      });

      setImportedLeadIds(result.imported.map((l) => l.id));
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Render not configured state
  if (!isHealthLoading && !isConfigured) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Apollo Not Configured</AlertTitle>
          <AlertDescription>
            Please configure your Apollo API key in the environment variables to use
            this feature. Set APOLLO_API_KEY in your .env file.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-yellow-500" />
            Apollo Discovery
          </h1>
          <p className="text-muted-foreground">
            Find and import leads with intelligent ICP-based targeting
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isConfigured && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filters Panel */}
        <div className="lg:col-span-1">
          <AdvancedFilters
            onFiltersChange={handleFiltersChange}
            onSearch={handleSearch}
            initialFilters={filters}
            initialMode={searchMode}
          />
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Actions Bar */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="text-sm text-muted-foreground">
                    {pagination.total_entries > 0 ? (
                      <>
                        <span className="font-medium text-foreground">
                          {pagination.total_entries.toLocaleString()}
                        </span>{" "}
                        contacts found
                      </>
                    ) : searchMutation.isPending ? (
                      "Searching..."
                    ) : (
                      "No results yet"
                    )}
                  </div>
                  {selectedContacts.size > 0 && (
                    <Badge>
                      {selectedContacts.size} selected
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* ICP Tag Selector */}
                  <Select
                    value={selectedIcpKey}
                    onValueChange={setSelectedIcpKey}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Tag with ICP..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No ICP tag</SelectItem>
                      {Object.entries(presets).map(([key, preset]: [string, any]) => (
                        <SelectItem key={key} value={key}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleImportSelected}
                    disabled={selectedContacts.size === 0 || importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Download className="h-4 w-4 mr-1" />
                    )}
                    Import Selected
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleImportAll}
                    disabled={searchResults.length === 0 || importMutation.isPending}
                  >
                    {importMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <ListPlus className="h-4 w-4 mr-1" />
                    )}
                    Import All ({searchResults.length})
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card>
            <CardContent className="p-0">
              {searchMutation.isPending ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Search className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No Results</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Configure your filters and click "Search Apollo" to discover
                    leads matching your criteria.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={
                              selectedContacts.size === searchResults.length &&
                              searchResults.length > 0
                            }
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedContacts.has(contact.id)}
                              onCheckedChange={() =>
                                toggleSelectContact(contact.id)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {contact.first_name} {contact.last_name}
                              </span>
                              {contact.linkedin_url && (
                                <a
                                  href={contact.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                                >
                                  LinkedIn
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">
                                {contact.organization?.name || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{contact.title || "—"}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {contact.email_status === "verified" ? (
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                              ) : (
                                <AlertCircle className="h-3 w-3 text-amber-500" />
                              )}
                              <span className="text-sm font-mono">
                                {contact.email || "—"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {[contact.city, contact.state, contact.country]
                                .filter(Boolean)
                                .join(", ") || "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <>
                <Separator />
                <div className="flex items-center justify-between p-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.total_pages}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1 || searchMutation.isPending}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={
                        pagination.page >= pagination.total_pages ||
                        searchMutation.isPending
                      }
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Import Success Message */}
          {importedLeadIds.length > 0 && (
            <Alert className="border-green-500">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertTitle>Import Successful</AlertTitle>
              <AlertDescription>
                {importedLeadIds.length} leads have been imported.{" "}
                <a
                  href="/leads"
                  className="font-medium underline hover:no-underline"
                >
                  View in Lead Management
                </a>
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>

      {/* Send to Apollo Modal */}
      <SendToApolloModal
        isOpen={isSendModalOpen}
        onClose={() => setIsSendModalOpen(false)}
        selectedLeadIds={importedLeadIds}
        onSuccess={() => {
          setImportedLeadIds([]);
          queryClient.invalidateQueries({ queryKey: ["apollo", "lists"] });
        }}
      />
    </div>
  );
}
