import 'dotenv/config';
import { scrapeEvents } from './luma-scraper.js';
import { filterEvents } from '../filter/claude-filter.js';

async function main(): Promise<void> {
  console.log('=== Luma Events Scraper ===\n');

  try {
    // Step 1: Scrape events
    console.log('Step 1: Scraping events from lu.ma...');
    const events = await scrapeEvents();
    console.log(`Scraped ${events.length} events\n`);

    // Step 2: Filter events using Claude
    if (events.length > 0) {
      console.log('Step 2: Filtering events with Claude Haiku...');
      const filtered = await filterEvents();
      console.log(`Selected ${filtered.length} top events\n`);

      // Display results
      console.log('=== Top Events ===');
      for (const event of filtered) {
        console.log(`\n${event.title}`);
        console.log(`  Date: ${event.startTime}`);
        console.log(`  Location: ${event.location}`);
        console.log(`  Why: ${event.relevanceReason}`);
      }
    } else {
      console.log('No events found to filter.');
    }

    console.log('\n=== Complete ===');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
