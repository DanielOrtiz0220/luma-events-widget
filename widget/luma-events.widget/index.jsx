import { css, run } from "uebersicht";

// Configuration - Update these paths after installing
const DATA_PATH = "/Users/YOUR_USERNAME/Developer/luma-events/data/filtered-events.json";
const CONFIG_PATH = "/Users/YOUR_USERNAME/Developer/luma-events/config/config.json";

// Refresh every 5 minutes
export const refreshFrequency = 5 * 60 * 1000;

// Command to read the filtered events
export const command = `cat "${DATA_PATH}" 2>/dev/null || echo '{"events":[]}'`;

// Colors
const colors = {
  background: "rgba(25, 25, 30, 0.85)",
  accent: "#FF6B35",
  accentLight: "#FF8F65",
  text: "#FFFFFF",
  textMuted: "#A0A0A0",
  textDim: "#707070",
  border: "rgba(255, 107, 53, 0.3)",
  badgeToday: "#FF6B35",
  badgeTomorrow: "#FF8F65",
  badgeFuture: "rgba(255, 107, 53, 0.4)",
};

// Styles
const containerStyle = css`
  position: fixed;
  top: 20px;
  right: 20px;
  width: 380px;
  background: ${colors.background};
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid ${colors.border};
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif;
  color: ${colors.text};
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
`;

const headerStyle = css`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid ${colors.border};
`;

const titleStyle = css`
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
`;

const cogStyle = css`
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.2s, transform 0.2s;
  font-size: 18px;
  &:hover {
    opacity: 1;
    transform: rotate(45deg);
  }
`;

const eventStyle = css`
  display: flex;
  margin-bottom: 14px;
  cursor: pointer;
  transition: transform 0.2s, background 0.2s;
  border-radius: 8px;
  padding: 8px;
  margin-left: -8px;
  margin-right: -8px;
  &:hover {
    background: rgba(255, 107, 53, 0.1);
    transform: translateX(4px);
  }
  &:last-child {
    margin-bottom: 0;
  }
`;

const accentBarStyle = css`
  width: 3px;
  background: ${colors.accent};
  border-radius: 2px;
  margin-right: 12px;
  flex-shrink: 0;
`;

const eventContentStyle = css`
  flex: 1;
  min-width: 0;
`;

const eventTitleStyle = css`
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const eventMetaStyle = css`
  font-size: 12px;
  color: ${colors.textMuted};
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const dateStyle = css`
  color: ${colors.accent};
  font-weight: 500;
`;

const relativeBadgeBase = css`
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;

const badgeTodayStyle = css`
  ${relativeBadgeBase}
  background: ${colors.badgeToday};
  color: white;
`;

const badgeTomorrowStyle = css`
  ${relativeBadgeBase}
  background: ${colors.badgeTomorrow};
  color: white;
`;

const badgeFutureStyle = css`
  ${relativeBadgeBase}
  background: ${colors.badgeFuture};
  color: ${colors.text};
`;

const relevanceStyle = css`
  font-size: 11px;
  color: ${colors.textDim};
  margin-top: 4px;
  font-style: italic;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const coverImageStyle = css`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  margin-left: 12px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.1);
`;

const coverPlaceholderStyle = css`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  margin-left: 12px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  opacity: 0.3;
`;

const emptyStyle = css`
  text-align: center;
  color: ${colors.textMuted};
  padding: 20px 0;
  font-size: 13px;
`;

const footerStyle = css`
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid ${colors.border};
  font-size: 11px;
  color: ${colors.textDim};
  text-align: center;
`;

// Helper to format date
function formatDate(dateStr) {
  if (!dateStr) return "TBD";
  try {
    const date = new Date(dateStr);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = days[date.getDay()];
    const month = months[date.getMonth()];
    const dayNum = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    const hour12 = hours % 12 || 12;
    return `${day}, ${month} ${dayNum} • ${hour12}:${minutes} ${ampm}`;
  } catch {
    return dateStr;
  }
}

// Helper to get relative date info
function getRelativeDateInfo(dateStr) {
  if (!dateStr) return null;
  try {
    const eventDate = new Date(dateStr);
    const now = new Date();

    // Reset times to compare just dates
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffTime = eventDay - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return { label: "Today", type: "today" };
    if (diffDays === 1) return { label: "Tomorrow", type: "tomorrow" };
    if (diffDays > 1 && diffDays <= 7) return { label: `In ${diffDays} days`, type: "future" };
    if (diffDays > 7) return { label: `In ${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? "s" : ""}`, type: "future" };
    return null;
  } catch {
    return null;
  }
}

// Helper to format location
function formatLocation(location, isOnline) {
  if (isOnline) return "Online";
  if (!location || location === "TBD") return "";

  // Extract city from full address
  const parts = location.split(",");
  if (parts.length >= 2) {
    // Return city name
    return parts[parts.length - 2].trim();
  }
  return location.length > 20 ? location.substring(0, 20) + "..." : location;
}

// Helper to format relative time for "last updated"
function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } catch {
    return "";
  }
}

// Open config file in default editor (using run() for Übersicht)
function openConfig() {
  run(`open "${CONFIG_PATH}"`);
}

// Open event URL (using run() for Übersicht)
function openEvent(url) {
  // Only allow http/https URLs to prevent command injection
  if (url && /^https?:\/\//i.test(url)) {
    // Escape any shell-special characters
    const safeUrl = url.replace(/["`$\\]/g, '\\$&');
    run(`open "${safeUrl}"`);
  }
}

// Image component with fallback
function EventImage({ src, alt }) {
  // Only load images from lu.ma domain to prevent loading from untrusted sources
  const isValidSrc = src && /^https:\/\/[^/]*lu\.ma\//i.test(src);
  if (!isValidSrc) {
    return <div className={coverPlaceholderStyle}>📅</div>;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={coverImageStyle}
      onError={(e) => {
        e.target.style.display = "none";
      }}
    />
  );
}

// Relative date badge component
function RelativeBadge({ dateStr }) {
  const info = getRelativeDateInfo(dateStr);
  if (!info) return null;

  const badgeStyles = {
    today: badgeTodayStyle,
    tomorrow: badgeTomorrowStyle,
    future: badgeFutureStyle,
  };

  return <span className={badgeStyles[info.type]}>{info.label}</span>;
}

export const render = ({ output, error }) => {
  let events = [];
  let filteredAt = null;

  if (!error && output) {
    try {
      const data = JSON.parse(output);
      events = data.events || [];
      filteredAt = data.filteredAt;
    } catch (e) {
      console.error("Failed to parse events:", e);
    }
  }

  return (
    <div className={containerStyle}>
      <div className={headerStyle}>
        <span className={titleStyle}>Upcoming Events</span>
        <span className={cogStyle} onClick={openConfig} title="Edit filter settings">
          ⚙️
        </span>
      </div>

      {events.length === 0 ? (
        <div className={emptyStyle}>
          No events found.<br />
          Run the scraper to fetch events.
        </div>
      ) : (
        events.map((event, index) => (
          <div
            key={event.id || index}
            className={eventStyle}
            onClick={() => openEvent(event.url)}
            title="Click to open in browser"
          >
            <div className={accentBarStyle} />
            <div className={eventContentStyle}>
              <div className={eventTitleStyle}>{event.title}</div>
              <div className={eventMetaStyle}>
                <RelativeBadge dateStr={event.startTime} />
                <span className={dateStyle}>{formatDate(event.startTime)}</span>
                {formatLocation(event.location, event.isOnline) && (
                  <span>{formatLocation(event.location, event.isOnline)}</span>
                )}
              </div>
              {event.relevanceReason && (
                <div className={relevanceStyle} title={event.relevanceReason}>
                  💡 {event.relevanceReason.length > 60
                    ? event.relevanceReason.substring(0, 60) + "..."
                    : event.relevanceReason}
                </div>
              )}
            </div>
            <EventImage src={event.coverImageUrl} alt={event.title} />
          </div>
        ))
      )}

      {filteredAt && (
        <div className={footerStyle}>
          Updated {formatRelativeTime(filteredAt)}
        </div>
      )}
    </div>
  );
};
