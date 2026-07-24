"use strict";
const config = require('./config');
const { attemptBooking } = require('./index');

const TIMEZONE = config.timezone || 'Asia/Kolkata';
const WINDOW_START = process.env.WINDOW_START || '21:56:00';
const WINDOW_END = process.env.WINDOW_END || '22:05:00';
const RETRY_INTERVAL_MS = (parseInt(process.env.RETRY_INTERVAL_SECONDS, 10) || 5) * 1000;

// Booking should stop retrying for the day once one of these outcomes is reached.
const TERMINAL_STATUSES = ['BOOKED', 'ALREADY_BOOKED', 'WAITLISTED'];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Builds today's date at HH:MM:SS in `timezone` as a real Date/instant,
// by reading today's Y-M-D and the zone's current UTC offset and combining them into an ISO string.
function todayAt(timeStr, timezone) {
    const now = new Date();

    const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(now);
    const y = dateParts.find(p => p.type === 'year').value;
    const m = dateParts.find(p => p.type === 'month').value;
    const d = dateParts.find(p => p.type === 'day').value;

    const offsetParts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'longOffset'
    }).formatToParts(now);
    const offset = offsetParts.find(p => p.type === 'timeZoneName').value.replace('GMT', '') || '+00:00';

    return new Date(`${y}-${m}-${d}T${timeStr}${offset}`);
}

async function run() {
    const windowStart = todayAt(WINDOW_START, TIMEZONE);
    const windowEnd = todayAt(WINDOW_END, TIMEZONE);

    console.log(`Booking window: ${WINDOW_START} - ${WINDOW_END} (${TIMEZONE})`);

    const untilWindowStart = windowStart.getTime() - Date.now();
    if (untilWindowStart > 0) {
        console.log(`Waiting ${Math.round(untilWindowStart / 1000)}s for window to open...`);
        await sleep(untilWindowStart);
    }

    let attempt = 0;
    while (true) {
        // Anchor each attempt to windowStart + attempt*interval (absolute time) rather than
        // chaining relative sleeps, so per-attempt network latency can't accumulate drift.
        const scheduledTime = windowStart.getTime() + attempt * RETRY_INTERVAL_MS;
        if (scheduledTime > windowEnd.getTime()) {
            break;
        }

        const waitMs = scheduledTime - Date.now();
        if (waitMs > 0) {
            await sleep(waitMs);
        }

        attempt++;
        console.log(`\n--- Attempt ${attempt} at ${new Date().toISOString()} (target ${new Date(scheduledTime).toISOString()}) ---`);

        const status = await attemptBooking();

        if (TERMINAL_STATUSES.includes(status)) {
            console.log(`Stopping retry loop (status: ${status}).`);
            return;
        }
    }

    console.log('Booking window closed without securing a class or waitlist spot.');
}

run();
