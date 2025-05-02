import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj instanceof Date && !isNaN(dateObj.getTime())
      ? new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(dateObj)
      : '';
  } catch {
    return '';
  }
}

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0';
  
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatPercent(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0%';
  
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(num / 100);
}

export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  
  return text.slice(0, maxLength) + '...';
}

export function capitalizeFirstLetter(text: string): string {
  if (!text) return '';
  
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatRelativeTime(date: Date | string | undefined | null): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    }
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) {
      return 'yesterday';
    }
    
    if (diffInDays < 30) {
      return `${diffInDays} days ago`;
    }
    
    return formatDate(dateObj);
  } catch {
    return '';
  }
}

export function getSourceBadgeColor(source: string | undefined): {
  bg: string;
  text: string;
} {
  if (!source) return { bg: 'bg-neutral-100', text: 'text-neutral-800' };
  
  switch (source.toLowerCase()) {
    case 'pipedrive':
      return { bg: 'bg-primary-100', text: 'text-primary-800' };
    case 'asana':
      return { bg: 'bg-orange-100', text: 'text-orange-800' };
    case 'email':
      return { bg: 'bg-blue-100', text: 'text-blue-800' };
    case 'instantly':
      return { bg: 'bg-purple-100', text: 'text-purple-800' };
    case 'cyberleads':
      return { bg: 'bg-green-100', text: 'text-green-800' };
    case 'linkedin':
      return { bg: 'bg-blue-100', text: 'text-blue-800' };
    case 'manual':
      return { bg: 'bg-amber-100', text: 'text-amber-800' };
    default:
      return { bg: 'bg-neutral-100', text: 'text-neutral-800' };
  }
}

export function getStatusColor(status: string | undefined): {
  bg: string;
  text: string;
  icon: string;
} {
  if (!status) return { bg: 'bg-neutral-100', text: 'text-neutral-800', icon: 'text-neutral-500' };
  
  switch (status.toLowerCase()) {
    case 'active':
      return { bg: 'bg-green-100', text: 'text-green-800', icon: 'text-green-500' };
    case 'complete':
      return { bg: 'bg-green-100', text: 'text-green-800', icon: 'text-green-500' };
    case 'in_progress':
    case 'in-progress':
      return { bg: 'bg-amber-100', text: 'text-amber-800', icon: 'text-amber-500' };
    case 'not_started':
    case 'queued':
      return { bg: 'bg-neutral-100', text: 'text-neutral-800', icon: 'text-neutral-500' };
    case 'failed':
      return { bg: 'bg-red-100', text: 'text-red-800', icon: 'text-red-500' };
    case 'warning':
      return { bg: 'bg-amber-100', text: 'text-amber-800', icon: 'text-amber-500' };
    default:
      return { bg: 'bg-neutral-100', text: 'text-neutral-800', icon: 'text-neutral-500' };
  }
}
