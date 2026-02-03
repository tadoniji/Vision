const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../data/last.log');

// Ensure directory exists
const dir = path.dirname(LOG_FILE);
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

// Clear log on startup
fs.writeFileSync(LOG_FILE, `--- Log started at ${new Date().toISOString()} ---
`);

function formatMessage(level, args) {
    const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ');
    return `[${new Date().toISOString()}] [${level}] ${msg}
`;
}

const originalLog = console.log;
const originalError = console.error;

console.log = function(...args) {
    const msg = formatMessage('INFO', args);
    fs.appendFileSync(LOG_FILE, msg);
    originalLog.apply(console, args);
};

console.error = function(...args) {
    const msg = formatMessage('ERROR', args);
    fs.appendFileSync(LOG_FILE, msg);
    originalError.apply(console, args);
};

module.exports = {
    logPath: LOG_FILE
};

