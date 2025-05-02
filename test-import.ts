import { importLeadsFromCSV } from './server/importers';

async function testImport() {
  try {
    // Test with sample file
    console.log('Testing import with sample_test_leads.csv...');
    const result = await importLeadsFromCSV('./uploads/csv/sample_test_leads.csv');
    
    console.log('Import result:', result);
    
    if (result.errors > 0 && result.errorDetails) {
      console.log('Errors encountered:');
      result.errorDetails.forEach((error, index) => {
        console.log(`Error ${index + 1}: ${error}`);
      });
    }
    
    console.log(`Successfully imported: ${result.imported}`);
    console.log(`Duplicates skipped: ${result.duplicates}`);
    console.log(`Errors encountered: ${result.errors}`);
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

testImport();
