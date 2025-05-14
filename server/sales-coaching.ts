import OpenAI from "openai";
import { CompanyContext, LeadContext } from "./openai";

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. Do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  existingTips?: SalesCoachingTip[]
): Promise<SalesCoachingResult> {
  try {
    // Skip if no OpenAI API key is provided
    if (!process.env.OPENAI_API_KEY) {
      console.log("OpenAI API key is missing. Skipping sales coaching generation.");
      return {
        tips: existingTips || [],
        prospectAnalysis: "API key missing - cannot generate prospect analysis.",
        suggestedApproach: "API key missing - cannot generate suggested approach.",
        potentialObjections: [],
        keyValuePropositions: []
      };
    }

    // Create a detailed prompt with all the context we have
    const systemMessage = `You are an expert sales coach with decades of experience in B2B sales. 
You specialize in analyzing prospect data and providing actionable sales coaching advice.
Your goal is to help the salesperson craft the perfect approach for this specific lead.

Analyze the lead and company context, then provide:
1. 3-5 specific sales coaching tips tailored to this prospect's role, industry, and company
2. A brief prospect analysis (2-3 sentences)
3. A suggested approach strategy (2-3 sentences)
4. 2-3 potential objections the prospect might have
5. 2-3 key value propositions to emphasize

Format the response as a JSON object with the following structure:
{
  "tips": [
    {
      "tip": "Short, actionable tip title",
      "explanation": "Detailed explanation of the tip",
      "category": "One of: approach, objection-handling, value-proposition, follow-up, closing",
      "relevanceScore": number between 1-10
    }
  ],
  "prospectAnalysis": "Brief analysis of the prospect",
  "suggestedApproach": "Suggested approach strategy",
  "potentialObjections": ["Potential objection 1", "Potential objection 2"],
  "keyValuePropositions": ["Key value proposition 1", "Key value proposition 2"]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemMessage },
        { 
          role: "user", 
          content: `Here's the lead information:
Name: ${lead.firstName} ${lead.lastName}
Title: ${lead.title || 'Unknown'}
Email: ${lead.email}

Here's what we know about their company:
Company: ${companyData.name || 'Unknown'}
Industry: ${companyData.industry || 'Unknown'}
Website: ${companyData.website || 'Unknown'}
Employee Count: ${companyData.employeeCount || 'Unknown'}
Location: ${companyData.location || 'Unknown'}
Tech Stack: ${companyData.techStack ? companyData.techStack.join(', ') : 'Unknown'}
Recent Events: ${companyData.recentEvents ? companyData.recentEvents.join(', ') : 'None found'}

Our service offering focuses on: ${companyData.serviceOffering || 'Our usual service offerings'}
The campaign purpose is: ${companyData.campaignPurpose || 'Standard outreach'}

${companyData.additionalContext ? `Additional context: ${companyData.additionalContext.join(', ')}` : ''}

Please provide sales coaching guidance for approaching this prospect.`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500,
    });

    // Parse the response
    const result = JSON.parse(response.choices[0].message.content || "{}") as SalesCoachingResult;
    
    // Return the coaching tips
    return {
      tips: result.tips || [],
      prospectAnalysis: result.prospectAnalysis || "Unable to generate prospect analysis.",
      suggestedApproach: result.suggestedApproach || "Unable to generate suggested approach.",
      potentialObjections: result.potentialObjections || [],
      keyValuePropositions: result.keyValuePropositions || []
    };
  } catch (error) {
    console.error("Error generating sales coaching tips:", error);
    return {
      tips: existingTips || [],
      prospectAnalysis: "Error generating prospect analysis. Please try again later.",
      suggestedApproach: "Error generating suggested approach. Please try again later.",
      potentialObjections: [],
      keyValuePropositions: []
    };
  }
}