import fetch from 'node-fetch';

/**
 * Fetches emails from Gmail API
 * @param {string} accessToken - Google OAuth access token
 * @param {number} maxResults - Maximum number of emails to fetch (default: 50)
 * @returns {Promise<Array>} Array of email objects
 */
export async function fetchEmails(accessToken, maxResults = 50) {
  try {
    // First, get list of message IDs
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=is:unread OR has:attachment OR (subject:homework OR subject:assignment OR subject:deadline OR subject:due)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('Gmail API list error:', errorText);
      throw new Error(`Gmail API error: ${listResponse.status} ${listResponse.statusText}`);
    }

    const listData = await listResponse.json();
    const messageIds = listData.messages || [];

    // Fetch full details for each message
    const emailPromises = messageIds.slice(0, 20).map(async (message) => {
      try {
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}?format=full`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (!messageResponse.ok) {
          console.error(`Failed to fetch message ${message.id}`);
          return null;
        }

        const messageData = await messageResponse.json();
        return parseEmail(messageData);
      } catch (error) {
        console.error(`Error fetching message ${message.id}:`, error);
        return null;
      }
    });

    const emails = await Promise.all(emailPromises);
    return emails.filter(email => email !== null);
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
}

/**
 * Parses a Gmail message to extract relevant information
 * @param {Object} messageData - Raw message data from Gmail API
 * @returns {Object} Parsed email object with task information
 */
function parseEmail(messageData) {
  const headers = messageData.payload.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const subject = getHeader('subject');
  const from = getHeader('from');
  const date = getHeader('date');
  const messageId = messageData.id;

  // Extract body text
  let bodyText = '';
  if (messageData.payload.body?.data) {
    bodyText = Buffer.from(messageData.payload.body.data, 'base64').toString('utf-8');
  } else if (messageData.payload.parts) {
    // Try to find text/plain or text/html part
    const textPart = messageData.payload.parts.find(part => 
      part.mimeType === 'text/plain' || part.mimeType === 'text/html'
    );
    if (textPart?.body?.data) {
      bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      // Remove HTML tags if HTML
      if (textPart.mimeType === 'text/html') {
        bodyText = bodyText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      }
    }
  }

  // Extract tasks and deadlines
  const tasks = extractTasks(subject, bodyText);
  const deadlines = extractDeadlines(subject, bodyText, date);

  return {
    id: messageId,
    subject,
    from,
    date: new Date(date),
    body: bodyText.substring(0, 500), // First 500 chars
    tasks,
    deadlines,
    hasAttachment: messageData.payload.parts?.some(part => part.filename && part.filename.length > 0) || false
  };
}

/**
 * Extracts tasks from email subject and body
 * @param {string} subject - Email subject
 * @param {string} body - Email body text
 * @returns {Array} Array of task objects
 */
function extractTasks(subject, body) {
  const tasks = [];
  const text = `${subject} ${body}`.toLowerCase();

  // Look for task indicators
  const taskPatterns = [
    /(?:complete|finish|submit|turn in|do|work on)\s+([^.!?]{10,100})/gi,
    /(?:homework|assignment|project|task|todo|to-do):\s*([^.!?\n]{10,100})/gi,
    /need to\s+([^.!?]{10,100})/gi,
    /please\s+(?:complete|submit|finish|do)\s+([^.!?]{10,100})/gi
  ];

  taskPatterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
      const taskText = match[1]?.trim();
      if (taskText && taskText.length > 5) {
        tasks.push({
          text: taskText.substring(0, 200),
          source: 'email',
          importance: calculateImportance(subject, body, taskText)
        });
      }
    });
  });

  // If no specific tasks found but email mentions homework/assignment, use subject
  if (tasks.length === 0 && (text.includes('homework') || text.includes('assignment') || text.includes('project'))) {
    tasks.push({
      text: subject,
      source: 'email',
      importance: calculateImportance(subject, body, subject)
    });
  }

  return tasks.slice(0, 5); // Limit to 5 tasks per email
}

/**
 * Extracts deadlines from email subject and body
 * @param {string} subject - Email subject
 * @param {string} body - Email body text
 * @param {string} emailDate - Email date string
 * @returns {Array} Array of deadline objects
 */
function extractDeadlines(subject, body, emailDate) {
  const deadlines = [];
  const text = `${subject} ${body}`;

  // Date patterns
  const datePatterns = [
    /(?:due|deadline|submit by|turn in by|by)\s+(?:on\s+)?([A-Z][a-z]+day,?\s+\d{1,2}(?:\/\d{1,2})?(?:\/\d{2,4})?)/gi,
    /(?:due|deadline|submit by|turn in by|by)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/gi,
    /(?:due|deadline|submit by|turn in by|by)\s+([A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?)/gi,
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s+(?:is|are)?\s+(?:due|deadline)/gi
  ];

  datePatterns.forEach(pattern => {
    const matches = [...text.matchAll(pattern)];
    matches.forEach(match => {
      const dateStr = match[1]?.trim();
      if (dateStr) {
        const parsedDate = parseDate(dateStr, emailDate);
        if (parsedDate && parsedDate > new Date()) {
          deadlines.push({
            date: parsedDate,
            text: dateStr,
            source: 'email'
          });
        }
      }
    });
  });

  return deadlines.slice(0, 3); // Limit to 3 deadlines per email
}

/**
 * Parses a date string into a Date object
 * @param {string} dateStr - Date string to parse
 * @param {string} referenceDate - Reference date (email date) for relative dates
 * @returns {Date|null} Parsed date or null
 */
function parseDate(dateStr, referenceDate) {
  try {
    // Try direct parsing
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try parsing with reference date context
    const refDate = new Date(referenceDate);
    
    // Handle "Monday, 15" or "Monday 15" format
    const dayMatch = dateStr.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\d{1,2})/i);
    if (dayMatch) {
      const dayName = dayMatch[1];
      const dayNum = parseInt(dayMatch[2]);
      const targetDate = new Date(refDate);
      
      // Find next occurrence of that day
      const daysUntilTarget = (dayName === 'Monday' ? 1 : 
                              dayName === 'Tuesday' ? 2 :
                              dayName === 'Wednesday' ? 3 :
                              dayName === 'Thursday' ? 4 :
                              dayName === 'Friday' ? 5 :
                              dayName === 'Saturday' ? 6 : 0) - targetDate.getDay();
      
      targetDate.setDate(targetDate.getDate() + (daysUntilTarget < 0 ? daysUntilTarget + 7 : daysUntilTarget));
      targetDate.setDate(dayNum);
      return targetDate;
    }

    // Handle MM/DD or MM/DD/YYYY format
    const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (slashMatch) {
      const month = parseInt(slashMatch[1]) - 1;
      const day = parseInt(slashMatch[2]);
      const year = slashMatch[3] ? parseInt(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]) : refDate.getFullYear();
      
      const date = new Date(year, month, day);
      // If date is in the past and no year specified, assume next year
      if (!slashMatch[3] && date < refDate) {
        date.setFullYear(year + 1);
      }
      return date;
    }

    return null;
  } catch (error) {
    console.error('Error parsing date:', dateStr, error);
    return null;
  }
}

/**
 * Calculates importance score for a task (1-5, 5 being most important)
 * @param {string} subject - Email subject
 * @param {string} body - Email body
 * @param {string} taskText - Task text
 * @returns {number} Importance score
 */
function calculateImportance(subject, body, taskText) {
  const text = `${subject} ${body} ${taskText}`.toLowerCase();
  let score = 3; // Default importance

  // Increase importance for urgent keywords
  if (/urgent|asap|immediately|important|critical/i.test(text)) score += 1;
  if (/deadline|due|homework|assignment/i.test(text)) score += 1;
  if (/exam|test|quiz|final/i.test(text)) score += 1;
  if (/today|tomorrow|this week/i.test(text)) score += 1;

  // Decrease importance for casual keywords
  if (/optional|if you want|whenever/i.test(text)) score -= 1;

  return Math.max(1, Math.min(5, score));
}

