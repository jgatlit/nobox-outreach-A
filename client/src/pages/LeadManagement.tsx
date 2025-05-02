import * as React from "react";
import { LeadTable } from "@/components/LeadManagement/LeadTable";
import { ImportLeadModal } from "@/components/LeadManagement/ImportLeadModal";
import { BulkImportModal } from "@/components/LeadManagement/BulkImportModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

export default function LeadManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  
  const { data: searchResults, isLoading } = useQuery({
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Search is triggered automatically by the useQuery hook
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  return (
    <main className="p-6 overflow-auto h-[calc(100vh-64px)]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Lead Management</h2>
        <div className="flex space-x-2">
          <form onSubmit={handleSearch} className="relative">
            <Search className="w-5 h-5 text-neutral-400 absolute left-3 top-2.5" />
            <Input
              type="text"
              placeholder="Search leads..."
              className="pl-10 pr-4 py-2 min-w-[250px]"
              value={searchQuery}
              onChange={handleInputChange}
            />
          </form>
          <div className="flex space-x-2">
            <ImportLeadModal />
            <Button className="bg-primary-600 text-white hover:bg-primary-700">
              Import CSV
            </Button>
          </div>
        </div>
      </div>

      {searchQuery.length >= 2 ? (
        <div className="mb-4">
          <h3 className="text-sm font-medium text-neutral-500 mb-2">
            {isLoading 
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

      <LeadTable />
    </main>
  );
}
