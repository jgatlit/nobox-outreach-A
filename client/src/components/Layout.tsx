import * as React from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { useLocation } from "wouter";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  
  // Get page title based on current route
  const getPageTitle = () => {
    switch (location) {
      case "/":
        return "Lead Generation Dashboard";
      case "/leads":
        return "Lead Management";
      case "/campaigns":
        return "Campaign Management";
      case "/ad-generator":
        return "Ad Generator";
      case "/workflows":
        return "n8n Workflows";
      case "/integrations":
        return "System Integrations";
      default:
        return "nobox";
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar className="hidden md:flex" />
      
      <div className="flex-1 overflow-hidden">
        <Header title={getPageTitle()} />
        {children}
      </div>
    </div>
  );
}
