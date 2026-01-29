import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  useICPPresets,
  useSearchPreview,
  apolloApi,
  ApolloSearchFilters,
  ApolloSearchMode,
} from "@/lib/apolloApi";
import {
  Filter,
  Search,
  X,
  Plus,
  Users,
  Building2,
  MapPin,
  Briefcase,
  DollarSign,
  Zap,
  Loader2,
  AlertCircle,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

// =============================================================================
// FILTER OPTIONS
// =============================================================================

const SENIORITY_OPTIONS = [
  { value: "c_suite", label: "C-Suite" },
  { value: "vp", label: "VP" },
  { value: "director", label: "Director" },
  { value: "manager", label: "Manager" },
  { value: "senior", label: "Senior" },
  { value: "entry", label: "Entry" },
];

const EMPLOYEE_RANGES = [
  { value: "1,10", label: "1-10" },
  { value: "11,50", label: "11-50" },
  { value: "51,200", label: "51-200" },
  { value: "201,500", label: "201-500" },
  { value: "501,1000", label: "501-1,000" },
  { value: "1001,5000", label: "1,001-5,000" },
  { value: "5001,10000", label: "5,001-10,000" },
  { value: "10001,", label: "10,001+" },
];

const FUNDING_STAGES = [
  { value: "pre_seed", label: "Pre-Seed" },
  { value: "seed", label: "Seed" },
  { value: "series_a", label: "Series A" },
  { value: "series_b", label: "Series B" },
  { value: "series_c", label: "Series C" },
  { value: "series_d", label: "Series D+" },
  { value: "ipo", label: "IPO" },
];

const COMMON_LOCATIONS = [
  "United States",
  "California, United States",
  "New York, United States",
  "Texas, United States",
  "Florida, United States",
  "Georgia, United States",
  "United Kingdom",
  "Canada",
  "Australia",
];

// =============================================================================
// TYPES
// =============================================================================

interface AdvancedFiltersProps {
  onFiltersChange: (filters: ApolloSearchFilters, mode: ApolloSearchMode) => void;
  onSearch: (filters: ApolloSearchFilters, mode: ApolloSearchMode) => void;
  initialFilters?: ApolloSearchFilters;
  initialMode?: ApolloSearchMode;
  showPreview?: boolean;
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function AdvancedFilters({
  onFiltersChange,
  onSearch,
  initialFilters,
  initialMode = "structured",
  showPreview = true,
  className,
}: AdvancedFiltersProps) {
  const [filters, setFilters] = React.useState<ApolloSearchFilters>(
    initialFilters || {}
  );
  const [mode, setMode] = React.useState<ApolloSearchMode>(initialMode);
  const [selectedPreset, setSelectedPreset] = React.useState<string>("");

  // Input states for tag-style inputs
  const [titleInput, setTitleInput] = React.useState("");
  const [keywordInput, setKeywordInput] = React.useState("");
  const [locationInput, setLocationInput] = React.useState("");

  const { toast } = useToast();
  const { data: presetsData } = useICPPresets();
  const previewMutation = useSearchPreview();

  const presets = presetsData?.presets || {};

  // Update parent when filters change
  React.useEffect(() => {
    onFiltersChange(filters, mode);
  }, [filters, mode, onFiltersChange]);

  // Handle preset selection
  const handlePresetChange = async (presetKey: string) => {
    if (!presetKey) {
      setSelectedPreset("");
      return;
    }

    setSelectedPreset(presetKey);

    try {
      const presetData = await apolloApi.getPresetFilters(presetKey);
      setFilters(presetData.filters);
      setMode(presetData.search_mode);

      toast({
        title: "Preset Applied",
        description: `Applied "${presets[presetKey]?.name}" filters`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load preset filters",
        variant: "destructive",
      });
    }
  };

  // Tag management helpers
  const addToArray = (key: keyof ApolloSearchFilters, value: string) => {
    if (!value.trim()) return;
    const current = (filters[key] as string[]) || [];
    if (!current.includes(value.trim())) {
      setFilters({
        ...filters,
        [key]: [...current, value.trim()],
      });
    }
  };

  const removeFromArray = (key: keyof ApolloSearchFilters, value: string) => {
    const current = (filters[key] as string[]) || [];
    setFilters({
      ...filters,
      [key]: current.filter((v) => v !== value),
    });
  };

  const toggleInArray = (key: keyof ApolloSearchFilters, value: string) => {
    const current = (filters[key] as string[]) || [];
    if (current.includes(value)) {
      removeFromArray(key, value);
    } else {
      addToArray(key, value);
    }
  };

  // Preview search
  const handlePreview = async () => {
    try {
      await previewMutation.mutateAsync({ filters, mode });
    } catch (error: any) {
      toast({
        title: "Preview Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({});
    setSelectedPreset("");
    setTitleInput("");
    setKeywordInput("");
    setLocationInput("");
  };

  // Count active filters
  const activeFilterCount = Object.entries(filters).filter(
    ([_, value]) =>
      value &&
      (Array.isArray(value) ? value.length > 0 : true)
  ).length;

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Advanced Filters
            </CardTitle>
            <CardDescription>
              Build precise search criteria for Apollo discovery
            </CardDescription>
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear ({activeFilterCount})
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ICP Preset Selector */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            Quick Start: ICP Preset
          </Label>
          <Select value={selectedPreset} onValueChange={handlePresetChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select an ICP preset to auto-fill filters..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Manual filters</SelectItem>
              {Object.entries(presets).map(([key, preset]: [string, any]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <span>{preset.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      ~{preset.estimated_leads?.toLocaleString()} leads
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Filter Sections */}
        <Accordion type="multiple" defaultValue={["person", "company"]} className="w-full">
          {/* Person Filters */}
          <AccordionItem value="person">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Person Filters
                {(filters.person_titles?.length || filters.person_seniorities?.length) && (
                  <Badge variant="secondary" className="ml-2">Active</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {/* Job Titles */}
              <div className="space-y-2">
                <Label>Job Titles</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add title (e.g., CEO, VP Sales)..."
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addToArray("person_titles", titleInput);
                        setTitleInput("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      addToArray("person_titles", titleInput);
                      setTitleInput("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {filters.person_titles?.map((title) => (
                    <Badge
                      key={title}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeFromArray("person_titles", title)}
                    >
                      {title}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Seniority */}
              <div className="space-y-2">
                <Label>Seniority Levels</Label>
                <div className="flex flex-wrap gap-2">
                  {SENIORITY_OPTIONS.map((option) => (
                    <Badge
                      key={option.value}
                      variant={
                        filters.person_seniorities?.includes(option.value)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() =>
                        toggleInArray("person_seniorities", option.value)
                      }
                    >
                      {option.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Company Filters */}
          <AccordionItem value="company">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company Filters
                {(filters.q_organization_keyword_tags?.length ||
                  filters.organization_num_employees_ranges?.length) && (
                  <Badge variant="secondary" className="ml-2">Active</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              {/* Industry Keywords */}
              <div className="space-y-2">
                <Label>Industry Keywords</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add keyword (e.g., SaaS, law firm)..."
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addToArray("q_organization_keyword_tags", keywordInput);
                        setKeywordInput("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      addToArray("q_organization_keyword_tags", keywordInput);
                      setKeywordInput("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {filters.q_organization_keyword_tags?.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() =>
                        removeFromArray("q_organization_keyword_tags", keyword)
                      }
                    >
                      {keyword}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Use specific industry terms for better results
                </p>
              </div>

              {/* Employee Count */}
              <div className="space-y-2">
                <Label>Company Size (Employees)</Label>
                <div className="flex flex-wrap gap-2">
                  {EMPLOYEE_RANGES.map((range) => (
                    <Badge
                      key={range.value}
                      variant={
                        filters.organization_num_employees_ranges?.includes(
                          range.value
                        )
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() =>
                        toggleInArray(
                          "organization_num_employees_ranges",
                          range.value
                        )
                      }
                    >
                      {range.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Funding Stage */}
              <div className="space-y-2">
                <Label>Funding Stage</Label>
                <div className="flex flex-wrap gap-2">
                  {FUNDING_STAGES.map((stage) => (
                    <Badge
                      key={stage.value}
                      variant={
                        filters.funding_stage_list?.includes(stage.value)
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer"
                      onClick={() =>
                        toggleInArray("funding_stage_list", stage.value)
                      }
                    >
                      {stage.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Location Filters */}
          <AccordionItem value="location">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location Filters
                {filters.person_locations?.length && (
                  <Badge variant="secondary" className="ml-2">Active</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Person Locations</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add location (e.g., California, United States)..."
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addToArray("person_locations", locationInput);
                        setLocationInput("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      addToArray("person_locations", locationInput);
                      setLocationInput("");
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {filters.person_locations?.map((loc) => (
                    <Badge
                      key={loc}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => removeFromArray("person_locations", loc)}
                    >
                      {loc}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
                <div className="text-xs text-muted-foreground mb-1">
                  Quick add:
                </div>
                <div className="flex flex-wrap gap-1">
                  {COMMON_LOCATIONS.filter(
                    (loc) => !filters.person_locations?.includes(loc)
                  )
                    .slice(0, 5)
                    .map((loc) => (
                      <Badge
                        key={loc}
                        variant="outline"
                        className="cursor-pointer text-xs"
                        onClick={() => addToArray("person_locations", loc)}
                      >
                        + {loc}
                      </Badge>
                    ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Email Verification */}
          <AccordionItem value="email">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Email Verification
                {filters.contact_email_status?.length && (
                  <Badge variant="secondary" className="ml-2">Active</Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="verified-only"
                  checked={filters.contact_email_status?.includes("verified")}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setFilters({
                        ...filters,
                        contact_email_status: ["verified"],
                      });
                    } else {
                      setFilters({
                        ...filters,
                        contact_email_status: undefined,
                      });
                    }
                  }}
                />
                <Label htmlFor="verified-only" className="cursor-pointer">
                  Verified emails only
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended: Only include contacts with verified email addresses
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <Separator />

        {/* Preview Section */}
        {showPreview && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Search Preview</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePreview}
                disabled={previewMutation.isPending || activeFilterCount === 0}
              >
                {previewMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Search className="h-4 w-4 mr-1" />
                )}
                Preview Results
              </Button>
            </div>

            {previewMutation.data && (
              <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Estimated Results</span>
                  <Badge variant="default">
                    {previewMutation.data.estimated_total.toLocaleString()} contacts
                  </Badge>
                </div>
                {!previewMutation.data.filters_valid && (
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {previewMutation.data.validation_errors.join(", ")}
                    </AlertDescription>
                  </Alert>
                )}
                {previewMutation.data.warnings.length > 0 && (
                  <p className="text-xs text-amber-600">
                    {previewMutation.data.warnings.join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Search Button */}
        <Button
          className="w-full"
          size="lg"
          onClick={() => onSearch(filters, mode)}
          disabled={activeFilterCount === 0}
        >
          <Search className="h-4 w-4 mr-2" />
          Search Apollo
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}

export default AdvancedFilters;
