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

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/leads" component={LeadManagement} />
        <Route path="/campaigns" component={Campaigns} />
        <Route path="/ad-generator" component={AdGenerator} />
        <Route path="/workflows" component={Workflows} />
        <Route path="/integrations" component={Integrations} />
        <Route component={NotFound} />
      </Switch>
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
