#!/usr/bin/env node

/**
 * Keep Telegram Bot Alive Script
 * 
 * This script periodically pings the Telegram bot to keep it polling
 * Usage:
 *   node keep-bot-alive.js http://localhost:3000
 *   node keep-bot-alive.js https://your-domain.com
 */

const http = require('http');
const https = require('https');

const baseUrl = process.argv[2] || 'http://localhost:3000';
const interval = 5 * 60 * 1000; // 5 minutes
const statusInterval = 30 * 1000; // 30 seconds for status checks

console.log(`🤖 Telegram Bot Keep-Alive Script`);
console.log(`📍 Base URL: ${baseUrl}`);
console.log(`⏱️  Interval: ${interval / 1000 / 60} minutes`);
console.log(`⏱️  Status check: every ${statusInterval / 1000} seconds`);
console.log('---');

const makeRequest = (url, callback) => {
  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;

  client.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        callback(null, JSON.parse(data), res.statusCode);
      } catch (e) {
        callback(null, data, res.statusCode);
      }
    });
  }).on('error', callback);
};

const ensureBotRunning = () => {
  const url = `${baseUrl}/api/telegram/start`;
  console.log(`[${new Date().toISOString()}] 🚀 Starting bot...`);
  
  makeRequest(url, (err, data, status) => {
    if (err) {
      console.error(`[${new Date().toISOString()}] ❌ Error:`, err.message);
      return;
    }
    
    if (status === 200 || status === 202) {
      console.log(`[${new Date().toISOString()}] ✅ Status: ${data.status || 'ok'}`);
    } else {
      console.error(`[${new Date().toISOString()}] ❌ Failed (${status}):`, data.message);
    }
  });
};

const checkBotStatus = () => {
  const url = `${baseUrl}/api/telegram/status`;
  
  makeRequest(url, (err, data, status) => {
    if (err) {
      console.error(`[${new Date().toISOString()}] 📊 Status Check: Error -`, err.message);
      return;
    }
    
    if (data.initialized) {
      console.log(`[${new Date().toISOString()}] 📊 Status Check: ✅ Bot is running`);
    } else {
      console.log(`[${new Date().toISOString()}] 📊 Status Check: ⚠️ Bot is inactive`);
    }
  });
};

// Check status frequently
setInterval(checkBotStatus, statusInterval);

// Ensure bot is running less frequently
setInterval(ensureBotRunning, interval);

// Initial start
ensureBotRunning();

console.log('✅ Keep-alive script started. Press Ctrl+C to stop.\n');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down keep-alive script...');
  process.exit(0);
});
