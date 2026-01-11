import fetch from 'node-fetch';

/**
 * Fetches calendar events from Google Calendar API
 * @param {string} accessToken - Google OAuth access token
 * @param {Date} startDate - Start date for fetching events
 * @param {Date} endDate - End date for fetching events
 * @returns {Promise<Array>} Array of calendar events
 */
export async function fetchCalendarEvents(accessToken, startDate = new Date(), endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) {
  try {
    const timeMin = startDate.toISOString();
    const timeMax = endDate.toISOString();

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Calendar API error:', errorText);
      throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const events = (data.items || []).map(event => parseEvent(event));

    return events;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

/**
 * Finds free time slots between classes/events
 * @param {string} accessToken - Google OAuth access token
 * @param {Date} startDate - Start date for checking free time
 * @param {Date} endDate - End date for checking free time
 * @param {number} minDurationMinutes - Minimum duration for free time slot (default: 10)
 * @returns {Promise<Array>} Array of free time slots
 */
export async function findFreeTimeSlots(accessToken, startDate = new Date(), endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), minDurationMinutes = 10) {
  try {
    const events = await fetchCalendarEvents(accessToken, startDate, endDate);
    
    // Sort events by start time
    events.sort((a, b) => a.start.getTime() - b.start.getTime());

    const freeTimeSlots = [];
    const minDurationMs = minDurationMinutes * 60 * 1000;

    // Check free time for each day separately
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0); // Start checking from 8 AM
      
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(24, 0, 0, 0); // End checking at 10 PM

      // Get events for this day
      const dayEvents = events.filter(event => {
        const eventDate = new Date(event.start);
        return eventDate.toDateString() === currentDate.toDateString();
      });

      // Find gaps between events
      let lastEventEnd = currentDate;

      dayEvents.forEach(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);

        // Check for gap before this event
        const gapDuration = eventStart.getTime() - lastEventEnd.getTime();
        if (gapDuration >= minDurationMs) {
          freeTimeSlots.push({
            start: new Date(lastEventEnd),
            end: new Date(eventStart),
            durationMinutes: Math.floor(gapDuration / (60 * 1000)),
            date: new Date(currentDate)
          });
        }

        // Update last event end (use the later end time)
        if (eventEnd > lastEventEnd) {
          lastEventEnd = eventEnd;
        }
      });

      // Check for gap after last event of the day
      if (lastEventEnd < dayEnd) {
        const gapDuration = dayEnd.getTime() - lastEventEnd.getTime();
        if (gapDuration >= minDurationMs) {
          freeTimeSlots.push({
            start: new Date(lastEventEnd),
            end: new Date(dayEnd),
            durationMinutes: Math.floor(gapDuration / (60 * 1000)),
            date: new Date(currentDate)
          });
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Filter out past slots
    const now = new Date();
    return freeTimeSlots
      .filter(slot => slot.end > now)
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 20); // Limit to 20 slots
  } catch (error) {
    console.error('Error finding free time slots:', error);
    throw error;
  }
}

/**
 * Gets the next break (free time slot)
 * @param {string} accessToken - Google OAuth access token
 * @returns {Promise<Object|null>} Next break object or null
 */
export async function getNextBreak(accessToken) {
  try {
    const freeSlots = await findFreeTimeSlots(accessToken, new Date(), new Date(Date.now() + 24 * 60 * 60 * 1000), 10);
    
    if (freeSlots.length === 0) {
      return null;
    }

    const nextSlot = freeSlots[0];
    const now = new Date();

    // Check if this break is starting soon (within 5 minutes) or already started
    const timeUntilStart = nextSlot.start.getTime() - now.getTime();
    const isStartingSoon = timeUntilStart <= 5 * 60 * 1000 && timeUntilStart > -60 * 1000; // Within 5 min or just started

    return {
      ...nextSlot,
      isStartingSoon,
      minutesUntilStart: Math.floor(timeUntilStart / (60 * 1000))
    };
  } catch (error) {
    console.error('Error getting next break:', error);
    throw error;
  }
}

/**
 * Parses a calendar event from Google Calendar API
 * @param {Object} eventData - Raw event data from Calendar API
 * @returns {Object} Parsed event object
 */
function parseEvent(eventData) {
  const start = eventData.start?.dateTime || eventData.start?.date;
  const end = eventData.end?.dateTime || eventData.end?.date;

  return {
    id: eventData.id,
    summary: eventData.summary || 'No title',
    description: eventData.description || '',
    start: new Date(start),
    end: new Date(end),
    location: eventData.location || '',
    isAllDay: !eventData.start?.dateTime,
    attendees: eventData.attendees?.length || 0
  };
}

