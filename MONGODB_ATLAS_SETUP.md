# MongoDB Atlas Setup for Vercel

## 🔑 Step-by-Step Configuration

### 1. Network Access Setup

**In MongoDB Atlas Dashboard:**

1. Go to **Security** → **Network Access**
2. Click **Add IP Address**

**Option A: Allow Vercel (Recommended for Testing)**
- Click **ALLOW FROM ANY WHERE**
- Select **0.0.0.0/0** (allows all IPs)
- ⚠️ This is safe because your database is protected by strong credentials
- Confirm

**Option B: Whitelist Specific IPs (Production)**
- Get Vercel's IP addresses: https://vercel.com/docs/concepts/edge-network/edge-middleware#vercel-owned-ips
- Add each IP individually
- More secure but requires periodic updates

✅ **Verify:** In Network Access, you should see `0.0.0.0/0` or Vercel's IPs allowed

---

### 2. Database Credentials

**In MongoDB Atlas Dashboard:**

1. Go to **Security** → **Database Access**
2. Click **Add New Database User**
3. Fill in:
   - **Username:** `uploadhorizon_db_user`
   - **Password:** `MbQ7xEgCCONqBjue` (or your actual password)
   - **Built-in Role:** Select `Read and write to any database`
4. Click **Add User**

**⚠️ Important:** Remember this username and password!

---

### 3. Connection String

1. Go to **Databases** → Click **Connect** on your cluster
2. Choose **Drivers** → **Node.js**
3. Copy the connection string:

```
mongodb+srv://uploadhorizon_db_user:MbQ7xEgCCONqBjue@cluster0.vnygklb.mongodb.net/?retryWrites=true&w=majority
```

---

### 4. Update .env for Vercel

**Critical:** The connection string must include `authSource=admin`:

```env
DATABASE_URL=mongodb+srv://uploadhorizon_db_user:MbQ7xEgCCONqBjue@cluster0.vnygklb.mongodb.net/Xatnan1?retryWrites=true&w=majority&authSource=admin
```

**Breaking it down:**
- `uploadhorizon_db_user:MbQ7xEgCCONqBjue` = Your credentials
- `cluster0.vnygklb.mongodb.net` = Your cluster address
- `Xatnan1` = Your database name
- `authSource=admin` = **REQUIRED** - tells MongoDB where user is stored
- `retryWrites=true` = Handles transient failures
- `w=majority` = Write confirmation

---

### 5. In Vercel Dashboard

1. Go to **Settings** → **Environment Variables**
2. Add:
   ```
   DATABASE_URL=mongodb+srv://uploadhorizon_db_user:MbQ7xEgCCONqBjue@cluster0.vnygklb.mongodb.net/Xatnan1?retryWrites=true&w=majority&authSource=admin
   ```
3. ⚠️ **Do NOT include quotes!**
4. Select environments: Production, Preview, Development
5. Click **Save**

---

### 6. Test Connection

After deploying to Vercel:

```bash
# Or use the endpoint
curl https://your-vercel-domain.com/api/users
```

**Success:** Returns list of users or auth error (not database error)

**Failure:** Check error message:
- `SCRAM failure` → Wrong credentials or authSource missing
- `Malformed ObjectID` → ✅ Fixed by us (update code)
- `Connection timeout` → IP not whitelisted in Network Access

---

## 🔍 Verify Configuration

### Check Network Access
```bash
# MongoDB Atlas → Security → Network Access
# Should show: 0.0.0.0/0 (all) or specific IPs
```

### Check Database User
```bash
# MongoDB Atlas → Security → Database Access
# Should show: uploadhorizon_db_user with "Read and write to any database"
```

### Check Connection String Format
```
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/DATABASE?authSource=admin&retryWrites=true&w=majority
```

---

## 🆘 Troubleshooting

| Error | Solution |
|-------|----------|
| `SCRAM failure: bad auth` | 1. Check username/password 2. Add `&authSource=admin` to connection string |
| `connect ECONNREFUSED` | Network Access not configured - add IP 0.0.0.0/0 |
| `P2023 Malformed ObjectID` | ✅ Fixed in UserService - update your code |
| `Connection timeout` | Cluster might be paused - check cluster status |

---

## 📊 Security Best Practices

- ✅ Use strong passwords (16+ characters, mix of types)
- ✅ Keep credentials in Vercel env vars, not in code
- ✅ In production, use specific IPs instead of 0.0.0.0/0
- ✅ Regularly rotate database passwords
- ✅ Use VPN or IP whitelist for restricted access

---

## 🚀 Deployment Checklist

- [ ] Network Access: 0.0.0.0/0 allowed (or specific IPs)
- [ ] Database User: Created with correct credentials
- [ ] Connection String: Includes `authSource=admin`
- [ ] Vercel Env Vars: DATABASE_URL set correctly
- [ ] Local .env: Updated with correct credentials
- [ ] Build test: `npm run build` succeeds
- [ ] Deploy to Vercel
- [ ] Test endpoint: `curl https://your-domain.com/api/users`

---

**After completing these steps, your MongoDB Atlas should work perfectly with Vercel!** ✅
