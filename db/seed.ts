import { db } from "./index";
import { 
  leads, 
  leadEnrichment, 
  workflows, 
  integrations, 
  campaigns,
  adCampaigns,
  adVariants
} from "@shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  try {
    // Check if we already have data
    const existingLeads = await db.select().from(leads).limit(1);
    if (existingLeads.length > 0) {
      console.log("Database already has data. Skipping seed.");
      return;
    }

    console.log("Seeding database...");

    // Seed workflows
    const workflowsData = [
      {
        name: "Lead Consolidation & Deduplication",
        description: "Merges leads from multiple sources, resolving duplicates.",
        n8nWorkflowId: "lead-consolidation",
        status: "active",
        lastRun: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        processedCount: 128,
        totalCount: 128,
        nextScheduledRun: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
      },
      {
        name: "Contextual Data Enrichment",
        description: "Scrapes websites and other sources to add context to leads.",
        n8nWorkflowId: "data-enrichment",
        status: "active",
        lastRun: new Date(Date.now() - 42 * 60 * 1000), // 42 minutes ago
        processedCount: 95,
        totalCount: 130,
        nextScheduledRun: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      },
      {
        name: "Email Draft Generation",
        description: "Creates personalized email drafts for each lead.",
        n8nWorkflowId: "email-generation",
        status: "in-progress",
        lastRun: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        processedCount: 58,
        totalCount: 130,
        nextScheduledRun: null,
      },
      {
        name: "Ad Campaign Generation",
        description: "Creates ad campaign variants for each segment.",
        n8nWorkflowId: "ad-generation",
        status: "queued",
        lastRun: null,
        processedCount: 0,
        totalCount: 0,
        nextScheduledRun: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      },
    ];
    
    const insertedWorkflows = await db.insert(workflows).values(workflowsData).returning();
    console.log(`Inserted ${insertedWorkflows.length} workflows`);

    // Seed integrations
    const integrationsData = [
      {
        name: "n8n Workflows",
        type: "workflow_automation",
        status: "active",
        lastChecked: new Date(),
        config: { apiUrl: "https://n8n.example.com/api/v1" }
      },
      {
        name: "Monday.com",
        type: "crm",
        status: "active",
        lastChecked: new Date(),
        config: { apiUrl: "https://api.monday.com/v2" }
      },
      {
        name: "Pipedrive",
        type: "crm",
        status: "active",
        lastChecked: new Date(),
        config: { apiUrl: "https://api.pipedrive.com/v1" }
      },
      {
        name: "Asana",
        type: "project_management",
        status: "warning",
        lastChecked: new Date(),
        config: { apiUrl: "https://app.asana.com/api/1.0" }
      },
      {
        name: "Claude API",
        type: "ai",
        status: "active",
        lastChecked: new Date(),
        config: { apiUrl: "https://api.anthropic.com/v1" }
      }
    ];
    
    const insertedIntegrations = await db.insert(integrations).values(integrationsData).returning();
    console.log(`Inserted ${insertedIntegrations.length} integrations`);

    // Seed campaigns
    const campaignsData = [
      {
        name: "Q3 Outreach - Tech Companies",
        description: "Outreach to technology companies for AI automation services",
        isActive: true,
        segmentFilters: { industry: "technology", size: "50-200" }
      },
      {
        name: "Healthcare Solutions",
        description: "Targeted campaign for healthcare organizations",
        isActive: true,
        segmentFilters: { industry: "healthcare", region: "US" }
      },
      {
        name: "Financial Services Automation",
        description: "Automation solutions for financial institutions",
        isActive: false,
        segmentFilters: { industry: "finance", minRevenue: 1000000 }
      }
    ];
    
    const insertedCampaigns = await db.insert(campaigns).values(campaignsData).returning();
    console.log(`Inserted ${insertedCampaigns.length} campaigns`);

    // Seed ad campaigns and variants
    const adCampaignsData = [
      {
        name: "Active Leads - AI Automation",
        segment: "active",
        description: "Ad campaign targeting active leads with AI automation messaging"
      },
      {
        name: "Inactive Leads - Re-engagement",
        segment: "inactive",
        description: "Campaign to re-engage inactive leads with new offerings"
      }
    ];
    
    const insertedAdCampaigns = await db.insert(adCampaigns).values(adCampaignsData).returning();
    console.log(`Inserted ${insertedAdCampaigns.length} ad campaigns`);

    // Add ad variants for each campaign
    const adVariantsData = insertedAdCampaigns.flatMap(campaign => {
      const variants = [];
      for (let i = 1; i <= 4; i++) {
        variants.push({
          adCampaignId: campaign.id,
          headline: `Transform your ${campaign.segment === 'active' ? 'workflow' : 'business'} with AI - Variant ${i}`,
          body: `Discover how nobox's AI automation can ${campaign.segment === 'active' ? 'streamline your operations' : 'revitalize your processes'} and boost productivity.`,
          midjourneyPrompt: `Futuristic AI automation interface, neon accents, B2B tech style, 16:9 ratio, ${campaign.segment === 'active' ? 'energetic' : 'calming'} colors, professional setting`
        });
      }
      return variants;
    });
    
    const insertedAdVariants = await db.insert(adVariants).values(adVariantsData).returning();
    console.log(`Inserted ${insertedAdVariants.length} ad variants`);

    // Seed leads
    const leadsData = [
      {
        firstName: "Sarah",
        lastName: "Johnson",
        email: "sarah.johnson@acmetech.com",
        company: "Acme Technologies",
        title: "CTO",
        website: "https://acmetech.com",
        linkedinUrl: "https://linkedin.com/in/sarahjohnson",
        source: "pipedrive",
        status: "active",
        lastContactDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        enrichmentStatus: "complete",
        emailStatus: "draft_generated",
      },
      {
        firstName: "Michael",
        lastName: "Chen",
        email: "mchen@quantumdigital.io",
        company: "Quantum Digital",
        title: "CEO",
        website: "https://quantumdigital.io",
        linkedinUrl: "https://linkedin.com/in/michaelchen",
        source: "linkedin",
        status: "active",
        lastContactDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
        enrichmentStatus: "in_progress",
        emailStatus: "not_started",
      },
      {
        firstName: "David",
        lastName: "Wilson",
        email: "david@nexussol.com",
        company: "Nexus Solutions",
        title: "Director of Operations",
        website: "https://nexussol.com",
        linkedinUrl: "https://linkedin.com/in/davidwilson",
        source: "instantly",
        status: "active",
        lastContactDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
        enrichmentStatus: "complete",
        emailStatus: "draft_generated",
      },
      {
        firstName: "Jessica",
        lastName: "Martinez",
        email: "jmartinez@innovatech.co",
        company: "InnovaTech",
        title: "CIO",
        website: "https://innovatech.co",
        linkedinUrl: "https://linkedin.com/in/jessicamartinez",
        source: "cyberleads",
        status: "active",
        lastContactDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 60 days ago
        enrichmentStatus: "complete",
        emailStatus: "sent",
      },
      {
        firstName: "Robert",
        lastName: "Taylor",
        email: "robert.taylor@fusionsystems.net",
        company: "Fusion Systems",
        title: "VP of Engineering",
        website: "https://fusionsystems.net",
        linkedinUrl: "https://linkedin.com/in/roberttaylor",
        source: "email",
        status: "inactive",
        lastContactDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), // 200 days ago
        enrichmentStatus: "not_started",
        emailStatus: "not_started",
      },
      {
        firstName: "Emily",
        lastName: "Wong",
        email: "emily@apexdata.ai",
        company: "Apex Data",
        title: "Head of AI",
        website: "https://apexdata.ai",
        linkedinUrl: "https://linkedin.com/in/emilywong",
        source: "linkedin",
        status: "inactive",
        lastContactDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000), // 180 days ago
        enrichmentStatus: "not_started",
        emailStatus: "not_started",
      }
    ];
    
    const insertedLeads = await db.insert(leads).values(leadsData).returning();
    console.log(`Inserted ${insertedLeads.length} leads`);

    // Add enrichment data for leads that have complete enrichment
    const leadEnrichmentData = insertedLeads
      .filter(lead => lead.enrichmentStatus === "complete")
      .map(lead => ({
        leadId: lead.id,
        companyInfo: {
          industry: lead.company === "Acme Technologies" ? "SaaS" : lead.company === "Nexus Solutions" ? "IT Services" : "AI & Data",
          employeeCount: lead.company === "Acme Technologies" ? 120 : lead.company === "Nexus Solutions" ? 45 : 80,
          founded: lead.company === "Acme Technologies" ? 2015 : lead.company === "Nexus Solutions" ? 2018 : 2020,
          location: lead.company === "Acme Technologies" ? "San Francisco, CA" : lead.company === "Nexus Solutions" ? "Austin, TX" : "Seattle, WA"
        },
        techStack: {
          frontend: lead.company === "Acme Technologies" ? ["React", "Vue"] : lead.company === "Nexus Solutions" ? ["Angular"] : ["React", "Next.js"],
          backend: lead.company === "Acme Technologies" ? ["Node.js", "Python"] : lead.company === "Nexus Solutions" ? ["Java", ".NET"] : ["Python", "Django"],
          database: lead.company === "Acme Technologies" ? ["PostgreSQL"] : lead.company === "Nexus Solutions" ? ["SQL Server"] : ["MongoDB", "Redis"],
          cloud: lead.company === "Acme Technologies" ? ["AWS"] : lead.company === "Nexus Solutions" ? ["Azure"] : ["GCP", "AWS"]
        },
        recentEvents: {
          news: lead.company === "Acme Technologies" ? ["Launched new AI-driven analytics platform", "Expanded team by 30%"] : 
                lead.company === "Nexus Solutions" ? ["Acquired smaller competitor", "Opened new office in Chicago"] : 
                ["Secured Series B funding", "Released open-source ML toolkit"],
          blogPosts: lead.company === "Acme Technologies" ? ["The Future of SaaS Analytics", "Why DevOps Matters"] : 
                    lead.company === "Nexus Solutions" ? ["Streamlining IT Operations", "Security in the Cloud Era"] : 
                    ["Building Responsible AI", "Data Privacy in 2023"]
        },
        insights: [
          lead.company === "Acme Technologies" ? "Looking to automate their CI/CD pipeline" : 
          lead.company === "Nexus Solutions" ? "Struggling with legacy system integration" : 
          "Hiring aggressively in the ML/AI space",
          lead.company === "Acme Technologies" ? "Recent customer reviews mention slow support response times" : 
          lead.company === "Nexus Solutions" ? "CEO mentioned interest in workflow automation in recent interview" : 
          "Company blog discusses challenges with data processing at scale"
        ],
        personalizationHooks: [
          lead.company === "Acme Technologies" ? "Their recent blog on DevOps aligns with our automation services" : 
          lead.company === "Nexus Solutions" ? "Their acquisition creates an opportunity for system integration" : 
          "Their open-source commitment matches our transparent approach to AI",
          lead.company === "Acme Technologies" ? "They use similar tech stack to our client Innovate Inc." : 
          lead.company === "Nexus Solutions" ? "Their challenges with legacy systems match what we solved for DataCorp" : 
          "Their funding announcement indicates budget for new AI initiatives"
        ]
      }));
    
    const insertedEnrichment = await db.insert(leadEnrichment).values(leadEnrichmentData).returning();
    console.log(`Inserted ${insertedEnrichment.length} lead enrichment records`);

    console.log("Database seeding completed successfully.");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
