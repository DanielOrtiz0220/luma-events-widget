export interface LumaEvent {
  id: string;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  timezone: string;
  location: string;
  isOnline: boolean;
  url: string;
  hostName: string;
  coverImageUrl?: string;
}

export interface Config {
  urls: string[];
  filterText: string;
  daysAhead: number;
}

export interface State {
  lastRun: string | null;
}

export interface FilteredEvent extends LumaEvent {
  relevanceReason: string;
}

export interface ScrapedData {
  scrapedAt: string;
  events: LumaEvent[];
}

export interface FilteredData {
  filteredAt: string;
  filterText: string;
  events: FilteredEvent[];
}
