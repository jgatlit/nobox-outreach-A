import * as React from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Users, 
  BarChart3, 
  Image, 
  Zap, 
  Puzzle, 
  ChevronLeft,
  ChevronRight 
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = React.useState(false);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  const navItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: Home,
    },
    {
      name: "Leads",
      href: "/leads",
      icon: Users,
    },
    {
      name: "Campaigns",
      href: "/campaigns",
      icon: BarChart3,
    },
    {
      name: "Ad Generator",
      href: "/ad-generator",
      icon: Image,
    },
    {
      name: "Workflows",
      href: "/workflows",
      icon: Zap,
    },
    {
      name: "Integrations",
      href: "/integrations",
      icon: Puzzle,
    },
  ];

  return (
    <div
      className={cn(
        "bg-sidebar flex flex-col transition-all duration-300",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Logo and brand */}
      <div 
        className={cn(
          "p-4 flex items-center border-b border-sidebar-border",
          collapsed ? "justify-center" : ""
        )}
      >
        <svg className="w-8 h-8 text-primary-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"></path>
        </svg>
        {!collapsed && <span className="ml-2 font-bold text-lg text-white">nobox Outreach</span>}
      </div>
      
      {/* Navigation items */}
      <nav className="flex-1 py-4">
        <ul>
          {navItems.map((item) => {
            const isActive = location === item.href;
            
            return (
              <li key={item.href} className="mb-1">
                <Link 
                  href={item.href}
                  className={cn(
                    "sidebar-item", 
                    isActive 
                      ? "sidebar-item-active" 
                      : "sidebar-item-inactive",
                    collapsed ? "justify-center" : ""
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {!collapsed && <span className="ml-3">{item.name}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      {/* User profile and toggle */}
      <div 
        className={cn(
          "p-4 border-t border-sidebar-border flex items-center", 
          collapsed ? "justify-center" : ""
        )}
      >
        <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold">
          J
        </div>
        {!collapsed && (
          <div className="ml-3">
            <p className="text-sm font-medium text-white">Jonathan</p>
            <p className="text-xs text-neutral-400">Admin</p>
          </div>
        )}
        <button 
          className={cn(
            "text-neutral-400 hover:text-white",
            collapsed ? "ml-0 mt-4" : "ml-auto"
          )}
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <ChevronLeft className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
