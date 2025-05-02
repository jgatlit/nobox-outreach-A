import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, BarChart3, CheckCircle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  iconColor: string;
  changeValue?: number | string;
  changeLabel?: string;
  isLoading?: boolean;
  isPositiveChange?: boolean;
}

function StatsCard({
  title,
  value,
  icon,
  iconColor,
  changeValue,
  changeLabel,
  isLoading = false,
  isPositiveChange = true,
}: StatsCardProps) {
  return (
    <Card className="stats-card">
      <CardContent className="p-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">{title}</p>
            {isLoading ? (
              <div className="h-8 w-24 bg-neutral-200 animate-pulse rounded mt-1"></div>
            ) : (
              <p className="text-2xl font-semibold mt-1">{value}</p>
            )}
          </div>
          <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", iconColor)}>
            {icon}
          </div>
        </div>
        {(changeValue || changeLabel) && (
          <div className="mt-4 flex items-center">
            {changeValue && (
              <span className={cn("flex items-center text-sm font-medium", 
                isPositiveChange ? "text-green-500" : "text-amber-500"
              )}>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isPositiveChange 
                    ? "M5 10l7-7m0 0l7 7m-7-7v18" 
                    : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                  }></path>
                </svg>
                {changeValue}
              </span>
            )}
            {changeLabel && (
              <span className="text-neutral-500 text-sm ml-2">{changeLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface StatsCardsProps {
  totalLeads: number;
  activeCampaigns: number;
  responseRate: number;
  opportunities: number;
  isLoading?: boolean;
}

export function StatsCards({
  totalLeads,
  activeCampaigns,
  responseRate,
  opportunities,
  isLoading = false,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatsCard
        title="Total Leads"
        value={formatNumber(totalLeads)}
        icon={<Users className="w-6 h-6" />}
        iconColor="bg-primary-100 text-primary-600"
        changeValue="8.2%"
        changeLabel="vs last month"
        isLoading={isLoading}
      />
      <StatsCard
        title="Active Campaigns"
        value={formatNumber(activeCampaigns)}
        icon={<BarChart3 className="w-6 h-6" />}
        iconColor="bg-secondary-100 text-secondary-600"
        changeValue="3"
        changeLabel="new this week"
        isLoading={isLoading}
      />
      <StatsCard
        title="Response Rate"
        value={formatPercent(responseRate)}
        icon={<CheckCircle className="w-6 h-6" />}
        iconColor="bg-green-100 text-green-600"
        changeValue="2.1%"
        changeLabel="vs last month"
        isLoading={isLoading}
      />
      <StatsCard
        title="Opportunities"
        value={formatNumber(opportunities)}
        icon={<DollarSign className="w-6 h-6" />}
        iconColor="bg-amber-100 text-amber-600"
        changeValue="$145,200"
        changeLabel="potential value"
        isPositiveChange={false}
        isLoading={isLoading}
      />
    </div>
  );
}
