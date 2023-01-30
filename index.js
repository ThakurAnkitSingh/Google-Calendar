// First, create a project on Google Cloud and setup the credentials and google consent thing.
//  After that, the value of API_KEY, CLIENT_ID, REDIRECT_URL, and CLIENT_SECRET, these all secrets you will keep in .env file




import dotenv from 'dotenv';

dotenv.config({});

import express from 'express';
import { google } from 'googleapis';
import dayjs from 'dayjs';
import { v4 as uuid } from 'uuid';


const app = express();

const PORT = process.env.NODE_ENV || 8000

const calendar = google.calendar({
    version: "v3",
    auth: process.env.API_KEY
})
const oauth2Client = new google.auth.OAuth2(
    // Auth setup for us
    process.env.CLIENT_ID,
    process.env.CLIENT_SECRET,
    process.env.REDIRECT_URL
)


const scopes = [
    'https://www.googleapis.com/auth/calendar'
]


app.get('/rest/v1/calendar/init/', (req, res) => {
    // If user want to  redirect the user to another place an dwe have created the google project on google cloud and set the credientials and addind scope and etc.
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        // include_granted_scopes: true
        // we are generating URL and we are getting the permission from google 
    })
    // we will redirecting the user to this url
    res.redirect(url);
})

app.get('/rest/v1/calendar/redirect/', async (req, res) => {
    // URL header have our token
    const code = req.query.code; // user token

    // This will provide an object with the access_token and refresh_token.
    // Save these somewhere safe so they can be used at a later time.
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens);
    // we done the client credentials


    res.send({
        msg: "YOu have successfully logged in"
    });
})


// Bonus Feature for scheduling an event and google meet

app.get('/schedule_event', async (req, res) => {
    // we are inserting the events and setting up all the events, time, summary about the events
    await calendar.events.insert({
        calendarId: 'primary',
        auth: oauth2Client,
        requestBody: {
            summary: 'This is a schedule event',
            description: 'This is a interview meeting',
            start: {
                // daysjs module for date
                dateTime: dayjs(new Date()).add(1, 'day').toISOString(),
                timeZone: 'Asia/Kolkata'
            },
            end: {
                dateTime: dayjs(new Date()).add(1, 'day').add(1, 'hour').toISOString(),
                timeZone: 'Asia/Kolkata'
            },
            // for google meet
            conferenceData: {
                createRequest: {
                    requestId: uuid(),
                }
            },
            attendees: [
                {
                    // email: 'There will be a client email or gmail id',
                },
            ]
        }
    });

    res.send({
        msg: "Done!"
    })
})






app.listen(PORT, () => {
    console.log("Server started on port", PORT)
})