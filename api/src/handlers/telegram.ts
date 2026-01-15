import { Bot, Context, InlineKeyboard } from 'grammy';
import type { AIProvider } from '../types/index.js';
import {
  getOrCreateProfile,
  createIdea,
  getUserCategories,
  getRecentIdeas,
  searchIdeas,
  getIdeasByCategory,
  getUserStats,
  updateIdea,
} from '../services/supabase.js';

const MAX_VOICE_DURATION_SECONDS = 120; // 2 minutes

// Store pending edits: Map<telegramUserId, ideaId>
const pendingEdits = new Map<number, string>();

function truncate(text: string, maxLength = 100): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function formatIdea(idea: { created_at: string; category: string; transcript: string }): string {
  const date = new Date(idea.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `[${date}] ${idea.category}: ${truncate(idea.transcript, 60)}`;
}

export function setupTelegramBot(token: string, aiService: AIProvider): Bot {
  const bot = new Bot(token);

  // /start command
  bot.command('start', async (ctx) => {
    await ctx.reply(
      `Welcome to IdeaFactory! 🧠\n\n` +
      `I capture and organize your ideas so you never lose a good thought again.\n\n` +
      `Send me a voice note or text message with any idea, and I'll:\n` +
      `✓ Transcribe it (if voice)\n` +
      `✓ Automatically categorize it\n` +
      `✓ Store it for easy retrieval\n\n` +
      `Try it now—send me your first idea!`
    );
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📚 *IdeaFactory Commands*\n\n` +
      `/start - Welcome message\n` +
      `/help - This help message\n` +
      `/recent - Your last 5 ideas\n` +
      `/search <query> - Search your ideas\n` +
      `/category <name> - List ideas in a category\n` +
      `/stats - Your idea statistics\n` +
      `/web - Link to web dashboard\n\n` +
      `Just send me a text or voice note to capture an idea!`,
      { parse_mode: 'Markdown' }
    );
  });

  // /recent command
  bot.command('recent', async (ctx) => {
    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
      const ideas = await getRecentIdeas(profile.id, 5);

      if (ideas.length === 0) {
        await ctx.reply("You haven't captured any ideas yet. Send me a text or voice note to get started!");
        return;
      }

      const formatted = ideas.map((idea, i) => `${i + 1}. ${formatIdea(idea)}`).join('\n');
      await ctx.reply(`📋 *Your Recent Ideas*\n\n${formatted}`, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in /recent:', error);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  });

  // /search command
  bot.command('search', async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) {
      await ctx.reply('Usage: /search <query>\nExample: /search pricing');
      return;
    }

    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
      const ideas = await searchIdeas(profile.id, query);

      if (ideas.length === 0) {
        await ctx.reply(`No ideas found matching "${query}".`);
        return;
      }

      const formatted = ideas.map((idea, i) => `${i + 1}. ${formatIdea(idea)}`).join('\n');
      await ctx.reply(
        `🔍 Found ${ideas.length} idea(s) matching "${query}":\n\n${formatted}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Error in /search:', error);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  });

  // /category command
  bot.command('category', async (ctx) => {
    const categoryName = ctx.match?.trim();
    if (!categoryName) {
      await ctx.reply('Usage: /category <name>\nExample: /category Business');
      return;
    }

    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
      const ideas = await getIdeasByCategory(profile.id, categoryName);

      if (ideas.length === 0) {
        await ctx.reply(`No ideas found in category "${categoryName}".`);
        return;
      }

      const formatted = ideas.map((idea, i) => `${i + 1}. ${formatIdea(idea)}`).join('\n');
      await ctx.reply(
        `📁 *${categoryName}* (${ideas.length} ideas):\n\n${formatted}`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('Error in /category:', error);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  });

  // /stats command
  bot.command('stats', async (ctx) => {
    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
      const stats = await getUserStats(profile.id);

      let message = `📊 *Your IdeaFactory Stats*\n\n`;
      message += `Total ideas: ${stats.totalIdeas}\n`;
      message += `This month: ${stats.thisMonth}\n\n`;

      if (stats.topCategories.length > 0) {
        message += `*Top Categories:*\n`;
        stats.topCategories.forEach((cat, i) => {
          message += `${i + 1}. ${cat.name} (${cat.count})\n`;
        });
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in /stats:', error);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  });

  // /web command
  bot.command('web', async (ctx) => {
    await ctx.reply(
      `🌐 *Web Dashboard*\n\n` +
      `View and manage all your ideas at:\n` +
      `[Dashboard link will be configured here]\n\n` +
      `Features:\n` +
      `• Full idea table with search & filters\n` +
      `• Edit transcripts and categories\n` +
      `• View insights and patterns`,
      { parse_mode: 'Markdown' }
    );
  });

  // Handle voice notes
  bot.on('message:voice', async (ctx) => {
    const voice = ctx.message.voice;
    
    if (voice.duration > MAX_VOICE_DURATION_SECONDS) {
      await ctx.reply(
        `⏱️ Voice notes are limited to 2 minutes.\n` +
        `Your note was ${Math.floor(voice.duration / 60)}:${(voice.duration % 60).toString().padStart(2, '0')} long.\n` +
        `Try breaking your idea into smaller parts.`
      );
      return;
    }

    const processingMsg = await ctx.reply('🎤 Got it, processing your voice note...');

    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      
      const response = await fetch(fileUrl);
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      
      const transcript = await aiService.transcribe(audioBuffer);
      
      if (!transcript || transcript.trim().length === 0) {
        await ctx.api.editMessageText(
          ctx.chat.id,
          processingMsg.message_id,
          "❌ Couldn't understand the audio. Try speaking more clearly or send as text."
        );
        return;
      }
      
      const existingCategories = await getUserCategories(profile.id);
      const categorization = await aiService.categorize(transcript, existingCategories);
      
      const idea = await createIdea(
        profile.id,
        'voice',
        transcript,
        categorization.category,
        categorization.confidence,
        categorization.tags
      );

      const keyboard = new InlineKeyboard()
        .text('✏️ Edit', `edit:${idea.id}`)
        .text('🏷️ Recategorize', `recat:${idea.id}`)
        .text('⭐ Star', `star:${idea.id}`);

      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        `✅ *Got it! Here's what I captured:*\n\n` +
        `💡 "${truncate(transcript, 200)}"\n\n` +
        `📁 Category: ${categorization.category}\n` +
        `🏷️ Tags: ${categorization.tags.map(t => `#${t}`).join(' ') || 'none'}`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      console.error('Error processing voice note:', error);
      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        "❌ Couldn't process that voice note. Try again or send as text."
      );
    }
  });

  // Handle text messages (not commands)
  bot.on('message:text', async (ctx) => {
    if (ctx.message.text.startsWith('/')) return;

    const text = ctx.message.text.trim();
    if (!text) return;

    // Check if this is a reply to an edit prompt
    const pendingIdeaId = pendingEdits.get(ctx.from!.id);
    if (pendingIdeaId && ctx.message.reply_to_message) {
      try {
        const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
        await updateIdea(pendingIdeaId, profile.id, { transcript_edited: text });
        pendingEdits.delete(ctx.from!.id);
        await ctx.reply('✅ Idea updated!');
        return;
      } catch (error) {
        console.error('Error updating idea:', error);
        await ctx.reply('❌ Failed to update idea. Please try again.');
        return;
      }
    }

    const processingMsg = await ctx.reply('📝 Processing your idea...');

    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
      const existingCategories = await getUserCategories(profile.id);
      const categorization = await aiService.categorize(text, existingCategories);
      
      const idea = await createIdea(
        profile.id,
        'text',
        text,
        categorization.category,
        categorization.confidence,
        categorization.tags
      );

      const keyboard = new InlineKeyboard()
        .text('✏️ Edit', `edit:${idea.id}`)
        .text('🏷️ Recategorize', `recat:${idea.id}`)
        .text('⭐ Star', `star:${idea.id}`);

      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        `✅ *Got it! Here's what I captured:*\n\n` +
        `💡 "${truncate(text, 200)}"\n\n` +
        `📁 Category: ${categorization.category}\n` +
        `🏷️ Tags: ${categorization.tags.map(t => `#${t}`).join(' ') || 'none'}`,
        { parse_mode: 'Markdown', reply_markup: keyboard }
      );
    } catch (error) {
      console.error('Error processing text message:', error);
      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        "❌ Something went wrong. Please try again."
      );
    }
  });

  // Handle inline keyboard callbacks
  bot.on('callback_query:data', async (ctx) => {
    const [action, ideaId] = ctx.callbackQuery.data.split(':');
    
    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);

      switch (action) {
        case 'star':
          await updateIdea(ideaId, profile.id, { is_starred: true });
          await ctx.answerCallbackQuery({ text: '⭐ Idea starred!' });
          break;
        
        case 'edit':
          pendingEdits.set(ctx.from!.id, ideaId);
          await ctx.answerCallbackQuery();
          await ctx.reply(
            'Send me the corrected text for this idea:',
            { reply_markup: { force_reply: true } }
          );
          break;
        
        case 'recat':
          const categories = await getUserCategories(profile.id);
          const defaultCats = ['Product', 'Business', 'Personal', 'Creative', 'Technical', 'Learning'];
          const allCats = [...new Set([...categories, ...defaultCats])];
          
          const keyboard = new InlineKeyboard();
          allCats.forEach((cat, i) => {
            keyboard.text(cat, `setcat:${ideaId}:${cat}`);
            if ((i + 1) % 2 === 0) keyboard.row();
          });
          
          await ctx.answerCallbackQuery();
          await ctx.reply('Choose a category:', { reply_markup: keyboard });
          break;
        
        case 'setcat':
          // Format: setcat:ideaId:category (category may contain colons)
          const parts = ctx.callbackQuery.data.split(':');
          const setCatIdeaId = parts[1];
          const newCategory = parts.slice(2).join(':'); // Rejoin in case category has colons
          await updateIdea(setCatIdeaId, profile.id, { category_edited: newCategory });
          await ctx.answerCallbackQuery({ text: `Category changed to ${newCategory}` });
          await ctx.deleteMessage();
          break;
      }
    } catch (error) {
      console.error('Error handling callback:', error);
      await ctx.answerCallbackQuery({ text: 'Something went wrong' });
    }
  });

  return bot;
}
