# Vercel Deployment Guide - MongoDB & Telegram Setup

## 🚨 Critical Issues & Fixes

### 1. MongoDB ObjectID Error

**Error:** `Malformed ObjectID: provided hex string representation must be exactly 12 bytes, instead got: "1", length 1.`

**Cause:** Code was passing simple integers (like `1`) where MongoDB expects full ObjectIDs (24 hex characters).

**Fix Applied:** ✅ Added ObjectID validation in `UserService.findOne()` to reject invalid IDs gracefully.

---

## 📋 MongoDB Atlas Setup for Vercel

### Step 1: Whitelist Vercel IPs

In MongoDB Atlas:

1. **Go to Network Access** → `Allow From Any Where (0.0.0.0/0)` 
   - ⚠️ **Only for development/testing!**
   - For production, add specific Vercel egress IPs

   OR

2. **Add Vercel IPs specifically:**
   - Vercel IPs vary, use `0.0.0.0/0` for simplicity (with firewall protection via strong credentials)

### Step 2: Verify Connection String

In `.env` on Vercel, ensure:

```
DATABASE_URL=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/dbname?retryWrites=true&w=majority&authSource=admin
```

**Critical components:**
- ✅ `username:password` - URL-encoded credentials (use your actual MongoDB username/password)
- ✅ `authSource=admin` - Specifies authentication database
- ✅ `retryWrites=true` - Handles connection issues
- ✅ `w=majority` - Write acknowledgment

### Step 3: Test Connection

```bash
# Create a simple test script
node test-db-connection.js
```

If you see `✅ Connection verified`, you're good!

---

## 🤖 Telegram Bot on Vercel/Serverless

### The Problem

Polling **does NOT work** on serverless platforms because:
- Function executes, then terminates
- Polling connection is lost
- Bot stops listening

### ✅ Solution 1: Webhooks (Recommended)

Webhooks are best for serverless.

#### Setup:

1. **Remove polling from telegram.service.ts**
   - Delete: `this.bot.startPolling();`
   - Delete: polling configuration

2. **Create webhook endpoint** (`app/api/telegram/webhook/route.ts`)

   ```typescript
   import { NextRequest, NextResponse } from 'next/server';
   import { telegramService } from '@/lib/services/telegram.service';
   
   export async function POST(request: NextRequest) {
     try {
       const body = await request.json();
       
       // Handle telegram update
       await telegramService.handleWebhookUpdate(body);
       
       return NextResponse.json({ ok: true });
     } catch (error: any) {
       console.error('Webhook error:', error);
       return NextResponse.json({ ok: false }, { status: 500 });
     }
   }
   ```

3. **Set webhook URL in Telegram:**

   ```bash
   curl -X POST https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-vercel-domain.com/api/telegram/webhook"}'
   ```

4. **Verify:**

   ```bash
   curl https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo
   ```

### ✅ Solution 2: Keep-Alive Polling (Quick Fix)

If webhooks are complex, use periodic pings:

1. **Set up cron job** to call status endpoint every 5 minutes:
   ```
   GET https://your-domain.com/api/telegram/status
   ```

2. **Or use a service** like EasyCron or Vercel Cron:
   ```json
   // vercel.json
   {
     "crons": [{
       "path": "/api/telegram/status",
       "schedule": "*/5 * * * *"
     }]
   }
   ```

---

## 🔧 Vercel Environment Setup

### In Vercel Dashboard → Settings → Environment Variables

Add:

```
DATABASE_URL=mongodb+srv://uploadhorizon_db_user:MbQ7xEgCCONqBjue@cluster0.vnygklb.mongodb.net/Xatnan1?retryWrites=true&w=majority&authSource=admin

JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long

JWT_EXPIRATION=7d

BOT_TOKEN=8122262826:AAFhT-your-bot-token-here

FRONTEND_URL=https://your-frontend-domain.com

NODE_ENV=production
```

⚠️ **Do NOT include quotes around values in Vercel!**

---

## 📊 Troubleshooting Checklist

### MongoDB Connection Fails

- [ ] Check MongoDB Atlas Network Access allows your IP
- [ ] Verify username/password are URL-encoded
  - Special chars like `@` → `%40`, `:` → `%3A`
- [ ] Test: `node test-db-connection.js`
- [ ] Check connection string matches exactly in Vercel

### Invalid ObjectID Errors

- [ ] Update `lib/services/user.service.ts` ✅ (already done)
- [ ] Restart server: `npm run build && npm start`
- [ ] Check logs for "Malformed ObjectID" warnings

### Telegram Bot Not Responding

- [ ] Check status: `curl https://your-domain.com/api/telegram/status`
- [ ] If using polling: ensure keep-alive is working
- [ ] If using webhooks: verify webhook URL is registered
- [ ] Test webhook: `curl https://api.telegram.org/botYOUR_TOKEN/getWebhookInfo`

---

## 📱 Testing After Deployment

### 1. Test Database
```bash
curl https://your-domain.com/api/users
# Should return users or auth error (not DB error)
```

### 2. Test Server Init
```bash
curl -X POST https://your-domain.com/api/init
# Should return success
```

### 3. Test Telegram Status
```bash
curl https://your-domain.com/api/telegram/status
```

### 4. Test Telegram Bot
- Send `/start` to your bot on Telegram
- Should respond with greeting

---

## 🚀 Deployment Checklist

- [ ] MongoDB Atlas whitelist Vercel IPs (0.0.0.0/0 for testing)
- [ ] DATABASE_URL in Vercel env (with authSource=admin)
- [ ] ObjectID validation in UserService ✅
- [ ] Telegram bot configured (polling OR webhooks)
- [ ] All environment variables set in Vercel
- [ ] Run `npm run build` locally - no errors
- [ ] Deploy to Vercel
- [ ] Test endpoints (see Testing section)

---

## 📞 Quick Reference

| Issue | Fix |
|-------|-----|
| `P2023` Malformed ObjectID | ✅ Fixed in UserService |
| SCRAM auth failed | Check MongoDB credentials & authSource=admin |
| Telegram not responding | Use webhooks or keep-alive polling |
| Deployment fails | Check all env vars in Vercel |

---

**After applying these fixes, your Vercel deployment should work perfectly!** 🎉
