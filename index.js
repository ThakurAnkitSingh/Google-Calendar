import dotenv from 'dotenv';
import express from 'express';
import { google } from 'googleapis';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json()); // Add JSON body parser

const PORT = process.env.PORT || 8000;

// Initialize Google Calendar API
const calendar = google.calendar({
    version: "v3",
    auth: process.env.API_KEY
});

// Setup OAuth2 client
const oauth2Client = new google.auth.OAuth2(
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
);

const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
];

// Store tokens temporarily (in production, use a database)
const tokens = new Map();

// Initialize OAuth flow
app.get('/rest/v1/calendar/init/', (req, res) => {
    try {
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        });
        res.redirect(url);
    } catch (error) {
        res.status(500).json({ error: 'Failed to initialize OAuth flow' });
    }
});

// Handle OAuth callback
app.get('/rest/v1/calendar/redirect/', async (req, res) => {
    try {
        const { code } = req.query;
        const { tokens: userTokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(userTokens);
        tokens.set('user', userTokens); // Store tokens (use proper storage in production)
        
        res.json({
            success: true,
            message: "Successfully authenticated"
        });
    } catch (error) {
        res.status(500).json({ error: 'Authentication failed' });
    }
});

// Get list of upcoming events
app.get('/events', async (req, res) => {
    try {
        const response = await calendar.events.list({
            auth: oauth2Client,
            calendarId: 'primary',
            timeMin: (new Date()).toISOString(),
            maxResults: 10,
            singleEvents: true,
            orderBy: 'startTime',
        });
        res.json(response.data.items);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// Schedule a new event
app.post('/schedule_event', async (req, res) => {
    try {
        const {
            summary = 'New Meeting',
            description = '',
            startTime = dayjs().add(1, 'day'),
            duration = 60,
            attendees = [],
            timeZone = 'Asia/Kolkata'
        } = req.body;

        const event = await calendar.events.insert({
            auth: oauth2Client,
            calendarId: 'primary',
            requestBody: {
                summary,
                description,
                start: {
                    dateTime: dayjs(startTime).toISOString(),
                    timeZone
                },
                end: {
                    dateTime: dayjs(startTime).add(duration, 'minute').toISOString(),
                    timeZone
                },
                conferenceData: {
                    createRequest: {
                        requestId: uuid(),
                        conferenceSolutionKey: { type: 'hangoutsMeet' }
                    }
                },
                attendees: attendees.map(email => ({ email })),
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 24 * 60 },
                        { method: 'popup', minutes: 30 }
                    ]
                },
                guestsCanModify: true,
                guestsCanInviteOthers: true
            },
            conferenceDataVersion: 1
        });

        res.json({
            success: true,
            eventId: event.data.id,
            meetLink: event.data.conferenceData?.entryPoints?.[0]?.uri,
            htmlLink: event.data.htmlLink
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Failed to schedule event',
            details: error.message 
        });
    }
});

// Delete an event
app.delete('/events/:eventId', async (req, res) => {
    try {
        await calendar.events.delete({
            auth: oauth2Client,
            calendarId: 'primary',
            eventId: req.params.eventId
        });
        res.json({ success: true, message: 'Event deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete event' });
    }
});

// Update an event
app.patch('/events/:eventId', async (req, res) => {
    try {
        const event = await calendar.events.patch({
            auth: oauth2Client,
            calendarId: 'primary',
            eventId: req.params.eventId,
            requestBody: req.body
        });
        res.json(event.data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update event' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});