import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { webhookCallback } from 'grammy';
import { initSupabase, getRecentIdeas, searchIdeas, getIdeasByCategory, getUserStats, getUserCategories, getIdeasForInsights, updateIdea } from './services/supabase.js';
import { GroqProvider, OpenAIProvider, AIServiceWithFallback } from './services/ai-provider.js';
import { setupTelegramBot } from './handlers/telegram.js';
import { createAuthHandler, createAuthMiddleware, createLogoutHandler, createMeHandler } from './handlers/auth.js';

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

// Auth endpoints
app.post('/api/auth/telegram', createAuthHandler(process.env.TELEGRAM_BOT_TOKEN!));
app.post('/api/auth/logout', createLogoutHandler());

// Protected API routes
const authMiddleware = createAuthMiddleware();

app.get('/api/me', authMiddleware, createMeHandler());

app.get('/api/ideas', authMiddleware, async (req: any, res) => {
  try {
    const { search, category, limit } = req.query;
    const profileId = req.session.profileId;
    
    let ideas;
    if (search) {
      ideas = await searchIdeas(profileId, search as string);
    } else if (category) {
      ideas = await getIdeasByCategory(profileId, category as string);
    } else {
      ideas = await getRecentIdeas(profileId, parseInt(limit as string) || 50);
    }
    
    res.json({ ideas });
  } catch (error) {
    console.error('Error fetching ideas:', error);
    res.status(500).json({ error: 'Failed to fetch ideas' });
  }
});

app.patch('/api/ideas/:id', authMiddleware, async (req: any, res) => {
  try {
    const { id } = req.params;
    const profileId = req.session.profileId;
    const updates = req.body;
    
    const idea = await updateIdea(id, profileId, updates);
    res.json({ idea });
  } catch (error) {
    console.error('Error updating idea:', error);
    res.status(500).json({ error: 'Failed to update idea' });
  }
});

app.get('/api/categories', authMiddleware, async (req: any, res) => {
  try {
    const profileId = req.session.profileId;
    const categories = await getUserCategories(profileId);
    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/stats', authMiddleware, async (req: any, res) => {
  try {
    const profileId = req.session.profileId;
    const stats = await getUserStats(profileId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/insights', authMiddleware, async (req: any, res) => {
  try {
    const profileId = req.session.profileId;
    const ideas = await getIdeasForInsights(profileId, 30);
    
    if (ideas.length < 3) {
      res.json({ 
        insights: null, 
        message: 'Need at least 3 ideas to generate insights' 
      });
      return;
    }
    
    const insights = await aiService.generateInsights(ideas);
    res.json({ insights });
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const WEBHOOK_URL = process.env.WEBHOOK_URL;

let botStarted = false;

async function startBot() {
  try {
    if (NODE_ENV === 'development' || !WEBHOOK_URL) {
      // Use long polling in development
      await bot.start({
        onStart: (botInfo) => {
          console.log(`Bot @${botInfo.username} started in polling mode`);
          botStarted = true;
        },
      });
    } else {
      // Set webhook in production (remove trailing slash from WEBHOOK_URL if present)
      const baseUrl = WEBHOOK_URL.replace(/\/+$/, '');
      const webhookUrl = `${baseUrl}/api/telegram/webhook`;
      await bot.api.setWebhook(webhookUrl);
      console.log(`Bot webhook set to: ${webhookUrl}`);
      botStarted = true;
    }
  } catch (error) {
    console.error('Failed to start bot:', error);
    // Don't crash - server can still handle API requests
    // Bot webhook will be set on next deploy or manual retry
  }
}

// Start server first, then bot (non-blocking)
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
  
  // Start bot after server is listening (don't await - let it run in background)
  startBot().catch(err => {
    console.error('Bot startup error:', err);
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  server.close();
  if (botStarted) {
    try {
      await bot.stop();
    } catch (e) {
      console.error('Error stopping bot:', e);
    }
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  server.close();
  if (botStarted) {
    try {
      await bot.stop();
    } catch (e) {
      console.error('Error stopping bot:', e);
    }
  }
  process.exit(0);
});
