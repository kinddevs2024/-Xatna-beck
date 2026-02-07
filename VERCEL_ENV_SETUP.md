# Vercel Environment Variables - Copy & Paste Format

## 🔧 What to Add to Vercel Dashboard

**Path:** Settings → Environment Variables

### Production Environment

Copy each line exactly (NO quotes):

```
DATABASE_URL=mongodb+srv://uploadhorizon_db_user:MbQ7xEgCCONqBjue@cluster0.vnygklb.mongodb.net/Xatnan1?retryWrites=true&w=majority&authSource=admin

JWT_SECRET=change_me_min_32_chars__local_dev_only_1234

JWT_EXPIRATION=7d

SUPER_ADMIN_USERNAME=super_admin

SUPER_ADMIN_PASSWORD=super_admin123

SUPER_ADMIN_NAME=Super_Admin

SUPER_ADMIN_PHONE=+998900000000

BOT_TOKEN=8122262826:YOUR_ACTUAL_BOT_TOKEN_HERE

FRONTEND_URL=https://your-vercel-domain.com

NODE_ENV=production
```

---

## ⚠️ Critical Points

1. **DATABASE_URL:**
   - Must include: `?authSource=admin&retryWrites=true&w=majority`
   - No quotes!
   - Check MongoDB credentials match exactly

2. **BOT_TOKEN:**
   - Get from: <https://t.me/botfather>
   - Or use existing: `8122262826:AAH98Mm3FLADPWoKqpFsMYUSoyAVpYmCh0M`

3. **FRONTEND_URL:**
   - Update to your actual domain
   - Used for CORS

---

## ✅ Before Saving

- [ ] DATABASE credentials are correct
- [ ] `authSource=admin` is in DATABASE_URL
- [ ] BOT_TOKEN is valid
- [ ] Select all 3 environments: Production, Preview, Development
- [ ] Click "Save"

---

## 🔍 After Saving

1. Go to **Deployments**
2. Click **Redeploy** on latest deployment
3. Wait for build to complete
4. Test: `curl https://your-domain.com/api/users`

**Expected result:** User list or 401 (auth error), NOT database error

---

## 🆘 If Build Fails

1. Check **Build Logs** in Vercel
2. Look for "DATABASE_URL" errors
3. If "authSource" error → Go back and UPDATE DATABASE_URL
4. Redeploy again

---

Done! 🎉 Your app should now work on Vercel.
