const https = require('https');
const fs = require('fs');
const path = require('path');

// Try to load .env file
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        process.env[match[1]] = match[2].trim();
      }
    });
  }
} catch (e) {
  console.log('Could not load .env file');
}

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('Error: BOT_TOKEN is not defined in .env file or environment variables.');
  console.log('Usage: node check-webhook.js');
  process.exit(1);
}

const url = `https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`;

console.log(`Checking webhook status for token ending in ...${BOT_TOKEN.slice(-5)}`);

https.get(url, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const parsedData = JSON.parse(data);
      console.log('Response from Telegram:');
      console.log(JSON.stringify(parsedData, null, 2));
    } catch (e) {
      console.error('Error parsing response:', e);
      console.log('Raw response:', data);
    }
  });

}).on('error', (err) => {
  console.error('Error making request:', err.message);
});
