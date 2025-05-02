import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "your-api-key" });

import { WebsiteScrapingResult } from './apify';
import { companyContext } from '../shared/companyContext';

export interface CompanyContext {
  name: string;
  industry?: string;
  website?: string;
  recentEvents?: string[];
  techStack?: string[];
  employeeCount?: number;
  location?: string;
  campaignPurpose?: string;
  serviceOffering?: string;
  additionalContext?: string[];
}

export interface LeadContext {
  firstName: string;
  lastName: string;
  title?: string;
  email: string;
}

interface StyleOptions {
  tone?: 'professional' | 'conversational' | 'friendly' | 'authoritative' | 'empathetic';
  formality?: number; // 1-5 scale
  subjectLineStyle?: 'direct' | 'question' | 'benefit' | 'curiosity';
  emailLength?: 'short' | 'medium' | 'long';
  attentionHookStyle?: 'curiosity' | 'ego-trigger' | 'open-loop' | 'hyper-relevance' | 'pattern-break';
}

interface HistoricalContext {
  projectHistory?: {
    pastProjects?: Array<{
      name: string;
      description?: string;
      status: string;
      completionDate?: string;
      keyOutcomes?: string[];
    }>;
    currentProjects?: Array<{
      name: string;
      description?: string;
      status: string;
      milestones?: string[];
    }>;
  };
  emailHistory?: {
    recentThreads?: Array<{
      topic: string;
      summary: string;
      sentiment?: string;
      date: string;
    }>;
    keyContacts?: string[];
  };
  previousProposals?: Array<{
    title: string;
    date: string;
    value?: string;
    status: string;
    services: string[];
  }>;
  relationshipContext?: string[];
}

interface EmailGenerationParams {
  lead: LeadContext;
  company: CompanyContext;
  personalizationHooks?: string[];
  campaignPurpose: string;
  serviceOffering: string;
  callToAction?: string;
  previousEmails?: string[];
  styleOptions?: StyleOptions;
  // New field for historical context
  historicalContext?: HistoricalContext;
  useHistoricalContext?: boolean;
}

interface MidjourneyPromptParams {
  industry: string;
  campaignPurpose: string;
  targetAudience: string;
  style?: string;
  mood?: string;
}

// Generate personalized email content
export async function generatePersonalizedEmail(params: EmailGenerationParams): Promise<{
  subject: string;
  body: string;
}> {
  const { 
    lead, 
    company, 
    personalizationHooks, 
    campaignPurpose, 
    serviceOffering, 
    previousEmails,
    callToAction,
    styleOptions = {},
    historicalContext,
    useHistoricalContext = false
  } = params;
  
  const { 
    tone = 'professional', 
    formality = 3, 
    subjectLineStyle = 'direct',
    emailLength = 'medium',
    attentionHookStyle = 'curiosity'
  } = styleOptions;
  
  // Map email length to word count
  const wordCountMap = {
    short: '100-150',
    medium: '150-200',
    long: '200-250'
  };
  
  const wordCount = wordCountMap[emailLength];
  
  // Define formality level description
  const formalityDescriptions = [
    'very casual and conversational',
    'casual but professional',
    'balanced and neutral',
    'formal and professional',
    'very formal and corporate'
  ];
  
  const formalityDescription = formalityDescriptions[formality - 1];
  
  const previousEmailsContext = previousEmails && previousEmails.length > 0 
    ? `Previous email exchanges: ${previousEmails.join("\n\n")}` 
    : "";
  
  const hooksContext = personalizationHooks && personalizationHooks.length > 0
    ? `Personalization hooks: ${personalizationHooks.join(", ")}`
    : "";
  
  const callToActionText = callToAction 
    ? `Use this specific call-to-action: ${callToAction}`
    : "Include a clear and compelling call-to-action";
    
  // Process historical context if available and enabled
  let historicalContextSection = "";
  if (useHistoricalContext && historicalContext) {
    let contextParts = [];
    
    // Add project history context
    if (historicalContext.projectHistory) {
      const { pastProjects, currentProjects } = historicalContext.projectHistory;
      
      if (pastProjects && pastProjects.length > 0) {
        const pastProjectsText = pastProjects.map(project => {
          return `${project.name} (${project.status}): ${project.description || ""}${project.keyOutcomes ? ` - Outcomes: ${project.keyOutcomes.join(", ")}` : ""}`;
        }).join("\n");
        contextParts.push(`Past projects:\n${pastProjectsText}`);
      }
      
      if (currentProjects && currentProjects.length > 0) {
        const currentProjectsText = currentProjects.map(project => {
          return `${project.name} (${project.status}): ${project.description || ""}${project.milestones ? ` - Milestones: ${project.milestones.join(", ")}` : ""}`;
        }).join("\n");
        contextParts.push(`Current projects:\n${currentProjectsText}`);
      }
    }
    
    // Add email history context
    if (historicalContext.emailHistory && historicalContext.emailHistory.recentThreads) {
      const emailThreads = historicalContext.emailHistory.recentThreads.map(thread => {
        return `${thread.date} - ${thread.topic}: ${thread.summary}${thread.sentiment ? ` (${thread.sentiment})` : ""}`;
      }).join("\n");
      contextParts.push(`Recent email conversations:\n${emailThreads}`);
    }
    
    // Add previous proposals context
    if (historicalContext.previousProposals && historicalContext.previousProposals.length > 0) {
      const proposalsText = historicalContext.previousProposals.map(proposal => {
        return `${proposal.date} - ${proposal.title} (${proposal.status})${proposal.value ? ` - Value: ${proposal.value}` : ""} - Services: ${proposal.services.join(", ")}`;
      }).join("\n");
      contextParts.push(`Previous proposals:\n${proposalsText}`);
    }
    
    // Add relationship context
    if (historicalContext.relationshipContext && historicalContext.relationshipContext.length > 0) {
      contextParts.push(`Relationship context:\n- ${historicalContext.relationshipContext.join("\n- ")}`);
    }
    
    if (contextParts.length > 0) {
      historicalContextSection = `\nHistorical Relationship Context:\n${contextParts.join("\n\n")}\n`;
    }
  }
  
  // Create a detailed section about our company context to ensure adherence to our actual service offerings
  const servicesSection = `
    OUR EXACT SERVICES - DO NOT OFFER ANY SERVICES OUTSIDE THIS LIST:
    
    1. ${companyContext.coreServiceOfferings.aiPoweredLeadGeneration.title}:
      ${companyContext.coreServiceOfferings.aiPoweredLeadGeneration.services.map(s => `- ${s.name}: ${s.description}`).join('\n      ')}
    
    2. ${companyContext.coreServiceOfferings.agenticSalesFrameworks.title}:
      ${companyContext.coreServiceOfferings.agenticSalesFrameworks.services.map(s => `- ${s.name}: ${s.description}`).join('\n      ')}
    
    3. ${companyContext.coreServiceOfferings.pipelineNurturingSystems.title}:
      ${companyContext.coreServiceOfferings.pipelineNurturingSystems.services.map(s => `- ${s.name}: ${s.description}`).join('\n      ')}
  `;
  
  // Create a section about our company context from the companyContext object
  const aboutUsSection = `
    ABOUT NOBOX CREATIVES (COMPANY CONTEXT):
    ${companyContext.description}
    
    ${servicesSection}
    
    OUR STRATEGIC DIFFERENTIATORS:
    - ${companyContext.strategicDifferentiators.technicalStackAdvantage.points.join('\n    - ')}
    
    OUR PROVEN PERFORMANCE METRICS:
    - ${companyContext.strategicDifferentiators.performanceMetrics.points.join('\n    - ')}
    
    OUR VALUE PROPOSITION:
    ${companyContext.customerValueProposition.forSMBs}
    - ${companyContext.customerValueProposition.points.map(p => `${p.name}: ${p.description}`).join('\n    - ')}
    
    IMPACT FOR CLIENTS: ${companyContext.customerValueProposition.impact}
  `;

  // Extract our service names for validation 
  const ourServiceNames = [
    ...companyContext.coreServiceOfferings.aiPoweredLeadGeneration.services.map(s => s.name.toLowerCase()),
    ...companyContext.coreServiceOfferings.agenticSalesFrameworks.services.map(s => s.name.toLowerCase()),
    ...companyContext.coreServiceOfferings.pipelineNurturingSystems.services.map(s => s.name.toLowerCase())
  ];

  const prompt = `
    You are an expert cold outreach strategist and copywriter for nobox creatives, following the Jordan Platten attention-first, psychology-driven methodology. Generate a personalized outreach email to ${lead.firstName} ${lead.lastName}, ${lead.title || "a decision maker"} at ${company.name}.
    
    ================== CRITICAL CONSTRAINTS ==================
    You MUST ONLY refer to services that nobox creatives actually offers as listed in the company context.
    DO NOT invent or mention services outside of those explicitly listed.
    Our services are strictly limited to:
    ${ourServiceNames.map(s => `- ${s}`).join('\n    ')}
    
    If you're unsure whether a service is offered, DO NOT mention it. Stick only to what's explicitly listed.
    ================== END CONSTRAINTS ======================
    
    About them:
    - Company: ${company.name}
    - Industry: ${company.industry || "their industry"}
    - Company size: ${company.employeeCount || "unknown"} employees
    - Location: ${company.location || "unknown"}
    - Recent company events: ${company.recentEvents?.join(", ") || "None provided"}
    - Tech stack: ${company.techStack?.join(", ") || "Unknown"}
    
    ${hooksContext}
    ${previousEmailsContext}
    ${historicalContextSection}
    
    ${aboutUsSection}
    
    Campaign purpose: ${campaignPurpose}
    Service offering: ${serviceOffering}
    
    ATTENTION HOOK GUIDELINES (MOST IMPORTANT):
    - Use a "${attentionHookStyle}" style attention hook in the first 1-2 lines
    - The hook's purpose is to earn the right to be read by breaking patterns and creating intrigue
    - The hook should bypass the recipient's mental filter (<2-seconds) to avoid immediate deletion
    - Do not sell or explain in the hook - its only purpose is to create curiosity
    - For "curiosity" hooks: Break expectations, leave them needing more context
    - For "ego-trigger" hooks: Use personalized, novel praise that signals you've done homework
    - For "open-loop" hooks: Leave something unsaid that creates a need for closure (Zeigarnik Effect)
    - For "hyper-relevance" hooks: Demonstrate specific research on their company/industry/achievements
    - For "pattern-break" hooks: Flip the script, do the opposite of what's expected in cold emails
    
    EMAIL STRUCTURE GUIDELINES:
    - Subject line style: ${subjectLineStyle}
    - Create a compelling subject line that aligns with the attention hook style
    - After the hook, build context and credibility that flows naturally from the hook
    - Make the email feel relevant to the recipient's specific situation
    - Use locality references where possible to create a mental image of a real person nearby
    - Incorporate specific personalization showing you've done homework on them/their company
    - Avoid robotic language; build subconscious trust and social pressure to reply
    - Tone: ${tone}
    - Formality: ${formalityDescription} (${formality}/5)
    - Email length: ${wordCount} words
    - ${callToActionText}
    
    PERSONALIZATION GUIDELINES:
    - Reference one specific personalization hook or recent company event
    ${useHistoricalContext ? "- Reference relevant past projects or interactions when appropriate" : ""}
    - Focus personalization on them, not just what we do
    - Tailor the value proposition to align with their specific business needs based on their industry and tech stack
    - When mentioning our services, ONLY reference services listed in our company context
    - Focus on our core offerings: AI-Powered Lead Generation, Web Design, Digital Marketing & SEO, Workflow Automation, and AI Email Agents
    
    AVOID COMPLETELY:
    - Generic openings like "Hope you're well" or "Just reaching out"
    - Clichéd or obviously fake personalization
    - Premature direct offers before establishing curiosity
    - Anything that screams low-effort automation
    - Being overly salesy or pushy
    - Offering services we DON'T provide or inventing capabilities not listed
    
    FINAL CHECK BEFORE SUBMITTING YOUR RESPONSE:
    - Review the email and ensure ONLY services from our explicit list are mentioned
    - If any services outside our list appear, remove them completely
    - Double-check that you haven't promised capabilities we don't have
    
    Output format: Respond with JSON that includes a "subject" field and a "body" field. The email should feel individually crafted for this specific recipient. Do not include any markdown formatting, HTML, or code blocks.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      subject: result.subject,
      body: result.body,
    };
  } catch (error) {
    console.error("Error generating personalized email:", error);
    throw new Error("Failed to generate personalized email");
  }
}

// Generate Midjourney prompt for ad creation
export async function generateMidjourneyPrompt(params: MidjourneyPromptParams): Promise<string> {
  const { industry, campaignPurpose, targetAudience, style = "modern", mood = "professional" } = params;
  
  const prompt = `
    Create a detailed Midjourney prompt for an advertisement image.

    Details:
    - Industry: ${industry}
    - Campaign purpose: ${campaignPurpose}
    - Target audience: ${targetAudience}
    - Style preference: ${style}
    - Mood/tone: ${mood}
    
    Guidelines:
    - The prompt should be detailed enough to generate a professional-looking advertisement
    - Include specific visual elements, lighting, composition details
    - Include aspect ratio (preferably 16:9 for digital ads)
    - Use style keywords that Midjourney responds well to
    - Do NOT include any text in the image itself
    - Avoid any inappropriate or controversial imagery
    - Make it suitable for a B2B tech/consulting audience
    
    Output format: Return ONLY the Midjourney prompt text with no additional commentary, formatting, or explanation.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error generating Midjourney prompt:", error);
    throw new Error("Failed to generate Midjourney prompt");
  }
}

// Extract company information from website content
export async function extractCompanyContext(websiteContent: string, companyName: string): Promise<Partial<CompanyContext>> {
  const prompt = `
    Analyze the following website content for ${companyName} and extract key business information.
    
    Website content:
    ${websiteContent.substring(0, 4000)}... (truncated)
    
    Extract and organize the following information in JSON format:
    1. Industry/sector
    2. Approximate employee count (if mentioned)
    3. Location/headquarters
    4. Key technologies mentioned
    5. Recent company events or news
    6. Main products or services
    7. Target market/customers
    8. Suggested campaign purpose (a concise business goal for targeting this company)
    9. Suggested service offering (a specific value proposition that would appeal to this company)
    
    Output format: Return a structured JSON object with these fields. For any field where information is not available, use null.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      name: companyName,
      industry: result.industry || undefined,
      location: result.location || undefined,
      employeeCount: result.employee_count || undefined,
      techStack: result.key_technologies || undefined,
      recentEvents: result.recent_events || undefined,
      campaignPurpose: result.suggested_campaign_purpose || undefined,
      serviceOffering: result.suggested_service_offering || undefined,
    };
  } catch (error) {
    console.error("Error extracting company context:", error);
    throw new Error("Failed to extract company information");
  }
}

/**
 * Function to create a summary of Apify scraping results using AI
 * This generates initial values for all lead enrichment fields after raw scraping
 * @param scrapingResult The result from Apify's website scraping
 * @param companyName The name of the company being analyzed
 * @param websiteUrl The URL of the company website
 * @returns Summarized company context with AI-generated initial enrichment values
 */
export async function summarizeScrapingResultsWithAI(
  scrapingResult: WebsiteScrapingResult,
  companyName: string,
  websiteUrl: string
): Promise<Partial<CompanyContext>> {
  try {
    console.log(`Generating AI summary of Apify scraping results for ${companyName}`);
    
    // Extract text from scraping results
    const companyDescription = scrapingResult.companyInfo.description || '';
    const recentBlogPosts = scrapingResult.recentEvents.blogPosts?.join('\n') || '';
    const recentNews = scrapingResult.recentEvents.news?.join('\n') || '';
    const techStackInfo = JSON.stringify(scrapingResult.techStack);
    
    const contentSummary = `
      Company: ${companyName}
      Website: ${websiteUrl}
      Description: ${companyDescription}
      
      Tech Stack: ${techStackInfo}
      
      Recent Blog Posts:
      ${recentBlogPosts}
      
      Recent News:
      ${recentNews}
    `;
    
    const prompt = `
      You are analyzing a company based on data scraped from their website.
      
      Here's what was found:
      ${contentSummary}
      
      Based on this information, create an enrichment summary in JSON format with the following fields:
      1. industry: The specific industry this company operates in (be precise)
      2. location: Headquarters location if mentioned
      3. employeeCount: Approximate size of the company if mentioned
      4. recentEvents: Array of 2-3 most important recent company events
      5. keyTechnologies: Array of 3-5 most important technologies they use
      6. serviceOffering: A specific description of what they offer to clients
      7. campaignPurpose: A strategic goal this company might have that could be addressed in a sales campaign
      8. insights: Array of 2-3 significant business insights about this company
      
      Make reasonable inferences based on the available information. Be concise but specific.
      If you cannot determine a value with reasonable confidence, use null.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "user", content: prompt }
      ]
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      name: companyName,
      website: websiteUrl,
      industry: result.industry || undefined,
      location: result.location || undefined,
      employeeCount: result.employeeCount || undefined,
      recentEvents: result.recentEvents || undefined,
      techStack: result.keyTechnologies || undefined,
      campaignPurpose: result.campaignPurpose || undefined,
      serviceOffering: result.serviceOffering || undefined,
      // This will be used for insights field
      additionalContext: result.insights || undefined
    };
  } catch (error) {
    console.error("Error summarizing scraping results:", error);
    // Return basic info from the scraping result to ensure we have something
    return {
      name: companyName,
      website: websiteUrl,
      industry: scrapingResult.companyInfo.industry,
      location: scrapingResult.companyInfo.location
    };
  }
}

/**
 * Enhanced function to analyze website content using OpenAI's advanced capabilities
 * This performs a deep analysis beyond what Cheerio scraper can extract
 * @param websiteContent The scraped content from the website
 * @param companyName The name of the company being analyzed
 * @param existingData Any existing data we have about the company (to validate/enhance)
 * @returns Enhanced company context with AI-generated insights
 */
export async function enhanceWebsiteDataWithAI(
  websiteContent: string, 
  companyName: string,
  existingData?: Partial<CompanyContext>
): Promise<Partial<CompanyContext>> {
  try {
    console.log(`Enhancing website data with OpenAI for ${companyName}`);
    
    // Prepare context from existing data if available
    const existingContext = existingData 
      ? `\nExisting data we have:\n${JSON.stringify(existingData, null, 2)}\n` 
      : '';
    
    const prompt = `Analyze this website content for ${companyName} and extract detailed business information.
      ${existingContext}
      Website content sample:\n${websiteContent.slice(0, 12000)}\n
      Extract and provide the following in JSON format:
      1. industry: The specific industry or sector this company operates in (be precise)
      2. location: Headquarters location (city, country/state)
      3. recentEvents: Array of recent news, events, product launches (at least 3-5 items if found)
      4. serviceOffering: A specific and detailed description of their primary service offering (1-2 sentences)
      5. campaignPurpose: A strategic objective that would make sense for this company based on their offering and industry (what business goal might they have?)
      
      Make inferences based on the content where information isn't explicitly stated. Be specific and accurate.
      If you're unsure about any field, use the most likely value based on context clues and industry norms.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { 
          role: "system", 
          content: `You are an expert business analyst who specializes in extracting valuable company intelligence from website content.
            You make highly accurate inferences about companies based on limited information.
            Provide specific, detailed responses - not generic ones.
            Always respond with properly formatted JSON.` 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more factual responses
    });
    
    if (!response.choices || response.choices.length === 0) {
      console.warn("No response from OpenAI when enhancing website data");
      return existingData || {};
    }
    
    const content = response.choices[0].message.content;
    if (!content) {
      console.warn("Empty content from OpenAI when enhancing website data");
      return existingData || {};
    }
    
    try {
      const enhancedData = JSON.parse(content);
      console.log(`Successfully enhanced website data with AI for ${companyName}`);
      
      // Merge with existing data, preferring the AI-enhanced data for specific fields
      return {
        ...existingData,
        industry: enhancedData.industry || existingData?.industry,
        location: enhancedData.location || existingData?.location,
        recentEvents: Array.isArray(enhancedData.recentEvents) && enhancedData.recentEvents.length > 0 
          ? enhancedData.recentEvents 
          : existingData?.recentEvents,
        serviceOffering: enhancedData.serviceOffering || existingData?.serviceOffering,
        campaignPurpose: enhancedData.campaignPurpose || existingData?.campaignPurpose
      };
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      console.error("Raw response:", content);
      return existingData || {};
    }
  } catch (error) {
    console.error("Error enhancing website data with OpenAI:", error);
    return existingData || {};
  }
}

// Generate campaign suggestions based on company context
export async function generateCampaignSuggestions(
  companyData: Partial<CompanyContext>
): Promise<{ campaignPurpose: string, serviceOffering: string }> {
  // If the company data already has these fields from web scraping, return them
  if (companyData.campaignPurpose && companyData.serviceOffering) {
    return {
      campaignPurpose: companyData.campaignPurpose,
      serviceOffering: companyData.serviceOffering
    };
  }
  
  // Extract our service names for validation
  const ourServiceNames = [
    ...companyContext.coreServiceOfferings.aiPoweredLeadGeneration.services.map(s => s.name),
    ...companyContext.coreServiceOfferings.agenticSalesFrameworks.services.map(s => s.name),
    ...companyContext.coreServiceOfferings.pipelineNurturingSystems.services.map(s => s.name)
  ];

  // Create a detailed section about our service offerings to enforce constraints
  const ourServicesSection = `
    ================== CRITICAL CONSTRAINTS ==================
    The following are the ONLY services nobox creatives offers. DO NOT suggest anything outside of these:
    
    1. ${companyContext.coreServiceOfferings.aiPoweredLeadGeneration.title}:
       ${companyContext.coreServiceOfferings.aiPoweredLeadGeneration.services.map(s => `- ${s.name}: ${s.description}`).join('\n       ')}
       
    2. ${companyContext.coreServiceOfferings.agenticSalesFrameworks.title}:
       ${companyContext.coreServiceOfferings.agenticSalesFrameworks.services.map(s => `- ${s.name}: ${s.description}`).join('\n       ')}
       
    3. ${companyContext.coreServiceOfferings.pipelineNurturingSystems.title}:
       ${companyContext.coreServiceOfferings.pipelineNurturingSystems.services.map(s => `- ${s.name}: ${s.description}`).join('\n       ')}
    
    Our services are strictly limited to:
    ${ourServiceNames.map(service => `- ${service}`).join('\n    ')}
    
    If you're unsure whether a service is offered, DO NOT suggest it. Stick only to what's explicitly listed.
    ================== END CONSTRAINTS ======================
    
    About nobox creatives:
    ${companyContext.description}
    
    Our Performance Metrics:
    - ${companyContext.strategicDifferentiators.performanceMetrics.points.join('\n    - ')}
  `;

  // Otherwise generate new suggestions
  const prompt = `
    Generate targeted campaign ideas for outreach to ${companyData.name}.
    
    Company Information:
    - Industry: ${companyData.industry || "Unknown"}
    - Tech Stack: ${companyData.techStack?.join(", ") || "Unknown"}
    - Company Size: ${companyData.employeeCount || "Unknown"} employees
    - Location: ${companyData.location || "Unknown"}
    - Recent Events: ${companyData.recentEvents?.join(", ") || "None known"}
    
    ${ourServicesSection}
    
    We need to generate two key strategy elements that connect their needs with our services:
    1. Campaign Purpose: A concise business goal for targeting this company that aligns with our capabilities
    2. Service Offering: A specific value proposition from our core services that would appeal to this company
    
    CRITICAL REQUIREMENTS:
    - The campaign purpose MUST focus EXCLUSIVELY on services we actually offer. Do not reference services outside our list.
    - The service offering MUST be drawn directly from our core services list. Do not invent new services.
    - If you are unsure if something is within our service scope, do not include it.
    - Only use services that are explicitly listed in the CRITICAL CONSTRAINTS section.
    
    For example: 
    Campaign Purpose: "Help [Company] automate their customer service workflows using AI to reduce response times by 60%"
    Service Offering: "Our AI-powered workflow automation platform integrates with their existing CRM and reduces manual tasks by 75%."
    
    The campaign purpose should be tailored to their specific business situation and pain points.
    The service offering should align with their technology stack and business needs, and specifically reference one of our core service offerings.
    
    FINAL CHECK: Review your suggestion and remove any references to services not explicitly listed in our services section.
    
    Output format: Return a JSON object with "campaignPurpose" and "serviceOffering" fields.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    return {
      campaignPurpose: result.campaignPurpose || "",
      serviceOffering: result.serviceOffering || ""
    };
  } catch (error) {
    console.error("Error generating campaign suggestions:", error);
    // Return default values in case of error
    return {
      campaignPurpose: "Improve business processes with our automated workflow solutions",
      serviceOffering: "Our workflow automation platform reduces manual tasks and increases productivity"
    };
  }
}

// Generate personalization hooks based on company data
export async function generatePersonalizationHooks(
  leadData: LeadContext,
  companyData: CompanyContext,
  noboxServices: string[] = []
): Promise<string[]> {
  // Extract our service names for validation
  const ourServiceNames = [
    ...companyContext.coreServiceOfferings.aiPoweredLeadGeneration.services.map(s => s.name),
    ...companyContext.coreServiceOfferings.agenticSalesFrameworks.services.map(s => s.name),
    ...companyContext.coreServiceOfferings.pipelineNurturingSystems.services.map(s => s.name),
    ...noboxServices
  ];

  // Create a section with our service offerings details for reference
  const servicesSection = `
    OUR EXACT SERVICES - DO NOT REFERENCE SERVICES OUTSIDE THIS LIST:
    
    1. ${companyContext.coreServiceOfferings.aiPoweredLeadGeneration.title}:
      ${companyContext.coreServiceOfferings.aiPoweredLeadGeneration.services.map(s => `- ${s.name}: ${s.description}`).join('\n      ')}
    
    2. ${companyContext.coreServiceOfferings.agenticSalesFrameworks.title}:
      ${companyContext.coreServiceOfferings.agenticSalesFrameworks.services.map(s => `- ${s.name}: ${s.description}`).join('\n      ')}
    
    3. ${companyContext.coreServiceOfferings.pipelineNurturingSystems.title}:
      ${companyContext.coreServiceOfferings.pipelineNurturingSystems.services.map(s => `- ${s.name}: ${s.description}`).join('\n      ')}
  `;

  // Get performance metrics to use in hooks
  const performanceMetrics = companyContext.strategicDifferentiators.performanceMetrics.points;
  
  const prompt = `
    Generate personalized conversation hooks for outreach to a potential client.
    
    About the prospect:
    - Lead name: ${leadData.firstName} ${leadData.lastName}
    - Title: ${leadData.title || "Unknown"}
    - Company: ${companyData.name}
    - Industry: ${companyData.industry || "Unknown"}
    - Company size: ${companyData.employeeCount || "Unknown"} employees
    - Location: ${companyData.location || "Unknown"}
    - Recent company events: ${companyData.recentEvents?.join(", ") || "None known"}
    - Tech stack: ${companyData.techStack?.join(", ") || "Unknown"}
    
    ${servicesSection}
    
    About our company (nobox creatives):
    ${companyContext.description}
    
    Our complete services list:
    ${ourServiceNames.map(service => `- ${service}`).join('\n    ')}
    
    Our performance metrics:
    ${performanceMetrics.join("\n    ")}
    
    ================== CRITICAL CONSTRAINTS ==================
    You MUST ONLY reference services that nobox creatives actually offers as listed above.
    DO NOT mention or imply services outside of those explicitly listed.
    If you're unsure whether a service is offered, DO NOT reference it. Stick only to what's explicitly listed.
    ================== END CONSTRAINTS ======================
    
    Guidelines:
    - Generate 3-5 specific, personalized conversation hooks
    - Focus on business value and pain points relevant to their industry
    - Reference specific company details or events if available
    - Connect ONLY our actual services to their likely business challenges
    - Use our performance metrics to make compelling hooks
    - Each hook should be 1-2 sentences
    - Mention specific technologies or methodologies we use when relevant
    - NEVER reference services we don't actually offer
    
    FINAL CHECK: Review each hook and ensure it only references services we definitely offer.
    
    Output format: Return a JSON array of strings, with each string being one personalization hook.
  `;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    return Array.isArray(result.hooks) ? result.hooks : [];
  } catch (error) {
    console.error("Error generating personalization hooks:", error);
    throw new Error("Failed to generate personalization hooks");
  }
}
