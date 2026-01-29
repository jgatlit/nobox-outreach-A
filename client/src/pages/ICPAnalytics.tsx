import * as React from "react";
import { useState } from "react";
import {
  BarChart3,
  Users,
  Target,
  Brain,
  TrendingUp,
  DollarSign,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Zap,
  Mail,
  Calendar,
  PieChart,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { useToast } from "@/hooks/use-toast";
import {
  useICPDistribution,
  useArchetypePerformance,
  useStrategyPerformance,
  useCostTrends,
  useDashboardSummary,
  useCampaignByICP,
  type ICPDistributionItem,
  type ArchetypePerformanceItem,
  type StrategyPerformanceItem,
} from "@/lib/apolloApi";

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number;
  iconColor?: string;
}

function StatCard({ title, value, subtitle, icon: Icon, trend, iconColor = "text-primary-500" }: StatCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-primary-500/10 ${iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-3">
            {trend >= 0 ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-sm ${trend >= 0 ? "text-green-500" : "text-red-500"}`}>
              {Math.abs(trend)}%
            </span>
            <span className="text-xs text-muted-foreground">vs last period</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// ICP DISTRIBUTION CHART
// =============================================================================

interface ICPDistributionChartProps {
  data: ICPDistributionItem[];
}

function ICPDistributionChart({ data }: ICPDistributionChartProps) {
  const maxLeads = Math.max(...data.map((d) => d.total_leads), 1);

  return (
    <div className="space-y-4">
      {data.map((item) => {
        const widthPercent = (item.total_leads / maxLeads) * 100;
        return (
          <div key={item.icp_key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="font-medium text-sm">{item.preset_name}</p>
                <p className="text-xs text-muted-foreground">{item.archetype}</p>
              </div>
              <div className="text-right">
                <p className="font-medium text-sm">{item.total_leads.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{item.response_rate}% response</p>
              </div>
            </div>
            <div className="relative h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="absolute h-full bg-primary-500 rounded-full transition-all duration-500"
                style={{ width: `${widthPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// STRATEGY PERFORMANCE TABLE
// =============================================================================

interface StrategyTableProps {
  strategies: StrategyPerformanceItem[];
}

function StrategyTable({ strategies }: StrategyTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Strategy</TableHead>
          <TableHead className="text-right">Messages</TableHead>
          <TableHead className="text-right">Replies</TableHead>
          <TableHead className="text-right">Reply Rate</TableHead>
          <TableHead className="text-right">Effectiveness</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {strategies.map((strategy) => (
          <TableRow key={strategy.strategy_id}>
            <TableCell>
              <div>
                <p className="font-medium">{strategy.strategy_name}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {strategy.core_mechanism}
                </p>
              </div>
            </TableCell>
            <TableCell className="text-right">{strategy.messages_sent.toLocaleString()}</TableCell>
            <TableCell className="text-right">{strategy.replies_received.toLocaleString()}</TableCell>
            <TableCell className="text-right">
              <Badge variant={strategy.reply_rate >= 10 ? "default" : strategy.reply_rate >= 5 ? "secondary" : "outline"}>
                {strategy.reply_rate}%
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                <Progress value={strategy.calculated_effectiveness * 50} className="w-16 h-2" />
                <span className="text-sm font-medium w-8">
                  {(strategy.calculated_effectiveness * 100).toFixed(0)}
                </span>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// =============================================================================
// ARCHETYPE PERFORMANCE GRID
// =============================================================================

interface ArchetypeGridProps {
  archetypes: ArchetypePerformanceItem[];
}

function ArchetypeGrid({ archetypes }: ArchetypeGridProps) {
  const getEffectivenessColor = (score: number) => {
    if (score >= 20) return "text-green-500 bg-green-500/10";
    if (score >= 10) return "text-yellow-500 bg-yellow-500/10";
    return "text-gray-500 bg-gray-500/10";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {archetypes.map((archetype) => (
        <Card key={archetype.archetype_id} className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-sm">{archetype.archetype}</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {archetype.total_leads.toLocaleString()} leads
              </p>
            </div>
            <Badge className={getEffectivenessColor(archetype.effectiveness_score)}>
              {archetype.effectiveness_score}% effective
            </Badge>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold">{archetype.contacted}</p>
              <p className="text-xs text-muted-foreground">Contacted</p>
            </div>
            <div>
              <p className="text-lg font-bold">{archetype.responded}</p>
              <p className="text-xs text-muted-foreground">Responded</p>
            </div>
            <div>
              <p className="text-lg font-bold">{archetype.qualified}</p>
              <p className="text-xs text-muted-foreground">Qualified</p>
            </div>
          </div>
          {archetype.communication_preferences && (
            <div className="mt-3 flex flex-wrap gap-1">
              <Badge variant="outline" className="text-xs">
                {archetype.communication_preferences.tone}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {archetype.communication_preferences.length}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {archetype.communication_preferences.formality}
              </Badge>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// =============================================================================
// COST TREND CHART (Simple Bar Visualization)
// =============================================================================

interface CostTrendChartProps {
  trends: Array<{ date: string; total_cost_usd: number }>;
}

function CostTrendChart({ trends }: CostTrendChartProps) {
  const maxCost = Math.max(...trends.map((t) => t.total_cost_usd), 0.01);
  const last7Days = trends.slice(-7);

  return (
    <div className="flex items-end justify-between gap-2 h-32">
      {last7Days.map((day, index) => {
        const heightPercent = (day.total_cost_usd / maxCost) * 100;
        return (
          <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex-1 flex items-end">
              <div
                className="w-full bg-primary-500 rounded-t transition-all duration-500"
                style={{ height: `${Math.max(heightPercent, 5)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// MAIN ANALYTICS DASHBOARD
// =============================================================================

export default function ICPAnalytics() {
  const [timeRange, setTimeRange] = useState<"7" | "14" | "30">("30");

  const { toast } = useToast();

  // Fetch all analytics data
  const { data: summaryData, isLoading: summaryLoading, refetch: refetchSummary } = useDashboardSummary();
  const { data: icpData, isLoading: icpLoading, refetch: refetchICP } = useICPDistribution();
  const { data: archetypeData, isLoading: archetypeLoading, refetch: refetchArchetype } = useArchetypePerformance();
  const { data: strategyData, isLoading: strategyLoading, refetch: refetchStrategy } = useStrategyPerformance();
  const { data: costData, isLoading: costLoading, refetch: refetchCost } = useCostTrends(parseInt(timeRange));
  const { data: campaignData, isLoading: campaignLoading } = useCampaignByICP();

  const isLoading = summaryLoading || icpLoading || archetypeLoading || strategyLoading || costLoading;

  const handleRefresh = () => {
    refetchSummary();
    refetchICP();
    refetchArchetype();
    refetchStrategy();
    refetchCost();
    toast({
      title: "Refreshing Analytics",
      description: "Loading latest data...",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary-500 mx-auto" />
          <p className="text-muted-foreground">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <BarChart3 className="h-8 w-8 text-primary-500" />
              ICP Performance Analytics
            </h1>
            <p className="text-muted-foreground">
              Track performance across ICP presets and psychological strategies
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as "7" | "14" | "30")}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Leads"
            value={summaryData?.leads.total.toLocaleString() || "0"}
            subtitle={`${summaryData?.leads.from_apollo || 0} from Apollo`}
            icon={Users}
            iconColor="text-blue-500"
          />
          <StatCard
            title="Messages Sent"
            value={summaryData?.outreach.total_messages.toLocaleString() || "0"}
            subtitle={`${summaryData?.outreach.reply_rate || 0}% reply rate`}
            icon={Mail}
            iconColor="text-green-500"
          />
          <StatCard
            title="Meetings Booked"
            value={summaryData?.outreach.total_meetings.toLocaleString() || "0"}
            subtitle={`From ${summaryData?.outreach.total_replies || 0} replies`}
            icon={Calendar}
            iconColor="text-purple-500"
          />
          <StatCard
            title="Monthly Cost"
            value={`$${(summaryData?.cost.monthly_spend_usd || 0).toFixed(2)}`}
            subtitle={`of $${summaryData?.cost.monthly_budget_usd || 500} budget`}
            icon={DollarSign}
            iconColor="text-yellow-500"
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ICP Distribution */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                ICP Distribution
              </CardTitle>
              <CardDescription>
                Lead breakdown by Ideal Customer Profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              {icpData?.distribution && icpData.distribution.length > 0 ? (
                <>
                  <ICPDistributionChart data={icpData.distribution} />
                  <Separator className="my-4" />
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{icpData.icp_count}</p>
                      <p className="text-xs text-muted-foreground">Active ICPs</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{icpData.totals.overall_response_rate}%</p>
                      <p className="text-xs text-muted-foreground">Avg Response Rate</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <PieChart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No ICP data yet</p>
                  <p className="text-xs">Import leads from Apollo to see distribution</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Strategy Performance */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Strategy Performance
              </CardTitle>
              <CardDescription>
                Effectiveness metrics for psychological strategies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {strategyData?.strategies && strategyData.strategies.length > 0 ? (
                <>
                  <StrategyTable strategies={strategyData.strategies} />
                  <Separator className="my-4" />
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xl font-bold">
                        {strategyData.summary.total_messages.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Messages</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">
                        {strategyData.summary.total_replies.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Replies</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">
                        {strategyData.summary.total_meetings.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">Meetings Booked</p>
                    </div>
                  </div>
                  {strategyData.best_performing && (
                    <Alert className="mt-4 border-green-500">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <AlertTitle>Top Performer</AlertTitle>
                      <AlertDescription>
                        <strong>{strategyData.best_performing.strategy_name}</strong> is your best
                        performing strategy with a {strategyData.best_performing.reply_rate}%
                        reply rate.
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No strategy performance data</p>
                  <p className="text-xs">Run campaigns to see strategy effectiveness</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Archetype Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Archetype Performance
            </CardTitle>
            <CardDescription>
              Performance breakdown by buyer archetype
            </CardDescription>
          </CardHeader>
          <CardContent>
            {archetypeData?.archetypes && archetypeData.archetypes.length > 0 ? (
              <>
                <ArchetypeGrid archetypes={archetypeData.archetypes} />
                {archetypeData.best_performing && (
                  <Alert className="mt-4 border-primary-500">
                    <TrendingUp className="h-4 w-4 text-primary-500" />
                    <AlertTitle>Best Performing Archetype</AlertTitle>
                    <AlertDescription>
                      <strong>{archetypeData.best_performing.archetype}</strong> shows the highest
                      effectiveness score of {archetypeData.best_performing.effectiveness_score}%
                      with {archetypeData.best_performing.total_leads} total leads.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No archetype data available</p>
                <p className="text-xs">Assign archetypes to leads to see performance</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cost Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Cost Trends
            </CardTitle>
            <CardDescription>
              API usage costs over the selected period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {costData?.trends && costData.trends.length > 0 ? (
              <>
                <CostTrendChart trends={costData.trends} />
                <Separator className="my-4" />
                <div className="grid grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-xl font-bold">${costData.summary.total_cost_usd.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Total Cost</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{costData.summary.total_credits.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Credits Used</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">${costData.summary.avg_daily_cost_usd.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Avg Daily Cost</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{costData.summary.data_points}</p>
                    <p className="text-xs text-muted-foreground">Days Tracked</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No cost data available</p>
                <p className="text-xs">API usage will appear here when recorded</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Reference */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Available ICP Presets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summaryData?.icp_presets.presets.slice(0, 5).map((preset) => (
                  <div key={preset.key} className="flex items-center justify-between text-sm">
                    <span className="truncate">{preset.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {preset.archetype.split(" ")[0]}
                    </Badge>
                  </div>
                ))}
                {(summaryData?.icp_presets.total || 0) > 5 && (
                  <p className="text-xs text-muted-foreground">
                    +{(summaryData?.icp_presets.total || 0) - 5} more presets
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Psychological Strategies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summaryData?.strategies.names.map((strategy) => (
                  <div key={strategy.id} className="flex items-center gap-2 text-sm">
                    <Brain className="h-3 w-3 text-muted-foreground" />
                    <span>{strategy.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Buyer Archetypes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {summaryData?.archetypes.names.slice(0, 6).map((name) => (
                  <div key={name} className="flex items-center gap-2 text-sm">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
