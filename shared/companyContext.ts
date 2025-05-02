/**
 * This file contains the context information about nobox creatives,
 * its service offerings, differentiators, and customer value proposition.
 * This information will be used by AI when generating emails and campaign suggestions.
 */

export const companyContext = {
  name: "nobox creatives",
  description: "An AI-forward consultancy specializing in automated lead generation pipelines and AI agent frameworks tailored for SMB B2B sales cycles. Their services focus on replacing manual processes with intelligent systems that prioritize hyper-relevance and pipeline velocity.",
  
  coreServiceOfferings: {
    aiPoweredLeadGeneration: {
      title: "AI-Powered Lead Generation Systems",
      services: [
        {
          name: "Prospect List Optimization",
          description: "Uses tools like Semrush Ads + AI to identify high-intent accounts and decision-makers, filtering out low-quality leads through predictive scoring algorithms."
        },
        {
          name: "Automated Lead Enrichment",
          description: "Integrates Supabase databases with AI agents to append firmographic/technographic data to raw leads, ensuring sales teams target accounts with highest conversion potential."
        }
      ]
    },
    agenticSalesFrameworks: {
      title: "Agentic Sales Frameworks",
      services: [
        {
          name: "AI Email Agents",
          description: "Implements Reply.io's AI Sales Email Assistant for automated drip campaigns with 1:1 personalized sequences triggered by lead behavior (e.g., website visits, content downloads) and context-aware replies using NLP models to analyze incoming emails and maintain conversational continuity while pushing leads toward meetings."
        },
        {
          name: "n8n Workflow Automation",
          description: "Builds custom automations for lead routing (automatic assignment to reps based on territory/vertical) and CRM sync (real-time updates between outreach tools and Supabase-powered CRMs)."
        }
      ]
    },
    pipelineNurturingSystems: {
      title: "Pipeline Nurturing Systems",
      services: [
        {
          name: "Behavioral Trigger Library",
          description: "Pre-built n8n workflows activate touchpoints when leads view pricing pages (AI agent sends ROI calculators) or abandon carts (automated video follow-ups)."
        },
        {
          name: "Sandler Sales Methodology Integration",
          description: "AI agents use SPICED framework (Situation-Pain-Impact-Critical Event-Decision) to guide prospects through funnel stages."
        }
      ]
    }
  },
  
  strategicDifferentiators: {
    technicalStackAdvantage: {
      title: "Technical Stack Advantage",
      points: [
        "Nimble scalable cutting-edge architecture: Enables rapid deployment of scalable automation infrastructure without coding",
        "Expertise across multiple LLM technologies: for dynamic deep research analysis and agentic operations"
      ]
    },
    performanceMetrics: {
      title: "Performance Metrics",
      points: [
        "67% Faster Lead-to-Meeting Conversion through AI-qualified outreach",
        "42% Reduction in CAC via automated list hygiene and predictive scoring"
      ]
    }
  },
  
  customerValueProposition: {
    title: "Customer Value Proposition",
    forSMBs: "For SMBs transitioning from manual outbound, nobox delivers:",
    points: [
      {
        name: "Frictionless Onboarding",
        description: "Pre-built n8n templates for common B2B use cases (event follow-ups, trial conversions)"
      },
      {
        name: "Continuous Optimization",
        description: "AI agents analyze campaign performance to automatically A/B test subject lines, send times, and CTAs"
      },
      {
        name: "Sales/Marketing Alignment",
        description: "Shared Supabase dashboards show real-time pipeline impact of automated touchpoints"
      }
    ],
    impact: "This operational model allows SMBs to compete with enterprise-grade sales systems while maintaining lean teams. By combining no-code automation with behavioral AI, nobox enables clients to systematically convert 23% more leads into closed-won deals compared to traditional CRMs."
  }
};
