import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

// Initialize Gemini API client
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
} else {
  console.warn('⚠️ Gemini API key not found. Task extraction will use regex patterns only.');
}

/**
 * Fetches emails from Gmail API
 * @param {string} accessToken - Google OAuth access token
 * @param {number} maxResults - Maximum number of emails to fetch (default: 100)
 * @returns {Promise<Array>} Array of email objects
 */
export async function fetchEmails(accessToken, maxResults = 100) {
  try {
    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0].replace(/-/g, '/'); // Format: YYYY/MM/DD for Gmail API
    
    // First, get list of message IDs (only emails from past 30 days)
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=after:${dateStr} AND (is:unread OR has:attachment OR subject:homework OR subject:assignment OR subject:deadline OR subject:due)`,
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

    // Fetch full details for each message (including thread ID)
    const emailPromises = messageIds.slice(0, 100).map(async (message) => {
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
          // Only log non-404 errors (404 means message was deleted/moved, which is normal)
          if (messageResponse.status !== 404) {
            let errorDetails = '';
            try {
              const errorText = await messageResponse.text();
              errorDetails = errorText.substring(0, 200);
            } catch (e) {
              // Ignore if we can't read error text
            }
            console.error(`Failed to fetch message ${message.id}: ${messageResponse.status} ${messageResponse.statusText}`);
            if (messageResponse.status === 401 || messageResponse.status === 403) {
              // Auth errors are more serious - log the error details
              if (errorDetails) {
                console.error('Gmail API auth error details:', errorDetails);
              }
            }
          }
          return null;
        }

        const messageData = await messageResponse.json();
        
        // Extract headers for filtering
        const headers = messageData.payload.headers || [];
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        const subject = getHeader('subject');
        const from = getHeader('from');
        
        // Extract truncated body for quick relevance check
        const truncatedBody = extractTruncatedBody(messageData, 800);
        
        // Filter email before parsing (saves API calls if not relevant)
        const shouldProcess = await shouldProcessEmail(subject, from, truncatedBody);
        if (!shouldProcess) {
          return null; // Skip this email - not relevant for task extraction
        }
        
        return parseEmail(messageData);
      } catch (error) {
        console.error(`Error fetching message ${message.id}:`, error);
        return null;
      }
    });

    const emails = await Promise.all(emailPromises);
    const validEmails = emails.filter(email => email !== null);
    
    return validEmails;
  } catch (error) {
    console.error('Error fetching emails:', error);
    throw error;
  }
}

/**
 * Extracts truncated body text from email message data for quick filtering
 * @param {Object} messageData - Raw message data from Gmail API
 * @param {number} maxLength - Maximum length of body to extract (default: 800)
 * @returns {string} Truncated email body text
 */
function extractTruncatedBody(messageData, maxLength = 800) {
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
  
  // Truncate to maxLength
  if (bodyText.length > maxLength) {
    bodyText = bodyText.substring(0, maxLength) + '...';
  }
  
  return bodyText.trim();
}

/**
 * Determines if an email should be processed for task extraction using Gemini API
 * @param {string} subject - Email subject
 * @param {string} from - Email sender
 * @param {string} bodyText - Email body text (truncated)
 * @returns {Promise<boolean>} True if email should be processed, false otherwise
 */
async function shouldProcessEmail(subject, from, bodyText) {
  // If Gemini API is not available, process all emails (safe fallback)
  if (!genAI) {
    return true;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
    
    // Truncate further if needed for the prompt
    const truncatedBody = bodyText.length > 800 ? bodyText.substring(0, 800) + '...' : bodyText;
    
    const prompt = `Analyze this email and determine if it contains actionable tasks that should be processed.

Subject: ${subject}
From: ${from}
Body: ${truncatedBody}

Does this email contain:
- Assignments or homework
- Application deadlines
- Tasks that need to be completed
- Important deadlines
- Action items

If spam, marketing, promotional, newsletters, or purely informational with no tasks, return {"relevant": false}
If the email contains actionable tasks, assignments, deadlines, or items requiring action, return {"relevant": true}

Return ONLY a JSON object: {"relevant": true/false}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('Gemini API response:', text);
    
    // Extract JSON from response (might have markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    const resultObj = JSON.parse(jsonText);
    
    // Validate response
    if (typeof resultObj.relevant === 'boolean') {
      return resultObj.relevant;
    }
    
    // If response format is invalid, default to processing (safe fallback)
    console.warn('Invalid response format from Gemini email filter, defaulting to process email');
    return true;
  } catch (error) {
    // Log error but default to processing email (safe fallback)
    console.error('Error using Gemini API for email filtering, defaulting to process email:', error.message);
    return true;
  }
}

/**
 * Parses a Gmail message to extract relevant information
 * @param {Object} messageData - Raw message data from Gmail API
 * @returns {Promise<Object>} Parsed email object with task information
 */
async function parseEmail(messageData) {
  const headers = messageData.payload.headers || [];
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const subject = getHeader('subject');
  const from = getHeader('from');
  const date = getHeader('date');
  const messageId = messageData.id;
  const threadId = messageData.threadId; // Get thread ID to group email chains

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

  // Extract tasks with deadlines (tasks now include deadlines from Gemini)
  const tasks = await extractTasks(subject, bodyText, date);

  return {
    id: messageId,
    threadId: threadId, // Include thread ID for grouping
    subject,
    from,
    date: new Date(date),
    body: bodyText.substring(0, 500), // First 500 chars
    tasks,
    deadlines: [], // Keep for backward compatibility, but tasks now include deadlines
    hasAttachment: messageData.payload.parts?.some(part => part.filename && part.filename.length > 0) || false
  };
}

/**
 * Extracts tasks from email subject and body using Gemini API
 * Falls back to regex patterns if Gemini API is unavailable
 * @param {string} subject - Email subject
 * @param {string} body - Email body text
 * @param {string} emailDate - Email date string (for deadline parsing)
 * @returns {Promise<Array>} Array of task objects with deadlines
 */
async function extractTasks(subject, body, emailDate) {
  // Try using Gemini API first if available
  if (genAI) {
    try {
      return await extractTasksWithGemini(subject, body, emailDate);
    } catch (error) {
      console.error('Error using Gemini API for task extraction, falling back to regex:', error.message);
      // Fall through to regex extraction
    }
  }

  // Fallback to regex-based extraction
  const tasks = extractTasksWithRegex(subject, body);
  // Add deadlines from regex extraction for fallback
  const deadlines = extractDeadlines(subject, body, emailDate);
  if (deadlines.length > 0 && tasks.length > 0) {
    tasks[0].dueDate = deadlines[0].date;
  }
  // Add time estimates for regex-extracted tasks
  tasks.forEach(task => {
    if (!task.estimatedMinutes) {
      task.estimatedMinutes = estimateTaskTime(task.text, subject, body);
    }
  });
  return tasks;
}

/**
 * Extracts tasks using Gemini API with deadlines
 * @param {string} subject - Email subject
 * @param {string} body - Email body text
 * @param {string} emailDate - Email date string (for deadline parsing)
 * @returns {Promise<Array>} Array of task objects with deadlines
 */
async function extractTasksWithGemini(subject, body, emailDate) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  
  // Truncate body if too long (Gemini has token limits)
  const truncatedBody = body.length > 4000 ? body.substring(0, 4000) + '...' : body;
  
  const prompt = `Analyze the following email and extract tasks that need to be completed. 

Email Subject: ${subject}

Email Body: ${truncatedBody}

Email Date: ${emailDate}

Instructions:
1. Identify all actionable tasks (assignments, applications, email replies, projects, etc.)
2. For each task, create a clear, concise summary that describes what needs to be done
3. Use action verbs like "Complete", "Submit", "Reply to", "Attend", "Prepare", etc.
4. Keep each task summary under 150 characters
5. For each task, extract the deadline/due date if mentioned in the email
6. Return ONLY a JSON array of task objects in this exact format:
[
  {"text": "Task summary here", "importance": 1-5, "dueDate": "YYYY-MM-DDTHH:mm:ss" or null, "estimatedMinutes": number (REQUIRED, must be a positive integer)},
  ...
]

IMPORTANT: estimatedMinutes is REQUIRED for every task. It must be a positive integer (number of minutes).

For estimatedMinutes (REQUIRED):
- You MUST always provide an estimate - this field is mandatory
- If uncertain, use 60 minutes as a default estimate
- Estimate how long the task will take to complete (in minutes)
- Common estimates:
  * Decision/evaluation tasks (evaluate, decide, choose): 5 minutes
  * Quick tasks (reply to email, sign form): 10-15 minutes
  * Applications (filling out forms): 30-60 minutes (simple: 30, complex: 60)
  * Homework assignments: 30-60 minutes (short: 45, regular: 60)
  * Medium assignments (essay, paper, report): 60-90 minutes
  * Large assignments (full project, exam prep): 120-180 minutes
- NEVER return null, undefined, "N/A", or any non-numeric value
- ALWAYS return a number (minimum 1, maximum 1440)
- If you cannot determine a specific estimate, return 500.

The importance should be 1 (low) to 5 (critical). Consider urgency, deadlines, and keywords like "urgent", "asap", "deadline", "due", "exam", "test", etc.


For dueDate:
- Extract the deadline date if mentioned (format as ISO 8601 string: "YYYY-MM-DDTHH:mm:ss")
- If no specific deadline is mentioned for a task, set dueDate to null
- Use the email date as reference for relative dates (e.g., "next Monday", "in 3 days")
- Only include dates in the future

If no tasks are found, return an empty array: []

Return ONLY the JSON array, no other text.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();
    
    // Extract JSON from response (might have markdown code blocks)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '').trim();
    }

    const tasks = JSON.parse(jsonText);
    
    // Validate and format tasks
    if (!Array.isArray(tasks)) {
      throw new Error('Gemini API did not return an array');
    }

    return tasks
      .filter(task => task && task.text && typeof task.text === 'string')
      .map(task => {
        let dueDate = null;
        if (task.dueDate) {
          try {
            dueDate = new Date(task.dueDate);
            // Validate date is in the future
            if (isNaN(dueDate.getTime()) || dueDate <= new Date()) {
              dueDate = null;
            }
          } catch (e) {
            dueDate = null;
          }
        }
        
        // Parse and validate estimatedMinutes
        let estimatedMinutes = null;
        if (task.estimatedMinutes !== null && task.estimatedMinutes !== undefined) {
          const parsed = parseInt(task.estimatedMinutes);
          if (!isNaN(parsed) && parsed > 0 && parsed <= 1440) { // Max 24 hours
            estimatedMinutes = parsed;
          }
        }
        
        // Fallback: estimate time if Gemini didn't provide one
        if (!estimatedMinutes) {
          estimatedMinutes = estimateTaskTime(task.text, subject, body);
        }
        
        return {
          text: task.text.substring(0, 200).trim(),
          source: 'email',
          importance: Math.max(1, Math.min(5, parseInt(task.importance) || calculateImportance(subject, body, task.text))),
          dueDate: dueDate,
          estimatedMinutes: estimatedMinutes
        };
      })
      .slice(0, 5); // Limit to 5 tasks
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error('Failed to parse Gemini API response as JSON:', error.message);
      try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const rawText = response.text();
        console.error('Raw response (first 200 chars):', rawText.substring(0, 200));
      } catch (e) {
        // Ignore errors when trying to log
      }
    }
    throw error;
  }
}

/**
 * Extracts tasks using regex patterns (fallback method)
 * @param {string} subject - Email subject
 * @param {string} body - Email body text
 * @returns {Array} Array of task objects
 */
function extractTasksWithRegex(subject, body) {
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
          importance: calculateImportance(subject, body, taskText),
          estimatedMinutes: estimateTaskTime(taskText, subject, body)
        });
      }
    });
  });

  // If no specific tasks found but email mentions homework/assignment, use subject
  if (tasks.length === 0 && (text.includes('homework') || text.includes('assignment') || text.includes('project'))) {
    tasks.push({
      text: subject,
      source: 'email',
      importance: calculateImportance(subject, body, subject),
      estimatedMinutes: estimateTaskTime(subject, subject, body)
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
    /(?:due|deadline|submit by|turn in by|by|to apply)\s+(?:on\s+)?([A-Z][a-z]+day,?\s+\d{1,2}(?:\/\d{1,2})?(?:\/\d{2,4})?)/gi,
    /(?:due|deadline|submit by|turn in by|by|to apply)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/gi,
    /(?:due|deadline|submit by|turn in by|by|to apply)\s+([A-Z][a-z]+\s+\d{1,2}(?:st|nd|rd|th)?)/gi,
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
 * Estimates time in minutes for a task based on task text and content
 * @param {string} taskText - Task text/name
 * @param {string} subject - Email subject (for context)
 * @param {string} body - Email body text (for context)
 * @returns {number} Estimated minutes
 */
function estimateTaskTime(taskText, subject = '', body = '') {
  const text = `${taskText} ${subject} ${body}`.toLowerCase();
  
  // Decision/evaluation tasks (5 minutes) - highest priority
  if (/evaluate|decide|review and decide|choose|select|approve decision/i.test(taskText)) {
    return 5;
  }
  
  // Quick tasks (reply to email, sign form): 10-15 minutes
  if (/reply to|respond to|email|message/i.test(taskText) || 
      /\b(sign|approve|confirm|acknowledge)\b/i.test(taskText)) {
    return 15;
  }
  
  // Applications and homework assignments: 30-60 minutes
  if (/application|apply|form/i.test(text)) {
    // Simple applications: 30 minutes, complex: 60 minutes
    if (/(complex|detailed|extensive|multiple)/i.test(text)) {
      return 60;
    }
    return 30;
  }
  
  if (/homework|assignment/i.test(text)) {
    // Short assignments: 45 minutes, regular: 60 minutes
    if (/(short|brief|quick|mini)/i.test(text)) {
      return 45;
    }
    return 60;
  }
  
  // Short tasks (quiz, problem set): 30-45 minutes
  if (/quiz|problem set/i.test(text)) {
    return 45;
  }
  
  // Medium tasks (essay, paper, report): 60-90 minutes
  if (/essay|paper|report/i.test(text)) {
    if (/(short|brief|mini)/i.test(text)) {
      return 60;
    }
    return 90;
  }
  
  // Large tasks (project, exam prep): 120-180 minutes
  if (/project|presentation|final|exam|test|midterm|study.*for/i.test(text)) {
    return 150;
  }
  
  // Research/reading: 90 minutes
  if (/research|read|review.*chapter|reading/i.test(text)) {
    return 90;
  }
  
  // Meetings/attend: 60 minutes
  if (/attend|join|meeting|webinar|session/i.test(text)) {
    return 60;
  }
  
  // Default: 60 minutes (1 hour)
  return 60;
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

