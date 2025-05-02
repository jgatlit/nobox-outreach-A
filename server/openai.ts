import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "your-api-key" });

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
  
  const prompt = `
    You are an expert cold outreach strategist and copywriter, following the Jordan Platten attention-first, psychology-driven methodology. Generate a personalized outreach email to ${lead.firstName} ${lead.lastName}, ${lead.title || "a decision maker"} at ${company.name}.
    
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
    
    AVOID COMPLETELY:
    - Generic openings like "Hope you're well" or "Just reaching out"
    - Clichéd or obviously fake personalization
    - Premature direct offers before establishing curiosity
    - Anything that screams low-effort automation
    - Being overly salesy or pushy
    
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
  
  // Otherwise generate new suggestions
  const prompt = `
    Generate targeted campaign ideas for outreach to ${companyData.name}.
    
    Company Information:
    - Industry: ${companyData.industry || "Unknown"}
    - Tech Stack: ${companyData.techStack?.join(", ") || "Unknown"}
    - Company Size: ${companyData.employeeCount || "Unknown"} employees
    - Location: ${companyData.location || "Unknown"}
    - Recent Events: ${companyData.recentEvents?.join(", ") || "None known"}
    
    We need to generate two key strategy elements:
    1. Campaign Purpose: A concise business goal for targeting this company
    2. Service Offering: A specific value proposition that would appeal to this company
    
    For example: 
    Campaign Purpose: "Help [Company] automate their customer service workflows using AI to reduce response times by 60%"
    Service Offering: "Our AI-powered workflow automation platform integrates with their existing CRM and reduces manual tasks by 75%."
    
    The campaign purpose should be tailored to their specific business situation and pain points.
    The service offering should align with their technology stack and business needs.
    
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
    
    Our services:
    ${noboxServices.join(", ")}
    
    Guidelines:
    - Generate 3-5 specific, personalized conversation hooks
    - Focus on business value and pain points relevant to their industry
    - Reference specific company details or events if available
    - Connect our services to their likely business challenges
    - Each hook should be 1-2 sentences
    
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
