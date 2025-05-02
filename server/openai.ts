import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "your-api-key" });

interface CompanyContext {
  name: string;
  industry?: string;
  website?: string;
  recentEvents?: string[];
  techStack?: string[];
  employeeCount?: number;
  location?: string;
}

interface LeadContext {
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
    styleOptions = {} 
  } = params;
  
  const { 
    tone = 'professional', 
    formality = 3, 
    subjectLineStyle = 'direct',
    emailLength = 'medium' 
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
  
  const prompt = `
    Generate a personalized outreach email to ${lead.firstName} ${lead.lastName}, ${lead.title || "a decision maker"} at ${company.name}.
    
    About them:
    - Company: ${company.name}
    - Industry: ${company.industry || "their industry"}
    - Company size: ${company.employeeCount || "unknown"} employees
    - Location: ${company.location || "unknown"}
    - Recent company events: ${company.recentEvents?.join(", ") || "None provided"}
    - Tech stack: ${company.techStack?.join(", ") || "Unknown"}
    
    ${hooksContext}
    ${previousEmailsContext}
    
    Campaign purpose: ${campaignPurpose}
    Service offering: ${serviceOffering}
    
    Email Style Guidelines:
    - Tone: ${tone}
    - Formality: ${formalityDescription} (${formality}/5)
    - Subject line style: ${subjectLineStyle}
    - Email length: ${wordCount} words
    - ${callToActionText}
    - Reference one specific personalization hook or recent company event
    - Don't be too salesy or pushy
    - Don't use generic phrases like "I hope this email finds you well"
    
    Output format: Respond with JSON that includes a "subject" field and a "body" field. Do not include any markdown formatting, HTML, or code blocks.
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
    };
  } catch (error) {
    console.error("Error extracting company context:", error);
    throw new Error("Failed to extract company information");
  }
}

// Generate personalization hooks based on company data
export async function generatePersonalizationHooks(
  leadData: LeadContext,
  companyData: CompanyContext,
  noboxServices: string[]
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
