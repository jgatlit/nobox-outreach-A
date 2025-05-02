import { ApifyClient } from 'apify-client';
import type { CompanyContext } from './openai';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_KEY,
});

interface ScrapingResult {
  url: string;
  title: string;
  text: string;
  html?: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface WebsiteTechStackData {
  frontend?: string[];
  backend?: string[];
  database?: string[];
  cloud?: string[];
  cms?: string[];
  analytics?: string[];
  libraries?: string[];
  frameworks?: string[];
}

export interface WebsiteScrapingResult {
  companyInfo: {
    industry?: string;
    employeeCount?: string;
    location?: string;
    founded?: string;
    description?: string;
  };
  techStack: WebsiteTechStackData;
  recentEvents: {
    news?: string[];
    blogPosts?: string[];
  };
  images?: string[];
  contactInfo?: {
    email?: string;
    phone?: string;
    address?: string;
  }
}

/**
 * Scrapes a website using Apify's Cheerio Scraper
 * @param websiteUrl The URL of the website to scrape
 * @param maxPages Maximum number of pages to scrape (default: 10)
 * @param maxCrawlDepth Maximum crawl depth (default: 2)
 * @returns Promise with the scraping result
 */
export async function scrapeWebsiteWithApify(
  websiteUrl: string,
  maxPages: number = 10,
  maxCrawlDepth: number = 2
): Promise<ScrapingResult[]> {
  try {
    // Check for valid URL format
    const url = new URL(websiteUrl);
    
    // Strip any paths and just use the domain for the initial request
    const baseUrl = `${url.protocol}//${url.hostname}`;
    
    // Start the Cheerio Scraper run
    const run = await apifyClient.actor("apify/cheerio-scraper").call({
      runMode: "PRODUCTION",
      startUrls: [{ url: baseUrl }],
      pseudoUrls: [{ purl: `${baseUrl}[(/.*)]` }],
      linkSelector: "a",
      maxRequestsPerCrawl: maxPages,
      maxCrawlDepth: maxCrawlDepth,
      additionalMimeTypes: ["text/plain"],
      preNavigationHooks: "",
      postNavigationHooks: "",
      maxRequestRetries: 3,
      maxPagesPerDomain: maxPages,
      pageFunction: `async function pageFunction(context) {
        const { $, request, log } = context;
        const url = request.url;
        const title = $('title').text().trim();
        const description = $('meta[name="description"]').attr('content') || '';
        
        // Extract all text content
        const body = $('body');
        let text = body.text().trim();
        text = text.replace(/\s+/g, ' ');
        
        // Get metadata
        const metadata = {
          metaDescription: description,
          h1: $('h1').text().trim(),
          h2: $('h2').map((i, el) => $(el).text().trim()).get(),
          links: $('a').map((i, el) => ({ text: $(el).text().trim(), href: $(el).attr('href') })).get()
        };
        
        return {
          url,
          title,
          text,
          metadata
        };
      }`,
    });

    // Wait for the crawl to finish
    await apifyClient.run(run.id).waitForFinish();
    
    // Retrieve and process the results
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    // Validate and transform items to ensure they match ScrapingResult structure
    const validatedItems = items.map(item => {
      const typedItem = item as Record<string, any>;
      return {
        url: typedItem.url || '',
        title: typedItem.title || '',
        text: typedItem.text || '',
        html: typedItem.html,
        metadata: typedItem.metadata
      } as ScrapingResult;
    });
    
    return validatedItems;
  } catch (error) {
    console.error('Error scraping website with Apify:', error);
    throw new Error(`Apify scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Detects technologies used on a website using Apify's Wappalyzer
 * @param websiteUrl The URL of the website to analyze
 * @returns Promise with the technology stack data
 */
export async function detectWebsiteTechStack(websiteUrl: string): Promise<WebsiteTechStackData> {
  try {
    // Run Wappalyzer
    const run = await apifyClient.actor("jpk/wappalyzer-scraper").call({
      startUrls: [{ url: websiteUrl }],
      maxDepth: 1,
      maxPages: 1,
    });

    // Wait for the analysis to finish
    await apifyClient.run(run.id).waitForFinish();
    
    // Get the results
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    if (!items || items.length === 0) {
      return {
        frontend: [],
        backend: [],
        database: [],
        cloud: [],
      };
    }
    
    const result = items[0] as any;
    const technologies = result.technologies || [];
    
    // Map technologies to categories
    const techStack: WebsiteTechStackData = {
      frontend: [],
      backend: [],
      database: [],
      cloud: [],
      cms: [],
      analytics: [],
      libraries: [],
      frameworks: [],
    };
    
    // Helper function to categorize technologies
    const categorizeTech = (tech: any) => {
      const name = tech.name;
      const cats = tech.categories.map((c: any) => c.name.toLowerCase());
      
      // Frontend technologies
      if (
        cats.includes('javascript frameworks') ||
        cats.includes('ui frameworks') ||
        name.match(/react|vue|angular|svelte|jquery/i)
      ) {
        techStack.frontend!.push(name);
      }
      // Backend technologies
      else if (
        cats.includes('programming languages') ||
        cats.includes('web frameworks') ||
        cats.includes('web servers') ||
        name.match(/node|express|django|flask|rails|php|laravel|asp\.net|go|ruby|spring/i)
      ) {
        techStack.backend!.push(name);
      }
      // Database technologies
      else if (
        cats.includes('databases') ||
        name.match(/sql|mongo|postgres|mysql|oracle|dynamodb|firebase/i)
      ) {
        techStack.database!.push(name);
      }
      // Cloud/hosting technologies
      else if (
        cats.includes('paas') ||
        cats.includes('saas') ||
        cats.includes('hosting') ||
        name.match(/aws|azure|google cloud|cloudflare|heroku|netlify|vercel/i)
      ) {
        techStack.cloud!.push(name);
      }
      // CMS
      else if (
        cats.includes('cms') ||
        name.match(/wordpress|drupal|joomla|shopify|contentful|strapi/i)
      ) {
        techStack.cms!.push(name);
      }
      // Analytics
      else if (
        cats.includes('analytics') ||
        name.match(/google analytics|mixpanel|amplitude|matomo|hotjar/i)
      ) {
        techStack.analytics!.push(name);
      }
      // Libraries and frameworks that don't fit elsewhere
      else if (cats.includes('javascript libraries') || cats.includes('libraries')) {
        techStack.libraries!.push(name);
      }
      else if (cats.includes('frameworks')) {
        techStack.frameworks!.push(name);
      }
      // Add to frontend as fallback for UI-related tech
      else if (cats.includes('ui')) {
        techStack.frontend!.push(name);
      }
    };
    
    // Process all detected technologies
    technologies.forEach(categorizeTech);
    
    // Remove empty arrays and ensure unique values
    Object.keys(techStack).forEach(key => {
      const typedKey = key as keyof WebsiteTechStackData;
      if (techStack[typedKey] && techStack[typedKey]!.length > 0) {
        techStack[typedKey] = [...new Set(techStack[typedKey])];
      } else {
        delete techStack[typedKey];
      }
    });
    
    return techStack;
  } catch (error) {
    console.error('Error detecting tech stack with Apify:', error);
    return {
      frontend: [],
      backend: [],
      database: [],
      cloud: []
    };
  }
}

/**
 * Extracts company information from scraped content
 * @param scrapingResults Results from website scraping
 * @returns Structured company information
 */
export async function extractCompanyInfo(scrapingResults: ScrapingResult[]): Promise<WebsiteScrapingResult['companyInfo']> {
  // Initialize result
  const companyInfo: WebsiteScrapingResult['companyInfo'] = {};
  
  if (!scrapingResults || scrapingResults.length === 0) {
    return companyInfo;
  }
  
  try {
    // Extract most likely homepage content
    const homepage = scrapingResults.find(page => 
      page.url.endsWith('/') || page.url.endsWith('.html') || !page.url.includes('/')
    ) || scrapingResults[0];
    
    // Look for about page
    const aboutPage = scrapingResults.find(page => 
      page.url.includes('/about') || 
      page.title.toLowerCase().includes('about') ||
      page.url.includes('/company')
    );
    
    // Get contact page if it exists
    const contactPage = scrapingResults.find(page => 
      page.url.includes('/contact') || 
      page.title.toLowerCase().includes('contact')
    );
    
    // Combine most relevant content for processing
    const relevantContent = [
      aboutPage?.text || '',
      homepage.text,
      contactPage?.text || ''
    ].join(' ');
    
    // Extract company description from meta description or first paragraphs
    companyInfo.description = homepage.metadata?.metaDescription || 
      aboutPage?.metadata?.metaDescription ||
      relevantContent.slice(0, 500);
      
    // Use regex patterns to find information
    // Employee count extraction
    const employeePatterns = [
      /(?:with|having|employing)\s+([0-9,]+)\s+employees/i,
      /(?:team|staff|workforce) of ([0-9,]+)/i,
      /([0-9,]+)\+?\s+employees/i,
      /([0-9,]+)\s+(?:people|professionals|experts)/i,
      /(?:over|more than)\s+([0-9,]+)\s+(?:employees|people|professionals)/i
    ];
    
    for (const pattern of employeePatterns) {
      const match = relevantContent.match(pattern);
      if (match && match[1]) {
        companyInfo.employeeCount = match[1].replace(/,/g, '');
        break;
      }
    }
    
    // Location extraction
    const locationPatterns = [
      /headquartered in ([^.,;]+)/i,
      /\bbased in ([^.,;]+)/i,
      /\boffices? in ([^.,;]+)/i,
      /\blocated in ([^.,;]+)/i
    ];
    
    for (const pattern of locationPatterns) {
      const match = relevantContent.match(pattern);
      if (match && match[1]) {
        companyInfo.location = match[1].trim();
        break;
      }
    }
    
    // Founded year extraction
    const foundedPatterns = [
      /founded in (\d{4})/i,
      /established in (\d{4})/i,
      /since (\d{4})/i,
    ];
    
    for (const pattern of foundedPatterns) {
      const match = relevantContent.match(pattern);
      if (match && match[1]) {
        companyInfo.founded = match[1];
        break;
      }
    }
    
    // Industry extraction - look for common industry terms
    const industryKeywords = [
      { term: 'software', industry: 'Software Development' },
      { term: 'technology', industry: 'Technology' },
      { term: 'healthcare', industry: 'Healthcare' },
      { term: 'health', industry: 'Healthcare' },
      { term: 'finance', industry: 'Finance' },
      { term: 'financial', industry: 'Finance' },
      { term: 'banking', industry: 'Banking' },
      { term: 'education', industry: 'Education' },
      { term: 'manufacturing', industry: 'Manufacturing' },
      { term: 'retail', industry: 'Retail' },
      { term: 'e-commerce', industry: 'E-commerce' },
      { term: 'ecommerce', industry: 'E-commerce' },
      { term: 'media', industry: 'Media' },
      { term: 'marketing', industry: 'Marketing' },
      { term: 'travel', industry: 'Travel & Hospitality' },
      { term: 'hospitality', industry: 'Travel & Hospitality' },
      { term: 'legal', industry: 'Legal' },
      { term: 'law', industry: 'Legal' },
      { term: 'insurance', industry: 'Insurance' },
      { term: 'real estate', industry: 'Real Estate' },
      { term: 'construction', industry: 'Construction' },
      { term: 'energy', industry: 'Energy' },
      { term: 'telecom', industry: 'Telecommunications' },
      { term: 'telecommunications', industry: 'Telecommunications' },
      { term: 'automotive', industry: 'Automotive' },
      { term: 'agriculture', industry: 'Agriculture' },
      { term: 'consulting', industry: 'Consulting' },
      { term: 'logistics', industry: 'Logistics & Supply Chain' },
      { term: 'supply chain', industry: 'Logistics & Supply Chain' },
      { term: 'food', industry: 'Food & Beverage' },
      { term: 'beverage', industry: 'Food & Beverage' },
      { term: 'non-profit', industry: 'Non-profit' },
      { term: 'nonprofit', industry: 'Non-profit' },
      { term: 'government', industry: 'Government' },
      { term: 'saas', industry: 'SaaS' },
      { term: 'cloud', industry: 'Cloud Computing' },
      { term: 'ai', industry: 'Artificial Intelligence' },
      { term: 'artificial intelligence', industry: 'Artificial Intelligence' },
      { term: 'machine learning', industry: 'Artificial Intelligence' },
      { term: 'blockchain', industry: 'Blockchain' },
      { term: 'crypto', industry: 'Blockchain & Cryptocurrency' },
      { term: 'iot', industry: 'Internet of Things' },
      { term: 'internet of things', industry: 'Internet of Things' },
    ];
    
    const lowerContent = relevantContent.toLowerCase();
    for (const { term, industry } of industryKeywords) {
      if (lowerContent.includes(term)) {
        companyInfo.industry = industry;
        break;
      }
    }
    
    return companyInfo;
  } catch (error) {
    console.error('Error extracting company info:', error);
    return companyInfo;
  }
}

/**
 * Extracts recent news and blog posts from scraped content
 * @param scrapingResults Results from website scraping
 * @returns Structured recent events data
 */
export function extractRecentEvents(scrapingResults: ScrapingResult[]): WebsiteScrapingResult['recentEvents'] {
  const recentEvents: WebsiteScrapingResult['recentEvents'] = {
    news: [],
    blogPosts: []
  };
  
  if (!scrapingResults || scrapingResults.length === 0) {
    return recentEvents;
  }
  
  try {
    // Look for news/press/blog pages
    const newsPages = scrapingResults.filter(page => 
      page.url.includes('/news') || 
      page.url.includes('/press') ||
      page.title.toLowerCase().includes('news') ||
      page.title.toLowerCase().includes('press release')
    );
    
    const blogPages = scrapingResults.filter(page => 
      page.url.includes('/blog') || 
      page.title.toLowerCase().includes('blog')
    );
    
    // Extract news items
    if (newsPages.length > 0) {
      // For each news page, look for headlines/titles
      for (const page of newsPages) {
        // Look for h2/h3 elements that likely represent news items
        const potentialNews = page.metadata?.h2 || [];
        recentEvents.news?.push(...potentialNews.slice(0, 3));
      }
    }
    
    // Extract blog posts
    if (blogPages.length > 0) {
      // For each blog page, look for post titles
      for (const page of blogPages) {
        // Look for h2/h3 elements that likely represent blog posts
        const potentialPosts = page.metadata?.h2 || [];
        recentEvents.blogPosts?.push(...potentialPosts.slice(0, 3));
      }
    }
    
    // Deduplicate and limit
    if (recentEvents.news && recentEvents.news.length > 0) {
      recentEvents.news = [...new Set(recentEvents.news)].slice(0, 5);
    }
    
    if (recentEvents.blogPosts && recentEvents.blogPosts.length > 0) {
      recentEvents.blogPosts = [...new Set(recentEvents.blogPosts)].slice(0, 5);
    }
    
    return recentEvents;
  } catch (error) {
    console.error('Error extracting recent events:', error);
    return {
      news: [],
      blogPosts: []
    };
  }
}

/**
 * Main function to scrape and process a website
 * @param websiteUrl The URL of the website to scrape and analyze
 * @returns Promise with all scraped and structured data
 */
export async function processWebsite(websiteUrl: string): Promise<WebsiteScrapingResult> {
  // Initialize result structure
  const result: WebsiteScrapingResult = {
    companyInfo: {},
    techStack: {
      frontend: [],
      backend: [],
      database: [],
      cloud: []
    },
    recentEvents: {
      news: [],
      blogPosts: []
    }
  };
  
  try {
    // Run tasks in parallel
    const [scrapingResults, techStackData] = await Promise.all([
      scrapeWebsiteWithApify(websiteUrl),
      detectWebsiteTechStack(websiteUrl)
    ]);
    
    // Process the results
    const companyInfo = await extractCompanyInfo(scrapingResults);
    const recentEvents = extractRecentEvents(scrapingResults);
    
    // Combine all results
    result.companyInfo = companyInfo;
    result.techStack = techStackData;
    result.recentEvents = recentEvents;
    
    return result;
  } catch (error) {
    console.error('Error processing website:', error);
    return result;
  }
}

/**
 * Convert WebsiteScrapingResult to CompanyContext for OpenAI
 * This bridges the data format from Apify to the format expected by OpenAI functions
 */
export function convertToCompanyContext(scrapingResult: WebsiteScrapingResult, websiteUrl: string, companyName: string): CompanyContext {
  return {
    name: companyName,
    industry: scrapingResult.companyInfo.industry,
    website: websiteUrl,
    recentEvents: scrapingResult.recentEvents.news,
    techStack: [
      ...(scrapingResult.techStack.frontend || []),
      ...(scrapingResult.techStack.backend || []),
      ...(scrapingResult.techStack.database || []),
      ...(scrapingResult.techStack.cloud || [])
    ],
    employeeCount: scrapingResult.companyInfo.employeeCount ? 
      parseInt(scrapingResult.companyInfo.employeeCount.replace(/[^0-9]/g, '')) || undefined : 
      undefined,
    location: scrapingResult.companyInfo.location
  };
}