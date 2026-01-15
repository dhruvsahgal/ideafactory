import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { webhookCallback } from 'grammy';
import { initSupabase } from './services/supabase.js';
import { GroqProvider, OpenAIProvider, AIServiceWithFallback } from './services/ai-provider.js';
import { setupTelegramBot } from './handlers/telegram.js';

const requiredEnvVars = [
  'TELEGRAM_BOT_TOKEN',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GROQ_API_KEY',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize Supabase
initSupabase(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

// Initialize AI providers with fallback
const providers: import('./types/index.js').AIProvider[] = [new GroqProvider(process.env.GROQ_API_KEY!)];
if (process.env.OPENAI_API_KEY) {
  providers.push(new OpenAIProvider(process.env.OPENAI_API_KEY));
}
const aiService = new AIServiceWithFallback(providers);

// Setup Telegram bot
const bot = setupTelegramBot(process.env.TELEGRAM_BOT_TOKEN!, aiService);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Telegram webhook endpoint
app.post('/api/telegram/webhook', webhookCallback(bot, 'express'));

// API routes for web dashboard
app.get('/api/ideas', async (req, res) => {
  // TODO: Implement with auth
  res.json({ message: 'Ideas endpoint - requires auth' });
});

app.get('/api/categories', async (req, res) => {
  // TODO: Implement with auth
  res.json({ message: 'Categories endpoint - requires auth' });
});

app.get('/api/insights', async (req, res) => {
  // TODO: Implement with auth
  res.json({ message: 'Insights endpoint - requires auth' });
});

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const WEBHOOK_URL = process.env.WEBHOOK_URL;

async function startBot() {
  if (NODE_ENV === 'development' || !WEBHOOK_URL) {
    // Use long polling in development
    await bot.start({
      onStart: (botInfo) => {
        console.log(`Bot @${botInfo.username} started in polling mode`);
      },
    });
  } else {
    // Set webhook in production
    const webhookUrl = `${WEBHOOK_URL}/api/telegram/webhook`;
    await bot.api.setWebhook(webhookUrl);
    console.log(`Bot webhook set to: ${webhookUrl}`);
  }
}

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  await startBot();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await bot.stop();
  process.exit(0);
});
