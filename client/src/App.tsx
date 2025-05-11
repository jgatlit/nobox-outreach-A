import * as React from "react";
import { Suspense, lazy } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import LeadManagement from "@/pages/LeadManagement";
import Campaigns from "@/pages/Campaigns";
import AdGenerator from "@/pages/AdGenerator";
import Workflows from "@/pages/Workflows";
import Integrations from "@/pages/Integrations";
import { Layout } from "@/components/Layout";

// Lazy load the lead detail page
const LeadDetail = lazy(() => import('@/pages/LeadDetail'));

function Router() {
  return (
    <Layout>
      <Suspense fallback={<div className="flex justify-center items-center h-full w-full"><div className="animate-spin h-8 w-8 border-4 border-primary-500 rounded-full border-t-transparent"></div></div>}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/leads" component={LeadManagement} />
          <Route path="/leads/:id" component={LeadDetail} />
          <Route path="/campaigns" component={Campaigns} />
          <Route path="/ad-generator" component={AdGenerator} />
          <Route path="/workflows" component={Workflows} />
          <Route path="/integrations" component={Integrations} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
