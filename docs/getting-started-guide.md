# Getting Started Guide: noboxLeadGen

This guide will walk you through the essential steps to start using the noboxLeadGen platform for lead management, web scraping, and personalized email generation.

## 1. Setting Up Your Account

1. **Launch the application**: Access the noboxLeadGen dashboard via your web browser.
2. **API Credentials**: Ensure your OpenAI API key is configured in your environment settings for AI-powered features.

## 2. Importing Leads

### Method 1: Manual Import

1. Navigate to the **Lead Management** tab in the side navigation.
2. Click the **+ Import Leads** button in the top right corner.
3. Fill in the required fields for each lead:
   - First Name and Last Name
   - Email Address (required)
   - Company Name
   - Job Title
   - Website (needed for enrichment)
4. Click **Save** to add the lead to your database.

### Method 2: CSV Import

1. Navigate to the **Lead Management** tab.
2. Click the **+ Import Leads** button.
3. Select the **Bulk Import** tab.
4. Click **Select CSV File** and choose your prepared CSV file.
   - Ensure your CSV includes headers matching our format: firstName, lastName, email, company, title, website, etc.
5. Use the mapping tool to connect your CSV columns to our database fields.
6. Click **Import** to begin the process.
7. Review the import summary showing successful imports and any errors.

### Method 3: Integration Import

1. Go to the **Integrations** tab in the side navigation.
2. Select a data source (LinkedIn, Pipedrive, CyberLeads, etc.).
3. Authenticate the integration by following the provided steps.
4. Configure sync settings (frequency, filters, tags, etc.).
5. Click **Start Sync** to import leads from the connected platform.

## 3. Lead Enrichment & Web Scraping

### Automatic Enrichment

1. After importing leads, go to the **Workflows** tab.
2. Find the **Lead Enrichment** workflow.
3. Click the **Run** button to start the enrichment process for all leads with the "pending" enrichment status.
4. The system will:
   - Visit each lead's company website
   - Extract company information (industry, size, location)
   - Identify technology stack
   - Collect recent news/events
   - Generate personalization hooks

### Manual Enrichment

1. From the **Lead Management** tab, click on a specific lead.
2. In the lead detail view, click the **Enrich Lead** button in the right sidebar.
3. The system will perform the enrichment in real-time.
4. Review the collected data and make any necessary adjustments.

## 4. Generating Personalized Emails

### Creating Email Templates

1. Navigate to the **Lead Detail** page for your target lead.
2. Scroll to the **Email Generator** section in the right column.
3. Configure your email parameters:
   - **Campaign Purpose**: Define your outreach objective
   - **Service Offering**: Describe your product/service value proposition
   - **Tone**: Choose from professional, conversational, friendly, authoritative, or empathetic
   - **Formality Level**: Set on a scale of 1-5 (casual to formal)
   - **Subject Line Style**: Select direct, question, benefit, or curiosity
   - **Email Length**: Choose short, medium, or long
   - **Call to Action**: Specify your desired next step

4. Toggle options to include:
   - Personalized hooks (from enrichment data)
   - Recent company events

5. Click **Generate Email** to create a personalized draft.

### Managing Email Drafts

1. Generated emails appear in the **Email Drafts** section below the generator.
2. For each draft, you can:
   - **Preview** the complete email
   - **Edit** to make manual adjustments
   - **Send** directly to the lead's email address
   - **Export** to Google Docs or other formats
   - **Delete** unwanted drafts

## 5. Campaign Management

1. Go to the **Campaigns** tab to organize your outreach efforts.
2. Click **+ New Campaign** to create a campaign structure.
3. Add leads to your campaign by:
   - Selecting from your existing leads
   - Setting filters (industry, company size, status, etc.)
4. Configure campaign settings:
   - Email sequence timing
   - Follow-up cadence
   - A/B testing parameters
5. Launch your campaign from the campaign detail page.

## 6. Monitoring & Analytics

1. Return to the **Dashboard** to track key metrics:
   - Total leads and active campaigns
   - Response rates and conversion metrics
   - Enrichment status across your database
   - Email performance statistics

2. Use the **Workflows** tab to monitor automation processes:
   - Lead enrichment progress
   - Email generation status
   - Campaign execution

## Tips for Success

1. **Quality Data**: Ensure lead contact information and company websites are accurate for better enrichment results.

2. **Personalization**: Review and refine AI-generated hooks before sending emails to ensure relevance.

3. **Test Emails**: Send test emails to yourself first to verify tone and formatting.

4. **Iterate**: Use response data to refine your email parameters for better engagement.

5. **Regular Updates**: Run the enrichment workflow periodically to keep company information current.

By following these steps, you'll be able to efficiently manage leads, extract valuable company information through web scraping, and generate highly personalized emails that increase your response rates.