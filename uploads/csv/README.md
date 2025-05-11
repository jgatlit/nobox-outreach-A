# CSV Import Templates

This directory contains CSV templates for importing various types of data into the system. Below are instructions for using each template:

## Leads Import Template

Use this template to bulk import new leads into the system.

**File**: `leads_import_template.csv`

**Required Fields**:
- `email`: Email address of the lead (must be unique)

**Optional Fields**:
- `firstName`: First name of the lead
- `lastName`: Last name of the lead
- `company`: Company name
- `title`: Job title
- `phoneNumber`: Contact phone number
- `website`: Company or personal website URL
- `linkedinUrl`: LinkedIn profile URL
- `source`: Source of the lead (default: import, options: pipedrive, asana, email, instantly, cyberleads, linkedin, manual, import, airtable)
- `status`: Lead status (default: active, options: active, inactive, contacted, responded, qualified, disqualified)
- `priority`: Lead priority (default: medium, options: low, medium, high, urgent)
- `notes`: Additional notes about the lead
- `tags`: Comma-separated tags in double quotes (e.g., "tag1,tag2,tag3")

## Gmail Email History Import Template

Use this template to import email exchange history for a specific lead.

**File**: `gmail_import_template.csv`

**Fields**:
- `subject`: Email subject line
- `summary`: Brief summary of the email content
- `sentiment`: Sentiment analysis (options: positive, neutral, negative)
- `date`: Date of the email (format: YYYY-MM-DD or YYYY-MM-DD HH:MM:SS)
- `contact`: Email address of the contact
- `cc`: Additional email addresses in CC (comma-separated within double quotes)
- `thread_id`: Unique identifier for the email thread (optional)

## Asana Project Import Template

Use this template to import project history from Asana for a specific lead.

**File**: `asana_import_template.csv`

**Fields**:
- `name`: Project name
- `description`: Project description
- `status`: Project status (e.g., completed, in progress, pending)
- `completion_date`: Date when the project was completed (format: YYYY-MM-DD)
- `completion_percentage`: Percentage of completion (0-100)
- `project_owner`: Name of the project owner
- `milestones`: Comma-separated milestones within double quotes (e.g., "Milestone 1, Milestone 2")
- `key_outcomes`: Comma-separated key outcomes within double quotes
- `project_type`: Type of project (e.g., past, current)

## Previous Proposals Import Template

Use this template to import previous proposal history for a specific lead.

**File**: `proposals_import_template.csv`

**Fields**:
- `title`: Proposal title
- `date`: Date of the proposal (format: YYYY-MM-DD)
- `value`: Monetary value of the proposal
- `status`: Proposal status (e.g., accepted, rejected, pending)
- `services`: Comma-separated list of services offered within double quotes
- `contact_name`: Name of the primary contact
- `decision_maker`: Name of the decision maker
- `next_follow_up_date`: Date for next follow-up (format: YYYY-MM-DD)
- `notes`: Additional notes about the proposal

## Import Instructions

1. Download the appropriate template
2. Fill in the data following the field descriptions above
3. Save the file as CSV format
4. Go to the appropriate import section in the application
5. Upload the completed CSV file
6. Confirm the import operation

**Note**: All dates should be in ISO format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS) for proper parsing.
