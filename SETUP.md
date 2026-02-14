# IdeaFactory Setup Guide

## Required APIs & Services

### 1. Telegram Bot Token (Required)
1. Open Telegram and message [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow prompts
3. Copy the bot token (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)
4. **IMPORTANT - Configure Login Widget Domain:**
   - Send `/setdomain` to BotFather
   - Select your bot
   - Enter your web app domain: `ideafactory.up.railway.app` (or your custom domain)
   - This is **required** for Telegram Login Widget to work

### 2. Supabase Project (Required)
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL: `https://xxxxx.supabase.co`
3. Go to Settings > API and copy:
   - `anon` key (for web client)
   - `service_role` key (for API server - keep secret!)
4. Run the SQL migration in SQL Editor:
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and run in Supabase SQL Editor

### 3. Groq API Key (Required)
1. Go to [console.groq.com](https://console.groq.com)
2. Create an account and generate an API key
3. Free tier includes Whisper transcription + LLaMA inference

### 4. OpenAI API Key (Optional - Fallback)
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Used as fallback if Groq fails

---

## Local Development

### API Server
```bash
cd api
cp .env.example .env
# Edit .env with your keys
npm install
npm run dev
```

### Web Dashboard
```bash
cd web
cp .env.example .env
# Edit .env with Supabase URL and anon key
npm install
npm run dev
```

---

## Railway Deployment

### Option A: Monorepo (Recommended)
Deploy both services from one repo:

1. Create a new Railway project
2. Add two services from the same repo:
   - **API Service**: Root directory = `api`
   - **Web Service**: Root directory = `web`

### Option B: Separate Deployments
Deploy each folder separately.

### Environment Variables

**API Service:**
```
TELEGRAM_BOT_TOKEN=your_token
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_key
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key  # optional
NODE_ENV=production
WEBHOOK_URL=https://your-api.up.railway.app
```

**Web Service:**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=https://your-api.up.railway.app
VITE_TELEGRAM_BOT_USERNAME=YourBotUsername
```

**CRITICAL**: Make sure `VITE_API_URL` has NO trailing slash!

### Post-Deployment

#### API Service Setup
1. After API deploys, copy the Railway URL
2. Set `WEBHOOK_URL` env var to that URL (no trailing slash)
3. Optionally set `WEB_URL` to your web app URL for CORS
4. Redeploy or restart the API service
5. The bot will automatically register the webhook

#### Web Service Setup
1. After Web deploys, copy the Railway URL
2. Go back to Telegram and message [@BotFather](https://t.me/botfather)
3. **Configure Login Domain:**
   - Send `/setdomain` to BotFather
   - Select your bot
   - Enter your web domain (e.g., `ideafactory.up.railway.app`)
   - Without this, the Telegram Login button will NOT work
4. Verify environment variables are set:
   - `VITE_API_URL` points to your API service
   - `VITE_TELEGRAM_BOT_USERNAME` matches your bot username (without @)

---

## Verifying Setup

### Test Telegram Bot
1. Open Telegram and find your bot
2. Send `/start` - should get welcome message
3. Send a text message - should get categorized response
4. Send a voice note (< 2 min) - should get transcription

### Test Web Dashboard
1. Open your web URL
2. Should see demo ideas (real data requires Supabase auth setup)

---

## Troubleshooting

### Bot not responding
- Check Railway logs for errors
- Verify `TELEGRAM_BOT_TOKEN` is correct
- In development, ensure no other instance is running (conflicts with polling)

### Transcription failing
- Check Groq API key is valid
- Verify audio is under 2 minutes
- Check Railway logs for specific error

### Web not loading
- Check browser console for errors
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set

### Telegram Login not working
This is the most common issue. Check these in order:

1. **BotFather Domain Configuration (MOST COMMON ISSUE)**
   - Open Telegram and message [@BotFather](https://t.me/botfather)
   - Send `/setdomain`
   - Select your bot
   - Enter ONLY the domain: `ideafactory.up.railway.app` (NO https://, NO www, NO trailing slash)
   - You should get: "Success! Login widget users will be redirected to https://ideafactory.up.railway.app"

2. **Environment Variables**
   - Verify `VITE_API_URL` is set correctly (NO trailing slash)
   - Verify `VITE_TELEGRAM_BOT_USERNAME` matches your bot username (without @)
   - Check Railway web service logs to see actual values

3. **CORS Issues**
   - Check browser console (F12) for CORS errors
   - Verify API service has `WEB_URL` env var set if using custom domain
   - Check API logs for "CORS blocked origin" messages

4. **Browser Console Debugging**
   - Open DevTools (F12) → Console tab
   - Look for errors when clicking login button
   - Common errors:
     - `Failed to fetch` = CORS or wrong API URL
     - `bot_domain_invalid` = Domain not configured in BotFather
     - `401 Unauthorized` = Auth verification failing (check bot token)

5. **Test the Auth Flow**
   ```bash
   # Check if API is reachable from browser console:
   fetch('https://your-api.up.railway.app/health')
     .then(r => r.json())
     .then(console.log)
   ```
