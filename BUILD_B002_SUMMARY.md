# Build B-002 Summary: Connect Email and Calendar

## ✅ Completed Features

### F-002: Read Emails
- ✅ Gmail API integration to fetch emails
- ✅ Email parsing to extract tasks and deadlines
- ✅ Pattern matching for homework, assignments, projects
- ✅ Date extraction from email content
- ✅ Importance scoring for tasks (1-5 scale)
- ✅ Error handling with "Could not read your email." message
- ✅ Handles unread emails, emails with attachments, and keyword-based filtering

### F-003: Read Calendar
- ✅ Google Calendar API integration to fetch events
- ✅ Free time slot detection (finds gaps longer than 10 minutes)
- ✅ Next break detection with "starting soon" alerts
- ✅ Event parsing and formatting
- ✅ Error handling with "Could not read your calendar." message
- ✅ Checks calendar every few minutes (via refresh functionality)

## 📁 Files Created

### Backend

1. **`backend/middleware/auth.js`**
   - JWT authentication middleware
   - Extracts user from token and attaches to request
   - Handles token expiration and validation

2. **`backend/services/gmailService.js`**
   - `fetchEmails()` - Fetches emails from Gmail API
   - `parseEmail()` - Parses email data to extract information
   - `extractTasks()` - Extracts tasks from email content
   - `extractDeadlines()` - Extracts deadlines from email content
   - `parseDate()` - Parses various date formats
   - `calculateImportance()` - Calculates task importance score

3. **`backend/services/calendarService.js`**
   - `fetchCalendarEvents()` - Fetches calendar events
   - `findFreeTimeSlots()` - Finds free time between classes/events
   - `getNextBreak()` - Gets the next available break
   - `parseEvent()` - Parses calendar event data

4. **`backend/routes/email.js`**
   - `GET /api/email` - Fetches emails and extracts tasks/deadlines
   - Requires authentication
   - Returns tasks, deadlines, and email count

5. **`backend/routes/calendar.js`**
   - `GET /api/calendar/events` - Fetches calendar events
   - `GET /api/calendar/free-time` - Finds free time slots
   - `GET /api/calendar/next-break` - Gets next break
   - Requires authentication
   - Returns events and free time slots

### Frontend

6. **Updated `frontend/src/pages/Dashboard.jsx`**
   - Fetches emails on component mount
   - Fetches next break from calendar
   - Displays tasks, deadlines, and next break
   - Loading states and error handling
   - Refresh functionality

7. **Updated `frontend/src/pages/Dashboard.css`**
   - Styling for dashboard sections
   - Task and deadline card styling
   - Stats grid layout
   - Responsive design

## 🔌 API Endpoints

### Email Endpoints

**GET `/api/email`**
- **Auth:** Required (JWT token)
- **Response:**
  ```json
  {
    "success": true,
    "emailCount": 15,
    "tasks": [...],
    "deadlines": [...],
    "emails": [...]
  }
  ```

### Calendar Endpoints

**GET `/api/calendar/events`**
- **Auth:** Required (JWT token)
- **Query params:** `startDate`, `endDate` (optional)
- **Response:**
  ```json
  {
    "success": true,
    "eventCount": 10,
    "events": [...]
  }
  ```

**GET `/api/calendar/free-time`**
- **Auth:** Required (JWT token)
- **Query params:** `startDate`, `endDate`, `minDuration` (optional, default: 10)
- **Response:**
  ```json
  {
    "success": true,
    "slotCount": 5,
    "freeTimeSlots": [...]
  }
  ```

**GET `/api/calendar/next-break`**
- **Auth:** Required (JWT token)
- **Response:**
  ```json
  {
    "success": true,
    "hasBreak": true,
    "nextBreak": {
      "start": "2024-01-15T10:00:00Z",
      "end": "2024-01-15T11:30:00Z",
      "durationMinutes": 90,
      "isStartingSoon": true,
      "minutesUntilStart": 5
    }
  }
  ```

## 🎯 Task Extraction Logic

The email parsing looks for:
- Keywords: "homework", "assignment", "project", "task", "todo"
- Action verbs: "complete", "submit", "finish", "do", "work on"
- Deadline indicators: "due", "deadline", "submit by", "turn in by"
- Date patterns: MM/DD, MM/DD/YYYY, "Monday, 15", etc.

## ⏰ Free Time Detection

Free time slots are found by:
1. Fetching all calendar events for the next 7 days
2. Identifying gaps between consecutive events
3. Filtering gaps longer than 10 minutes (configurable)
4. Checking between 8 AM - 10 PM each day
5. Excluding past time slots

## 🔒 Security & Error Handling

- ✅ JWT token authentication required for all endpoints
- ✅ Access token validation (checks if user has valid token)
- ✅ Provider check (currently only Google supported)
- ✅ Specific error messages:
  - "Could not read your email." (for email errors)
  - "Could not read your calendar." (for calendar errors)
  - Token expiration handling
  - Permission error handling

## 📊 Data Flow

1. User logs in → Access token stored in database
2. Dashboard loads → Frontend requests emails and calendar
3. Backend authenticates request → Gets user from JWT
4. Backend fetches from Gmail/Calendar APIs → Uses stored access token
5. Backend parses data → Extracts tasks, deadlines, free time
6. Frontend displays results → Shows tasks, deadlines, next break

## 🔄 Refresh Mechanism

- Dashboard has a "Refresh" button
- Automatically fetches on component mount
- Can be extended to poll every few minutes (currently manual refresh)

## 🚀 Next Steps (B-003, B-004, etc.)

- **B-003**: Create task list (F-004, D-002) - Combine email tasks with user-created tasks
- **B-004**: Build dashboard (S-002) - Enhance dashboard with full task list
- **B-005**: Add break reminders (F-005, S-003) - Notify when break starts
- **B-006**: Add task completion flow (F-006, S-005, D-004)
- **B-007**: Add custom tasks (F-007, S-004, D-005)

## ⚠️ Known Limitations

1. **Email parsing** - Currently uses regex patterns; may miss some edge cases
2. **Date parsing** - Some date formats may not be recognized
3. **Calendar** - Only checks primary calendar (not secondary calendars)
4. **Provider support** - Currently only Google OAuth supported (Microsoft can be added later)
5. **Token refresh** - Access tokens expire; need to implement refresh token flow for production

## 📝 Testing Checklist

- [ ] Login with Google OAuth
- [ ] Dashboard loads and shows loading state
- [ ] Emails are fetched and parsed correctly
- [ ] Tasks are extracted from emails
- [ ] Deadlines are extracted from emails
- [ ] Calendar events are fetched
- [ ] Free time slots are calculated correctly
- [ ] Next break is displayed
- [ ] Error handling works (expired token, no permission, etc.)
- [ ] Refresh button works
- [ ] Dashboard shows stats correctly

## 🛠️ Required OAuth Scopes

Make sure these scopes are requested during login:
- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/calendar`
- `profile`
- `email`

These are already configured in `backend/config/passport.js` for Google OAuth.

