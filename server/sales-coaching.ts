import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

export interface LeadContext {
  firstName: string;
  lastName: string;
  title: string;
  email: string;
}

export interface CompanyContext {
  name: string;
  website: string;
  industry: string;
  employeeCount?: number;
  location: string;
  techStack: string[];
  recentEvents: string[];
  additionalContext: string[];
  campaignPurpose: string;
  serviceOffering: string;
}

export interface SalesCoachingTip {
  tip: string;
  explanation: string;
  category: 'approach' | 'objection-handling' | 'value-proposition' | 'follow-up' | 'closing';
  relevanceScore: number; // 1-10 score indicating how relevant this tip is to the lead
}

export interface SalesCoachingResult {
  tips: SalesCoachingTip[];
  prospectAnalysis: string;
  suggestedApproach: string;
  potentialObjections: string[];
  keyValuePropositions: string[];
}

/**
 * Generate AI-powered sales coaching tips based on the lead and enrichment data
 */
export async function generateSalesCoachingTips(
  lead: LeadContext,
  companyData: CompanyContext,
  existingTips: SalesCoachingTip[] = []
): Promise<SalesCoachingResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // Create a comprehensive context for the AI
    const context = {
      lead,
      company: companyData,
      existingTips: existingTips.length > 0 ? existingTips : []
    };

    const systemMessage = `
You are an expert sales coach with deep experience in B2B SaaS sales, outreach, and negotiations.
Your task is to analyze the provided lead and their company information to generate strategic sales coaching tips.
Provide recommendations that will help our sales team effectively approach and communicate with this prospect.

For context, here's information about our company:
- NoboxCreatives is an AI-forward consultancy specializing in automated lead generation
- Our core offerings include AI-powered lead enrichment, personalized outreach, and workflow automation
- We focus on data-driven approach to sales with high-touch personalization at scale
- We integrate with various tools including Airtable, Asana, Google Sheets, and other workflow automation
- Our key differentiator is the level of personalization we provide in outreach campaigns

Your analysis should be comprehensive, strategic, and directly applicable to this specific lead.
Suggest approaches that align with the lead's industry, company size, and their specific needs or pain points.
    `;

    // Create the final prompt with all required information
    const prompt = `
Given the following information about a sales lead and their company, provide detailed sales coaching recommendations:

Lead Details:
- Name: ${lead.firstName} ${lead.lastName}
- Title: ${lead.title || "Unknown"}
- Email: ${lead.email}

Company Information:
- Company Name: ${companyData.name}
- Industry: ${companyData.industry || "Unknown"}
- Website: ${companyData.website}
- Location: ${companyData.location || "Unknown"}
- Employee Count: ${companyData.employeeCount || "Unknown"}

${companyData.techStack && companyData.techStack.length > 0 
  ? `Tech Stack: ${companyData.techStack.join(", ")}` 
  : ""}

${companyData.recentEvents && companyData.recentEvents.length > 0 
  ? `Recent Company Events:\n${companyData.recentEvents.map(event => `- ${event}`).join("\n")}` 
  : ""}

${companyData.additionalContext && companyData.additionalContext.length > 0 
  ? `Additional Context:\n${companyData.additionalContext.map(context => `- ${context}`).join("\n")}` 
  : ""}

Campaign Purpose: ${companyData.campaignPurpose}
Service Offering: ${companyData.serviceOffering}

Provide your coaching recommendations in JSON format with the following structure:
{
  "tips": [
    {
      "tip": "Brief actionable tip",
      "explanation": "Detailed explanation of how to implement this tip and why it would be effective",
      "category": "approach | objection-handling | value-proposition | follow-up | closing",
      "relevanceScore": 1-10 score (10 being most relevant)
    }
  ],
  "prospectAnalysis": "A strategic analysis of the prospect and their likely needs/pain points",
  "suggestedApproach": "Overall recommended approach for this lead",
  "potentialObjections": ["List of specific objections this prospect might raise"],
  "keyValuePropositions": ["Key value propositions that will resonate with this prospect"]
}
    `;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    if (!response.choices[0].message.content) {
      throw new Error("Failed to generate sales coaching tips - empty response");
    }

    // Parse the JSON response
    const result = JSON.parse(response.choices[0].message.content) as SalesCoachingResult;

    // Validate response structure
    if (!result.tips || !Array.isArray(result.tips)) {
      throw new Error("Invalid response format - missing tips array");
    }

    if (!result.prospectAnalysis || typeof result.prospectAnalysis !== 'string') {
      result.prospectAnalysis = "No prospect analysis available.";
    }

    if (!result.suggestedApproach || typeof result.suggestedApproach !== 'string') {
      result.suggestedApproach = "No suggested approach available.";
    }

    if (!result.potentialObjections || !Array.isArray(result.potentialObjections)) {
      result.potentialObjections = [];
    }

    if (!result.keyValuePropositions || !Array.isArray(result.keyValuePropositions)) {
      result.keyValuePropositions = [];
    }

    // Return the validated coaching data
    return result;
  } catch (error) {
    console.error("Error generating sales coaching tips:", error);
    // Return a default response if API call fails
    return {
      tips: existingTips.length > 0 ? existingTips : [
        {
          tip: "Focus on relationship building",
          explanation: "Start by establishing rapport and understanding their specific needs before pitching solutions.",
          category: 'approach',
          relevanceScore: 8
        }
      ],
      prospectAnalysis: "Unable to generate prospect analysis at this time.",
      suggestedApproach: "Use a consultative approach to understand their specific needs and challenges.",
      potentialObjections: ["Price concerns", "Timing not right", "Already using a competitor"],
      keyValuePropositions: ["Increased efficiency", "Cost reduction", "Better customer engagement"]
    };
  }
}