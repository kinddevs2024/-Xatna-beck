#!/usr/bin/env node

/**
 * Telegram Bot Setup Verification Script
 * Verifies that your Telegram bot is properly configured and accessible
 */

const http = require('http');
const https = require('https');

const args = process.argv.slice(2);
const baseUrl = args[0] || 'http://localhost:3000';
const botToken = args[1] || process.env.BOT_TOKEN;

console.log('\n🔍 Telegram Bot Configuration Verification\n');
console.log('📍 Base URL:', baseUrl);
console.log('🔑 BOT_TOKEN:', botToken ? `${botToken.substring(0, 10)}...` : '❌ NOT SET');
console.log('---\n');

const makeRequest = (url) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    client.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ data: JSON.parse(data), status: res.statusCode });
        } catch (e) {
          resolve({ data, status: res.statusCode });
        }
      });
    }).on('error', reject);
  });
};

const tests = [
  {
    name: 'Telegram Status Check',
    url: `${baseUrl}/api/telegram/status`,
    expect: (data) => data.initialized !== undefined
  },
  {
    name: 'Telegram Start',
    url: `${baseUrl}/api/telegram/start`,
    expect: (data) => data.status !== undefined
  },
  {
    name: 'Server Init',
    url: `${baseUrl}/api/init`,
    method: 'POST',
    expect: (data) => data.message !== undefined
  }
];

const makePostRequest = (url) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const options = {
      ...urlObj,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': 0
      }
    };

    client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ data: JSON.parse(data), status: res.statusCode });
        } catch (e) {
          resolve({ data, status: res.statusCode });
        }
      });
    }).on('error', reject).end();
  });
};

const runTests = async () => {
  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      console.log(`⏳ Testing: ${test.name}...`);
      
      const result = test.method === 'POST' 
        ? await makePostRequest(test.url)
        : await makeRequest(test.url);
      
      const dataValid = result.status >= 200 && result.status < 300;
      const formatValid = test.expect(result.data);
      
      if (dataValid && formatValid) {
        console.log(`✅ PASS - Status: ${result.status}`);
        if (result.data.initialized !== undefined) {
          console.log(`   → Bot Status: ${result.data.initialized ? '🟢 RUNNING' : '🔴 STOPPED'}`);
        }
        passed++;
      } else {
        console.log(`❌ FAIL - Status: ${result.status}`);
        if (result.data.error) {
          console.log(`   → Error: ${result.data.error}`);
        }
        failed++;
      }
    } catch (error) {
      console.log(`❌ FAIL - ${error.message}`);
      failed++;
    }
    console.log('');
  }

  console.log(`📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed === 0) {
    console.log('✅ All tests passed! Your Telegram bot is properly configured.\n');
    
    if (botToken) {
      console.log('📝 Next steps:');
      console.log('1. Start your server: npm run dev');
      console.log('2. Test the bot: Send /start to @your_bot_username');
      console.log('3. Keep the bot alive: node keep-bot-alive.js http://localhost:3000\n');
    } else {
      console.log('⚠️  WARNING: BOT_TOKEN not found in environment variables');
      console.log('   Add BOT_TOKEN to your .env file to enable Telegram bot\n');
    }
  } else {
    console.log('❌ Some tests failed. Check your configuration.\n');
    console.log('📝 Troubleshooting:');
    console.log('1. Ensure server is running: npm run dev');
    console.log('2. Check .env file has BOT_TOKEN');
    console.log('3. Verify BOT_TOKEN is valid at https://api.telegram.org/botYOUR_TOKEN/getMe');
    console.log('4. Check server logs for [Telegram Bot] messages\n');
  }

  process.exit(failed > 0 ? 1 : 0);
};

runTests().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
