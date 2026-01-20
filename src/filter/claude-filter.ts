import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Config, LumaEvent, FilteredEvent, ScrapedData, FilteredData } from '../scraper/types.js';

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

function loadScrapedEvents(): LumaEvent[] {
  const eventsPath = join(PROJECT_ROOT, 'data', 'all-events.json');
  if (!existsSync(eventsPath)) {
    throw new Error(`Events file not found: ${eventsPath}. Run the scraper first.`);
  }
  const data: ScrapedData = JSON.parse(readFileSync(eventsPath, 'utf-8'));
  return data.events;
}

export async function filterEvents(): Promise<FilteredEvent[]> {
  const config = loadConfig();
  const events = loadScrapedEvents();

  if (events.length === 0) {
    console.log('No events to filter');
    return [];
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }

  const client = new Anthropic({ apiKey });

  // Prepare events summary for the API
  const eventSummaries = events.map((e, i) => ({
    index: i,
    title: e.title,
    description: e.description?.substring(0, 500) || '',
    startTime: e.startTime,
    location: e.location,
    isOnline: e.isOnline,
    hostName: e.hostName,
  }));

  const prompt = `You are helping filter tech events based on user interests.

USER'S INTERESTS:
${config.filterText}

AVAILABLE EVENTS:
${JSON.stringify(eventSummaries, null, 2)}

TASK:
Select the TOP 5 most relevant events based on the user's interests. Consider:
1. How well the event topic matches the user's interests
2. The quality and specificity of the event (prefer focused events over generic ones)
3. Variety - try to include different types of relevant events

RESPONSE FORMAT:
Return ONLY a JSON array with exactly 5 objects, each containing:
- "index": the event index from the list above
- "reason": a brief explanation (1 sentence) of why this event is relevant

Example:
[
  {"index": 0, "reason": "AI agents meetup directly matches interest in LLM applications"},
  {"index": 3, "reason": "Technical deep-dive on transformer architectures"},
  ...
]

Return ONLY the JSON array, no other text.`;

  console.log('Calling Claude Haiku to filter events...');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  // Extract the text response
  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse the JSON response
  let selections: Array<{ index: number; reason: string }>;
  try {
    // Try to extract JSON from the response (in case there's extra text)
    const jsonMatch = textBlock.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    selections = JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Failed to parse Claude response:', textBlock.text);
    throw new Error(`Failed to parse Claude response: ${error}`);
  }

  // Map selections back to full events
  const filteredEvents: FilteredEvent[] = selections
    .filter(s => s.index >= 0 && s.index < events.length)
    .slice(0, 5)
    .map(s => ({
      ...events[s.index],
      relevanceReason: s.reason,
    }));

  console.log(`Selected ${filteredEvents.length} events`);

  // Save filtered events
  const outputPath = join(PROJECT_ROOT, 'data', 'filtered-events.json');
  const outputData: FilteredData = {
    filteredAt: new Date().toISOString(),
    filterText: config.filterText,
    events: filteredEvents,
  };
  writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
  console.log(`Saved to: ${outputPath}`);

  return filteredEvents;
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  filterEvents()
    .then(() => console.log('Filtering complete'))
    .catch(console.error);
}
