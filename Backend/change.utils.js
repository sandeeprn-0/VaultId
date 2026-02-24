// change.utils.js

function calculateChanges(lastLog, currentData) {
    let timeGap = 0;
    let ipChange = 0;
    let deviceChange = 0;
    let locationChange = 0;

    if (lastLog) {
        // Time gap in seconds
        timeGap = (Date.now() - lastLog.timestamp.getTime()) / 1000;

        // IP change
        if (lastLog.ip !== currentData.ip) {
            ipChange = 1;
        }

        // Device change
        if (lastLog.device !== currentData.device) {
            deviceChange = 1;
        }

        // Location change (country or region)
        if (
            lastLog.country !== currentData.country ||
            lastLog.region !== currentData.region
        ) {
            locationChange = 1;
        }
    }

    return {
        timeGap,
        ipChange,
        deviceChange,
        locationChange
    };
}

module.exports = calculateChanges;
