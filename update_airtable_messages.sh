#!/bin/bash

# This script updates all Airtable API key error messages to consistently reference 
# Personal Access Token (PAT) instead of generic API key references

# Update the common error message pattern
sed -i 's/Airtable not configured. Please add AIRTABLE_API_KEY and AIRTABLE_BASE_ID environment variables./Airtable not configured. Please add an Airtable Personal Access Token (PAT) as AIRTABLE_API_KEY and set your AIRTABLE_BASE_ID environment variables./g' server/routes.ts

# Update the variation with "correctly" in the message
sed -i 's/Airtable not configured correctly. Please check API key configuration./Airtable not configured correctly. Please check your Personal Access Token (PAT) configuration./g' server/routes.ts

# Update another variation
sed -i 's/Airtable not configured correctly/Airtable not configured correctly. Please check your Personal Access Token (PAT) configuration/g' server/routes.ts

# Update environment variable-only message
sed -i 's/Airtable not configured. Please add AIRTABLE_API_KEY environment variable./Airtable not configured. Please add an Airtable Personal Access Token (PAT) as AIRTABLE_API_KEY environment variable./g' server/routes.ts