# IdeaFactory Setup Guide

## Required APIs & Services

### 1. Telegram Bot Token (Required)
1. Open Telegram and message [@BotFather](https://t.me/botfather)
2. Send `/newbot` and follow prompts
3. Copy the bot token (looks like `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

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
```

### Post-Deployment
1. After API deploys, copy the Railway URL
2. Set `WEBHOOK_URL` env var to that URL
3. Redeploy or restart the API service
4. The bot will automatically register the webhook

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
