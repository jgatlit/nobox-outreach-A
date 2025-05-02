
import { db } from "../db";
import { leads, leadEnrichment } from "../shared/schema";

async function queryDatabase() {
  try {
    // Get all leads
    const allLeads = await db.select().from(leads);
    console.log("All leads:", allLeads);

    // Get leads with their enrichment data
    const leadsWithEnrichment = await db
      .select()
      .from(leads)
      .leftJoin(leadEnrichment, eq(leads.id, leadEnrichment.leadId));
    
    console.log("\nLeads with enrichment:", leadsWithEnrichment);

  } catch (error) {
    console.error("Error querying database:", error);
  } finally {
    await db.end();
  }
}

queryDatabase();
