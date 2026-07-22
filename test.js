const assert = require('assert');

// Helper to reload config.js with different environment variables
function loadConfig(env) {
    // Clear require cache for config.js
    delete require.cache[require.resolve('./config')];
    
    // Set environment variables
    process.env.COOKIES = "dummy_cookies";
    if (env.PREFERRED_SLOTS !== undefined) {
        process.env.PREFERRED_SLOTS = env.PREFERRED_SLOTS;
    } else {
        // Set to empty string rather than delete: dotenv.config() only fills in
        // variables that are unset, so deleting it lets a real .env file's
        // PREFERRED_SLOTS leak back in and override this "unset" test case.
        process.env.PREFERRED_SLOTS = '';
    }
    
    return require('./config');
}

function resolveSlotsForDay(preferredSlotsConfig, date) {
    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
    
    let preferredSlotsForDay;
    if (preferredSlotsConfig && !Array.isArray(preferredSlotsConfig) && typeof preferredSlotsConfig === 'object') {
        preferredSlotsForDay = preferredSlotsConfig[dayOfWeek];
        if (!preferredSlotsForDay) {
            preferredSlotsForDay = preferredSlotsConfig['default'] || preferredSlotsConfig['any'] || ['09:00:00'];
        }
    } else {
        preferredSlotsForDay = preferredSlotsConfig;
    }
    return { dayOfWeek, preferredSlotsForDay };
}

// Save original env
const originalEnv = { ...process.env };

try {
    console.log("Running Preferred Slots Tests...\n");

    // Test Case 1: Simple comma-separated list
    {
        const config = loadConfig({ PREFERRED_SLOTS: "07:00:00,08:00:00" });
        assert.deepStrictEqual(config.preferredSlots, ["07:00:00", "08:00:00"]);
        
        // Resolve for any day
        const res = resolveSlotsForDay(config.preferredSlots, "2026-07-22"); // Wednesday
        assert.strictEqual(res.dayOfWeek, "wednesday");
        assert.deepStrictEqual(res.preferredSlotsForDay, ["07:00:00", "08:00:00"]);
        console.log("✅ Test 1 Passed: Simple comma-separated list parsed and resolved correctly.");
    }

    // Test Case 2: JSON map with day-specific slots
    {
        const config = loadConfig({
            PREFERRED_SLOTS: '{"monday":["06:00:00"],"wednesday":["07:00:00","08:00:00"],"default":["09:00:00"]}'
        });
        
        assert.deepStrictEqual(config.preferredSlots, {
            monday: ["06:00:00"],
            wednesday: ["07:00:00", "08:00:00"],
            default: ["09:00:00"]
        });

        // Resolve for Wednesday (2026-07-22)
        const resWed = resolveSlotsForDay(config.preferredSlots, "2026-07-22");
        assert.strictEqual(resWed.dayOfWeek, "wednesday");
        assert.deepStrictEqual(resWed.preferredSlotsForDay, ["07:00:00", "08:00:00"]);

        // Resolve for Monday (2026-07-20)
        const resMon = resolveSlotsForDay(config.preferredSlots, "2026-07-20");
        assert.strictEqual(resMon.dayOfWeek, "monday");
        assert.deepStrictEqual(resMon.preferredSlotsForDay, ["06:00:00"]);

        // Resolve for Sunday (2026-07-19) - falls back to default
        const resSun = resolveSlotsForDay(config.preferredSlots, "2026-07-19");
        assert.strictEqual(resSun.dayOfWeek, "sunday");
        assert.deepStrictEqual(resSun.preferredSlotsForDay, ["09:00:00"]);

        console.log("✅ Test 2 Passed: Day-specific JSON config parsed and resolved correctly (including fallbacks).");
    }

    // Test Case 3: Invalid JSON fallback to comma-separated split
    {
        const config = loadConfig({ PREFERRED_SLOTS: '{"monday": invalid_json,extra_value' });
        // It should fallback to splitting by comma
        assert.deepStrictEqual(config.preferredSlots, ['{"monday": invalid_json', 'extra_value']);
        console.log("✅ Test 3 Passed: Invalid JSON falls back to splitting by comma correctly.");
    }

    // Test Case 4: Default fallback when PREFERRED_SLOTS is not provided
    {
        const config = loadConfig({ PREFERRED_SLOTS: undefined });
        assert.strictEqual(config.preferredSlots, null);
        
        // index.js fallback logic
        const resolved = resolveSlotsForDay(config.preferredSlots || ["09:00:00"], "2026-07-22");
        assert.deepStrictEqual(resolved.preferredSlotsForDay, ["09:00:00"]);
        console.log("✅ Test 4 Passed: Missing PREFERRED_SLOTS falls back to default slot correctly.");
    }

    console.log("\n🎉 All tests passed successfully!");

} catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
} finally {
    // Restore original env
    process.env = originalEnv;
}
