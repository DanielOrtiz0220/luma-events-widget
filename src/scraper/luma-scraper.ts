import { chromium, Browser, Page } from 'playwright';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { LumaEvent, Config, ScrapedData } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

function loadConfig(): Config {
  const configPath = join(PROJECT_ROOT, 'config', 'config.json');
  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

function isWithinDays(dateStr: string, days: number): boolean {
  const eventDate = new Date(dateStr);
  const now = new Date();
  const futureLimit = new Date();
  futureLimit.setDate(futureLimit.getDate() + days);
  return eventDate >= now && eventDate <= futureLimit;
}

async function scrollToLoadMore(page: Page, maxScrolls: number = 5): Promise<void> {
  for (let i = 0; i < maxScrolls; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    try {
      await page.waitForLoadState('networkidle', { timeout: 3000 });
    } catch {
      // Network didn't go idle, continue anyway
    }
  }
}

async function extractEventsFromPage(page: Page): Promise<LumaEvent[]> {
  const events: LumaEvent[] = [];

  // Extract from __NEXT_DATA__
  const nextData = await page.evaluate(() => {
    const script = document.querySelector('script#__NEXT_DATA__');
    if (script) {
      try {
        return JSON.parse(script.textContent || '{}');
      } catch {
        return null;
      }
    }
    return null;
  });

  // The correct path is: props.pageProps.initialData.data.events
  const data = nextData?.props?.pageProps?.initialData?.data;

  if (data?.events) {
    console.log(`  Found ${data.events.length} events in __NEXT_DATA__`);
    for (const rawEvent of data.events) {
      events.push(parseEvent(rawEvent));
    }
  }

  // Also include featured_events
  if (data?.featured_events) {
    console.log(`  Found ${data.featured_events.length} featured events`);
    for (const rawEvent of data.featured_events) {
      // Avoid duplicates by checking if already added
      const id = rawEvent.api_id || rawEvent.event?.api_id;
      if (!events.some(e => e.id === id)) {
        events.push(parseEvent(rawEvent));
      }
    }
  }

  return events;
}

function parseEvent(raw: any): LumaEvent {
  // The event details are nested under raw.event
  const event = raw.event || raw;
  const startAt = event.start_at || raw.start_at || '';
  const endAt = event.end_at || '';

  // Determine location
  let location = 'TBD';
  let isOnline = event.location_type === 'online';

  if (event.geo_address_info?.full_address) {
    location = event.geo_address_info.full_address;
  } else if (event.geo_address_info?.address) {
    location = event.geo_address_info.address;
  } else if (event.geo_address_info?.city) {
    location = event.geo_address_info.city;
  } else if (isOnline) {
    location = 'Online';
  }

  // Get host name from raw.hosts array (it's at the top level, not nested)
  let hostName = '';
  if (raw.hosts && raw.hosts.length > 0) {
    hostName = raw.hosts.map((h: any) => h.name).join(', ');
  }

  return {
    id: raw.api_id || event.api_id || crypto.randomUUID(),
    title: event.name || 'Untitled Event',
    description: event.description || event.description_md || '',
    startTime: startAt,
    endTime: endAt,
    timezone: event.timezone || 'America/New_York',
    location,
    isOnline,
    url: `https://lu.ma/${event.url}`,
    hostName,
    coverImageUrl: event.cover_url,
  };
}

async function scrapeUrl(browser: Browser, url: string): Promise<LumaEvent[]> {
  const page = await browser.newPage();

  try {
    console.log(`Scraping: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // Scroll to load more events
    await scrollToLoadMore(page, 5);

    const events = await extractEventsFromPage(page);
    console.log(`Found ${events.length} events from ${url}`);

    return events;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return [];
  } finally {
    await page.close();
  }
}

export async function scrapeEvents(): Promise<LumaEvent[]> {
  const config = loadConfig();
  const browser = await chromium.launch({ headless: true });

  try {
    const allEvents: LumaEvent[] = [];
    const seenIds = new Set<string>();

    for (const url of config.urls) {
      const events = await scrapeUrl(browser, url);

      for (const event of events) {
        if (!seenIds.has(event.id)) {
          seenIds.add(event.id);
          allEvents.push(event);
        }
      }
    }

    // Filter to events within the configured days ahead
    const filteredEvents = allEvents.filter(event => {
      if (!event.startTime) return true; // Include if no date (will be filtered later)
      try {
        return isWithinDays(event.startTime, config.daysAhead);
      } catch {
        return true; // Include if date parsing fails
      }
    });

    // Sort by start time
    filteredEvents.sort((a, b) => {
      const dateA = new Date(a.startTime || 0);
      const dateB = new Date(b.startTime || 0);
      return dateA.getTime() - dateB.getTime();
    });

    console.log(`Total unique events within ${config.daysAhead} days: ${filteredEvents.length}`);

    // Save to file
    const outputPath = join(PROJECT_ROOT, 'data', 'all-events.json');
    const outputData: ScrapedData = {
      scrapedAt: new Date().toISOString(),
      events: filteredEvents,
    };
    writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`Saved to: ${outputPath}`);

    return filteredEvents;
  } finally {
    await browser.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeEvents()
    .then(() => console.log('Scraping complete'))
    .catch(console.error);
}
