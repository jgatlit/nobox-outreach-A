/**
 * This file contains the context information about nobox creatives,
 * its service offerings, differentiators, and customer value proposition.
 * This information will be used by AI when generating emails and campaign suggestions.
 */

export const companyContext = {
  name: "nobox creatives",
  description: "An AI-forward consultancy specializing in automated lead generation pipelines, web design, digital marketing, and AI agent frameworks tailored for SMB B2B sales cycles. Their services focus on replacing manual processes with intelligent systems that prioritize hyper-relevance and pipeline velocity.",
  
  coreServiceOfferings: {
    aiPoweredLeadGeneration: {
      title: "AI-Powered Lead Generation Systems",
      services: [
        {
          name: "Prospect List Optimization",
          description: "Uses tools like Semrush Ads + AI to identify high-intent accounts and decision-makers, filtering out low-quality leads through predictive scoring algorithms."
        },
        {
          name: "Website Design",
          description: "Delivers custom, conversion-focused websites that serve as the foundation of digital lead generation. nobox websites are designed to build trust, optimize user experience, and drive pipeline growth. Services include discovery and strategy, UX/UI design, responsive development, content creation, and seamless integration with CRM and marketing automation tools. Each site is tailored to the client's brand and business objectives, ensuring a high-performing digital presence that attracts, engages, and converts B2B buyers."
        },
        {
          name: "Digital Marketing & SEO",
          description: "Provides comprehensive digital marketing strategies that encompass SEO, PPC, email marketing, and content production to maximize online visibility and attract qualified leads. SEO services focus on technical optimization, content strategy, and authority building to drive sustainable organic growth and trust among B2B buyers. Digital marketing campaigns are data-driven, leveraging analytics to refine targeting, messaging, and ROI, ensuring that SMBs capture and nurture leads at every stage of the buyer journey."
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
          name: "Workflow Automation",
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
        "Expertise across multiple LLM technologies: for dynamic deep research analysis and agentic operations",
        "Unified digital and AI approach: Integrates web design, digital marketing, and AI-driven automation for a seamless, high-impact sales pipeline."
      ]
    },
    performanceMetrics: {
      title: "Performance Metrics",
      points: [
        "67% Faster Lead-to-Meeting Conversion through AI-qualified outreach",
        "42% Reduction in CAC via automated list hygiene and predictive scoring",
        "Websites and SEO campaigns routinely drive measurable increases in qualified inbound leads and pipeline velocity."
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
      },
      {
        name: "Unified Digital Presence",
        description: "Custom web design and integrated SEO ensure your brand stands out and is easily found by decision-makers at every stage of the B2B buying journey."
      },
      {
        name: "Sustainable Pipeline Growth",
        description: "Digital marketing and SEO strategies drive ongoing traffic and nurture leads, compounding returns and building long-term trust and authority."
      }
    ],
    impact: "This operational model allows SMBs to compete with enterprise-grade sales systems while maintaining lean teams. By combining no-code automation, behavioral AI, high-conversion web design, and digital marketing, nobox enables clients to systematically convert more leads into closed-won deals and accelerate revenue growth compared to traditional approaches."
  }
};

// Key Strategic Emphases:
// - nobox creatives is not only an automation and AI consultancy but a full-spectrum digital partner, delivering web design and digital marketing as foundational elements of the modern B2B sales pipeline.
// - Their approach ensures that every client's online presence is optimized for both discoverability and conversion, tightly integrating AI-driven automation with high-impact digital marketing and web experiences.
// - This unified strategy empowers SMBs to achieve faster, higher-quality lead generation and pipeline advancement, with measurable ROI and sustainable competitive advantage.