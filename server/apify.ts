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
  maxPages: number = 20,
  maxCrawlDepth: number = 3
): Promise<ScrapingResult[]> {
  try {
    console.log(`Starting Cheerio scraper for ${websiteUrl} (max pages: ${maxPages}, depth: ${maxCrawlDepth})`);
    
    // Check for valid URL format
    const url = new URL(websiteUrl);
    
    // Strip any paths and just use the domain for the initial request
    const baseUrl = `${url.protocol}//${url.hostname}`;
    console.log(`Using base URL: ${baseUrl} for scraping`);
    
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
        
        // Get more detailed content from specific sections
        const mainContent = [];
        
        // Common content containers
        const contentSelectors = [
          'article', '.content', '.main', 'main', '.post', '.page-content',
          '.article', '#content', '.entry-content', '.container'
        ];
        
        for (const selector of contentSelectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            elements.each((i, el) => {
              let sectionText = $(el).text().trim().replace(/\s+/g, ' ');
              if (sectionText && sectionText.length > 100) { // Only include substantial content
                mainContent.push(sectionText);
              }
            });
          }
        }
        
        // Extract paragraph content (more complete than just headers)
        const paragraphs = $('p').map((i, el) => $(el).text().trim()).get()
          .filter(p => p.length > 30); // Filter out short paragraphs
        
        // Get all header elements for better structure understanding
        const headers = {
          h1: $('h1').map((i, el) => $(el).text().trim()).get(),
          h2: $('h2').map((i, el) => $(el).text().trim()).get(),
          h3: $('h3').map((i, el) => $(el).text().trim()).get(),
          h4: $('h4').map((i, el) => $(el).text().trim()).get(),
        };
        
        // Extract dates for blog posts and news articles
        const dateSelectors = [
          'time', '.date', '.published', '.post-date', '.entry-date',
          '[datetime]', '[pubdate]', '.timestamp', '.post-timestamp'
        ];
        
        const dates = [];
        for (const selector of dateSelectors) {
          const elements = $(selector);
          if (elements.length > 0) {
            elements.each((i, el) => {
              const dateText = $(el).text().trim();
              const dateAttr = $(el).attr('datetime') || $(el).attr('pubdate');
              if (dateText) dates.push(dateText);
              if (dateAttr) dates.push(dateAttr);
            });
          }
        }
        
        // Better link extraction to find navigation and important pages
        const menuLinks = $('.nav, .navbar, .menu, header, .header, nav')
          .find('a')
          .map((i, el) => ({
            text: $(el).text().trim(),
            href: $(el).attr('href'),
            isInMenu: true
          }))
          .get();
          
        const regularLinks = $('a')
          .map((i, el) => ({
            text: $(el).text().trim(),
            href: $(el).attr('href'),
            isInMenu: false
          }))
          .get()
          .filter(link => link.text.length > 0 && link.href); // Filter out empty links
        
        // Get metadata
        const metadata = {
          metaDescription: description,
          headers: headers,
          paragraphs: paragraphs.slice(0, 10), // Limit to first 10 paragraphs
          dates: dates,
          menuLinks: menuLinks,
          links: regularLinks.slice(0, 50), // Limit to first 50 links to avoid huge objects
        };
        
        return {
          url,
          title,
          text,
          mainContent: mainContent.join('\n\n') || text, // Use mainContent if found, otherwise fall back to text
          metadata
        };
      }`,
    });

    console.log(`Cheerio scraper started with run ID: ${run.id}`);
    
    // Wait for the crawl to finish
    await apifyClient.run(run.id).waitForFinish();
    console.log(`Cheerio scraper finished run ID: ${run.id}`);
    
    // Retrieve and process the results
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    console.log(`Retrieved ${items?.length || 0} items from dataset ${run.defaultDatasetId}`);
    
    if (!items || items.length === 0) {
      console.warn(`No items returned from Cheerio scraper for ${baseUrl}`);
      return [];
    }
    
    // Log summary of scraped data
    console.log(`Scraped ${items.length} pages:`);
    items.slice(0, 3).forEach((item: any, index: number) => {
      console.log(`Page ${index + 1}: ${item.url} (title: ${item.title || 'No title'}, text length: ${item.text?.length || 0})`);
    });
    if (items.length > 3) {
      console.log(`... and ${items.length - 3} more pages`);
    }
    
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
    console.warn("No scraping results provided to extractCompanyInfo");
    return companyInfo;
  }
  
  console.log(`Extracting company information from ${scrapingResults.length} scraped pages`);
  
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
    console.warn("No scraping results provided to extractRecentEvents");
    return recentEvents;
  }
  
  console.log(`Extracting recent events from ${scrapingResults.length} scraped pages`);
  
  try {
    // Look for news/press/blog pages with expanded criteria
    const newsPages = scrapingResults.filter(page => 
      page.url.includes('/news') || 
      page.url.includes('/press') ||
      page.url.includes('/releases') ||
      page.url.includes('/media') ||
      page.url.includes('/announcements') ||
      page.title.toLowerCase().includes('news') ||
      page.title.toLowerCase().includes('press release') ||
      page.title.toLowerCase().includes('media') ||
      page.title.toLowerCase().includes('announcement')
    );
    console.log(`Found ${newsPages.length} potential news pages`);
    
    const blogPages = scrapingResults.filter(page => 
      page.url.includes('/blog') || 
      page.url.includes('/articles') ||
      page.url.includes('/posts') ||
      page.url.includes('/insights') ||
      page.title.toLowerCase().includes('blog') ||
      page.title.toLowerCase().includes('article') ||
      page.title.toLowerCase().includes('insights')
    );
    console.log(`Found ${blogPages.length} potential blog pages`);
    
    // Extract news items with improved methods
    if (newsPages.length > 0) {
      // For each news page, look for headlines/titles
      for (const page of newsPages) {
        // Check for the enhanced headers structure from our upgraded pageFunction
        const headers = page.metadata?.headers || {};
        const potentialNews = [
          ...(headers.h2 || []),
          ...(headers.h3 || [])
        ];
        
        // Also check for date information to identify recent content
        const dates = page.metadata?.dates || [];
        const hasDates = dates.length > 0;
        
        // If there are dates, try to pair headlines with dates
        if (hasDates && potentialNews.length > 0) {
          // Simple attempt to match by proximity/count
          // This is basic but provides some chronological context
          for (let i = 0; i < Math.min(potentialNews.length, 5); i++) { // Take up to 5 items
            const headline = potentialNews[i];
            const dateContext = dates[Math.min(i, dates.length - 1)];
            recentEvents.news?.push(`${headline} (${dateContext})`);
          }
        } else {
          // Fall back to just headlines if no dates
          recentEvents.news?.push(...potentialNews.slice(0, 5)); // Increased from 3 to 5
        }
        
        // Also check paragraphs for potential news content
        const paragraphs = page.metadata?.paragraphs || [];
        if (paragraphs.length > 0 && (!recentEvents.news || recentEvents.news.length < 3)) {
          // If we have few headlines, try to extract from paragraphs that might be news summaries
          const newsLikeParagraphs = paragraphs
            .filter(p => 
              p.includes('announce') || 
              p.includes('launch') || 
              p.includes('release') || 
              p.includes('introduce') ||
              p.includes('today') ||
              p.includes('recent')
            )
            .slice(0, 3);
          
          if (newsLikeParagraphs.length > 0) {
            recentEvents.news?.push(...newsLikeParagraphs);
          }
        }
      }
    }
    
    // Extract blog posts with improved methods
    if (blogPages.length > 0) {
      // For each blog page, extract more blog content
      for (const page of blogPages) {
        // Check for the enhanced headers structure
        const headers = page.metadata?.headers || {};
        const potentialPosts = [
          ...(headers.h2 || []),
          ...(headers.h3 || [])
        ];
        
        // Also look for dates to identify recent posts
        const dates = page.metadata?.dates || [];
        const hasDates = dates.length > 0;
        
        // If there are dates, try to pair blog post titles with dates
        if (hasDates && potentialPosts.length > 0) {
          for (let i = 0; i < Math.min(potentialPosts.length, 5); i++) {
            const postTitle = potentialPosts[i];
            const dateContext = dates[Math.min(i, dates.length - 1)];
            recentEvents.blogPosts?.push(`${postTitle} (${dateContext})`);
          }
        } else {
          // Fall back to just post titles
          recentEvents.blogPosts?.push(...potentialPosts.slice(0, 5));
        }
      }
    }
    
    // If we still have few or no news/blog posts, look at mainContent for clues
    if ((!recentEvents.news || recentEvents.news.length < 3) && (!recentEvents.blogPosts || recentEvents.blogPosts.length < 3)) {
      // Look at pages that might have content embedded but weren't categorized as news/blog
      const contentRichPages = scrapingResults
        .filter(page => page.mainContent && page.mainContent.length > 1000) // Pages with substantial content
        .slice(0, 3); // Limit to a few pages to not over-process
      
      for (const page of contentRichPages) {
        // Extract sentences that look like headlines or announcements
        const content = page.mainContent || page.text;
        const sentences = content.split(/[.!?]\s+/);
        
        const eventLikeSentences = sentences
          .filter(s => 
            s.length > 20 && s.length < 150 && // Not too short, not too long
            (s.includes('announce') || 
             s.includes('launch') || 
             s.includes('release') || 
             s.includes('introduce') ||
             s.includes('today') ||
             s.includes('recent') ||
             s.includes('new'))
          )
          .slice(0, 3);
        
        if (eventLikeSentences.length > 0) {
          if (!recentEvents.news || recentEvents.news.length < 3) {
            recentEvents.news?.push(...eventLikeSentences);
          } else if (!recentEvents.blogPosts || recentEvents.blogPosts.length < 3) {
            recentEvents.blogPosts?.push(...eventLikeSentences);
          }
        }
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
    // Only run Cheerio scraper without Wappalyzer for now
    const scrapingResults = await scrapeWebsiteWithApify(websiteUrl);
    
    // Process the results
    const companyInfo = await extractCompanyInfo(scrapingResults);
    const recentEvents = extractRecentEvents(scrapingResults);
    
    // Combine all results
    result.companyInfo = companyInfo;
    result.techStack = {
      frontend: [],
      backend: [],
      database: [],
      cloud: [],
      cms: [],
      analytics: [],
      libraries: [],
      frameworks: []
    }; // Default empty tech stack since Wappalyzer is disabled
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