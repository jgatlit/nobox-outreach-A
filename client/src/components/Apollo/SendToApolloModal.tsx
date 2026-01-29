import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  useApolloLists,
  useCreateList,
  useAddToList,
  useICPPresets,
  ApolloList,
} from "@/lib/apolloApi";
import {
  Loader2,
  Plus,
  Send,
  List,
  Users,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SendToApolloModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLeadIds: number[];
  onSuccess?: () => void;
}

export function SendToApolloModal({
  isOpen,
  onClose,
  selectedLeadIds,
  onSuccess,
}: SendToApolloModalProps) {
  const [selectedListId, setSelectedListId] = React.useState<string>("");
  const [newListName, setNewListName] = React.useState("");
  const [isCreatingList, setIsCreatingList] = React.useState(false);
  const [selectedIcpKey, setSelectedIcpKey] = React.useState<string>("");

  const { toast } = useToast();

  // Queries
  const {
    data: listsData,
    isLoading: isLoadingLists,
    refetch: refetchLists,
  } = useApolloLists();

  const { data: presetsData, isLoading: isLoadingPresets } = useICPPresets();

  // Mutations
  const createListMutation = useCreateList();
  const addToListMutation = useAddToList();

  const lists = listsData?.lists || [];
  const presets = presetsData?.presets || {};

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a list name",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await createListMutation.mutateAsync({
        name: newListName.trim(),
      });

      toast({
        title: "List Created",
        description: `Created list "${result.list.display_name}"`,
      });

      setSelectedListId(result.list.id);
      setNewListName("");
      setIsCreatingList(false);
      refetchLists();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create list",
        variant: "destructive",
      });
    }
  };

  const handleSendToApollo = async () => {
    if (!selectedListId) {
      toast({
        title: "Error",
        description: "Please select or create a list",
        variant: "destructive",
      });
      return;
    }

    if (selectedLeadIds.length === 0) {
      toast({
        title: "Error",
        description: "No leads selected",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await addToListMutation.mutateAsync({
        listId: selectedListId,
        lead_ids: selectedLeadIds,
      });

      toast({
        title: "Success",
        description: `Added ${result.added_count} leads to Apollo list`,
      });

      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add leads to Apollo",
        variant: "destructive",
      });
    }
  };

  const selectedList = lists.find((l) => l.id === selectedListId);
  const isLoading =
    createListMutation.isPending || addToListMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send to Apollo
          </DialogTitle>
          <DialogDescription>
            Add {selectedLeadIds.length} selected lead
            {selectedLeadIds.length !== 1 ? "s" : ""} to an Apollo list
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected Leads Summary */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {selectedLeadIds.length} Lead
                  {selectedLeadIds.length !== 1 ? "s" : ""} Selected
                </span>
              </div>
              <Badge variant="secondary">{selectedLeadIds.length}</Badge>
            </div>
          </div>

          <Separator />

          {/* List Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Apollo List</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchLists()}
                disabled={isLoadingLists}
              >
                <RefreshCw
                  className={`h-3 w-3 mr-1 ${isLoadingLists ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>

            {isCreatingList ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter new list name..."
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateList();
                      if (e.key === "Escape") setIsCreatingList(false);
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateList}
                    disabled={createListMutation.isPending || !newListName.trim()}
                  >
                    {createListMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCreatingList(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Select
                  value={selectedListId}
                  onValueChange={setSelectedListId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a list..." />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingLists ? (
                      <div className="flex items-center justify-center p-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : lists.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No lists found. Create one below.
                      </div>
                    ) : (
                      lists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>
                          <div className="flex items-center gap-2">
                            <List className="h-4 w-4" />
                            <span>{list.display_name}</span>
                            <Badge variant="outline" className="ml-auto">
                              {list.cached_count}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreatingList(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Create New List
                </Button>
              </div>
            )}

            {selectedList && (
              <div className="rounded-lg border p-3 bg-muted/30">
                <div className="text-sm">
                  <span className="font-medium">{selectedList.display_name}</span>
                  <span className="text-muted-foreground ml-2">
                    ({selectedList.cached_count} contacts)
                  </span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Optional ICP Tagging */}
          <div className="space-y-2">
            <Label className="text-sm">
              Tag with ICP (Optional)
            </Label>
            <Select
              value={selectedIcpKey}
              onValueChange={setSelectedIcpKey}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select ICP preset..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No ICP tagging</SelectItem>
                {Object.entries(presets).map(([key, preset]: [string, any]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <span>{preset.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {preset.archetype}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Optionally tag leads with an ICP for targeted outreach
            </p>
          </div>

          {/* Status Messages */}
          {addToListMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {(addToListMutation.error as Error)?.message ||
                  "Failed to add leads to Apollo"}
              </AlertDescription>
            </Alert>
          )}

          {addToListMutation.isSuccess && (
            <Alert className="border-green-500">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription>
                Leads successfully added to Apollo list
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSendToApollo}
            disabled={isLoading || !selectedListId || selectedLeadIds.length === 0}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to Apollo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SendToApolloModal;
