"use strict";
const { makeAPICall, commonHeaders, CURE_FIT_HOST, GET_CLASSES_URI } = require('./index');

async function checkCookies() {
    const data = await makeAPICall({}, CURE_FIT_HOST, GET_CLASSES_URI, "GET", commonHeaders);

    if (!data || !Array.isArray(data.days)) {
        throw new Error("Unexpected response shape - cookies may be invalid");
    }

    console.log("Cookies are valid. Session check passed.");
}

checkCookies().catch(err => {
    console.error("COOKIE CHECK FAILED:", err.message);
    process.exit(1);
});
