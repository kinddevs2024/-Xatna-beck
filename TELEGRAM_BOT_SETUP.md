# Telegram Bot Setup Guide

## Overview

Your application includes a Telegram bot that listens for messages and commands. The bot connects to Telegram's servers to receive user messages in real-time.

## Local Development

### Starting the Bot

The Telegram bot will automatically start when your server starts if `BOT_TOKEN` is configured.

#### Manual Start

```bash
# Start your Next.js server
npm run dev

# In another terminal, ensure the bot is running
curl http://localhost:3000/api/telegram/start

# Check bot status
curl http://localhost:3000/api/telegram/status
```

### Troubleshooting Development Issues

If the bot is not responding:

1. **Verify BOT_TOKEN in `.env`**

   ```
   BOT_TOKEN=8303863252:AAH98Mm3FLADPWoKqpFsMYUSoyAVpYmCh0M
   ```

2. **Check bot status**

   ```bash
   curl http://localhost:3000/api/telegram/status
   ```

3. **Verify bot token is valid**

   ```bash
   curl https://api.telegram.org/bot8303863252:AAH98Mm3FLADPWoKqpFsMYUSoyAVpYmCh0M/getMe
   ```

4. **Watch server logs** for `[Telegram Bot]` messages

## Production Deployment

### Option 1: Using Polling (Simple, but resource-intensive)

If deploying to Vercel or other serverless platforms:

1. **Ensure BOT_TOKEN is set in environment variables**

   ```
   BOT_TOKEN=your_bot_token_here
   ```

2. **Call the startup endpoint when your app starts**

   ```bash
   # Add this as a post-deployment command or in your app initialization
   curl https://your-domain.com/api/telegram/start
   ```

3. **Keep the bot alive with periodic calls** (recommended)

   ```bash
   # Add a cron job or periodic task to call:
   curl https://your-domain.com/api/telegram/status
   ```

### Option 2: Using Webhooks (Recommended for Production)

Webhooks are more reliable and efficient than polling:

1. **Enable webhooks in your Telegram bot settings**

   ```bash
   curl -X POST https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook \
     -d "url=https://your-domain.com/api/telegram/webhook"
   ```

2. **Create a webhook endpoint** (if not already created)

3. **Remove polling configuration** from `telegram.service.ts`

### Option 3: Separate Worker Service

For high-traffic applications, run the bot on a separate server:

1. Create a separate Node.js service that imports the telegram service
2. Run it as a background worker
3. Configure it to receive updates via webhooks or polling

## Available Endpoints

- **GET `/api/telegram/status`** - Check if bot is running
- **GET `/api/telegram/start`** - Start/ensure bot is running
- **POST `/api/init`** - Initialize server and bot

## Common Bot Commands

Users can interact with the bot using:

- `/start` - Start the bot
- `/help` - Get help
- `/mybookings` - View their bookings
- `/book` - Create a new booking
- `/cancel` - Cancel a booking

## Monitoring

Monitor bot activity in your server logs:

```
[Telegram Bot] ✅ Bot connected: @your_bot_name (Bot Name)
[Telegram Bot] Starting polling...
✅ Telegram Bot initialized successfully with polling
```

## Troubleshooting Production Issues

### "SCRAM failure: bad auth" Error

This typically means MongoDB connection issues, not Telegram. See MongoDB setup guide.

### Bot not responding to commands

1. Check if bot is actually running: `curl https://your-domain.com/api/telegram/status`
2. Verify BOT_TOKEN is correct in production environment
3. Ensure your Firebase/security rules allow Telegram API calls
4. Check for rate limits on Telegram API

### Polling stops after some time

In serverless environments, polling may stop when functions idle. Solutions:

1. Call `/api/telegram/status` periodically (every 5 minutes)
2. Switch to webhooks instead of polling
3. Use a dedicated worker service for the bot

## Configuration

Edit `lib/services/telegram.service.ts` to:

- Change polling interval: `interval: 1000` (milliseconds)
- Change timeout: `timeout: 30` (seconds)
- Add more commands in `setupHandlers()`
- Modify command responses in handler methods

## Security Notes

⚠️ **Important:**

- Never commit `.env` with real BOT_TOKEN to Git
- Keep BOT_TOKEN private - it controls your bot
- Validate all user input from Telegram
- Rate limit command processing to prevent abuse
