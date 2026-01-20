import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { scrapeEvents } from '../scraper/luma-scraper.js';
import { filterEvents } from '../filter/claude-filter.js';
import { State } from '../scraper/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');

const STATE_PATH = join(PROJECT_ROOT, 'config', 'state.json');
const LOGS_DIR = join(PROJECT_ROOT, 'logs');

function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);

  // Also write to log file
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
  const logFile = join(LOGS_DIR, `${new Date().toISOString().split('T')[0]}.log`);
  appendFileSync(logFile, logMessage + '\n');
}

function loadState(): State {
  if (!existsSync(STATE_PATH)) {
    return { lastRun: null };
  }
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    return { lastRun: null };
  }
}

function saveState(state: State): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function shouldRun(state: State): boolean {
  if (!state.lastRun) {
    log('No previous run recorded, should run');
    return true;
  }

  const lastRunDate = new Date(state.lastRun);
  const now = new Date();
  const hoursSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60);

  log(`Hours since last run: ${hoursSinceLastRun.toFixed(2)}`);

  // Run if more than 20 hours have passed (allows for some schedule flexibility)
  if (hoursSinceLastRun >= 20) {
    log('More than 20 hours since last run, should run');
    return true;
  }

  log('Recently run, skipping');
  return false;
}

export async function runWithCatchup(force: boolean = false): Promise<void> {
  log('=== Luma Events Scraper Started ===');

  const state = loadState();

  if (!force && !shouldRun(state)) {
    log('Skipping run (use --force to override)');
    return;
  }

  try {
    // Run the scraper
    log('Starting scraper...');
    await scrapeEvents();
    log('Scraping complete');

    // Run the filter
    log('Starting filter...');
    await filterEvents();
    log('Filtering complete');

    // Update state
    state.lastRun = new Date().toISOString();
    saveState(state);
    log('State updated');

    log('=== Run completed successfully ===');
  } catch (error) {
    log(`ERROR: ${error}`);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force');
  runWithCatchup(force)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
