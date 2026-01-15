import { Bot, InlineKeyboard } from 'grammy';
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

// User state management
interface UserState {
  pendingEdit?: { ideaId: string; messageId: number };
  paused?: boolean;
  confirmMode?: boolean;
  pendingIdea?: { text: string; inputType: 'voice' | 'text' };
}

const userStates = new Map<number, UserState>();

function getUserState(userId: number): UserState {
  if (!userStates.has(userId)) {
    userStates.set(userId, {});
  }
  return userStates.get(userId)!;
}

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
    const state = getUserState(ctx.from!.id);
    state.paused = false;
    
    await ctx.reply(
      `Welcome to IdeaFactory! 💡\n\n` +
      `I capture and organize your ideas so you never lose a good thought.\n\n` +
      `*How to use:*\n` +
      `• Send text or voice notes → I'll save them as ideas\n` +
      `• Start with \`?\` → Ask me a question (won't be saved)\n` +
      `• /pause → Stop capturing temporarily\n` +
      `• /resume → Start capturing again\n\n` +
      `*Commands:*\n` +
      `/recent - Your last 5 ideas\n` +
      `/search <query> - Search your ideas\n` +
      `/stats - Your statistics\n` +
      `/help - Full command list\n\n` +
      `Try it now—send me your first idea!`,
      { parse_mode: 'Markdown' }
    );
  });

  // /help command
  bot.command('help', async (ctx) => {
    await ctx.reply(
      `📚 *IdeaFactory Commands*\n\n` +
      `*Capture:*\n` +
      `• Just send text or voice → Saved as idea\n` +
      `• Start with \`?\` → Question, not saved\n\n` +
      `*Control:*\n` +
      `/pause - Stop capturing ideas\n` +
      `/resume - Resume capturing\n` +
      `/confirm - Toggle save confirmation\n\n` +
      `*Browse:*\n` +
      `/recent - Last 5 ideas\n` +
      `/search <query> - Search ideas\n` +
      `/category <name> - Ideas by category\n` +
      `/stats - Your statistics\n` +
      `/web - Open web dashboard`,
      { parse_mode: 'Markdown' }
    );
  });

  // /pause command
  bot.command('pause', async (ctx) => {
    const state = getUserState(ctx.from!.id);
    state.paused = true;
    await ctx.reply(
      `⏸️ *Paused*\n\n` +
      `I won't capture your messages as ideas.\n` +
      `Send /resume when you want to start again.`,
      { parse_mode: 'Markdown' }
    );
  });

  // /resume command
  bot.command('resume', async (ctx) => {
    const state = getUserState(ctx.from!.id);
    state.paused = false;
    await ctx.reply(
      `▶️ *Resumed*\n\n` +
      `I'm capturing ideas again!`,
      { parse_mode: 'Markdown' }
    );
  });

  // /confirm command - toggle confirmation mode
  bot.command('confirm', async (ctx) => {
    const state = getUserState(ctx.from!.id);
    state.confirmMode = !state.confirmMode;
    await ctx.reply(
      state.confirmMode
        ? `✅ *Confirmation ON*\n\nI'll ask before saving each idea.`
        : `☑️ *Confirmation OFF*\n\nIdeas will be saved automatically.`,
      { parse_mode: 'Markdown' }
    );
  });

  // /recent command
  bot.command('recent', async (ctx) => {
    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
      const ideas = await getRecentIdeas(profile.id, 5);

      if (ideas.length === 0) {
        await ctx.reply("You haven't captured any ideas yet. Send me a text or voice note!");
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
      await ctx.reply('Usage: `/search pricing`', { parse_mode: 'Markdown' });
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
      await ctx.reply(`🔍 Found ${ideas.length} idea(s):\n\n${formatted}`, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in /search:', error);
      await ctx.reply('Sorry, something went wrong.');
    }
  });

  // /category command
  bot.command('category', async (ctx) => {
    const categoryName = ctx.match?.trim();
    if (!categoryName) {
      await ctx.reply('Usage: `/category Business`', { parse_mode: 'Markdown' });
      return;
    }

    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
      const ideas = await getIdeasByCategory(profile.id, categoryName);

      if (ideas.length === 0) {
        await ctx.reply(`No ideas in "${categoryName}".`);
        return;
      }

      const formatted = ideas.map((idea, i) => `${i + 1}. ${formatIdea(idea)}`).join('\n');
      await ctx.reply(`📁 *${categoryName}* (${ideas.length}):\n\n${formatted}`, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in /category:', error);
      await ctx.reply('Sorry, something went wrong.');
    }
  });

  // /stats command
  bot.command('stats', async (ctx) => {
    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
      const stats = await getUserStats(profile.id);

      let message = `📊 *Your Stats*\n\n`;
      message += `Total ideas: ${stats.totalIdeas}\n`;
      message += `This month: ${stats.thisMonth}\n`;

      if (stats.topCategories.length > 0) {
        message += `\n*Top Categories:*\n`;
        stats.topCategories.slice(0, 3).forEach((cat) => {
          message += `• ${cat.name}: ${cat.count}\n`;
        });
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error in /stats:', error);
      await ctx.reply('Sorry, something went wrong.');
    }
  });

  // /web command
  bot.command('web', async (ctx) => {
    await ctx.reply(
      `🌐 *Web Dashboard*\n\n` +
      `View all your ideas, edit them, and see insights.\n\n` +
      `Login with Telegram to access your dashboard.`,
      { parse_mode: 'Markdown' }
    );
  });

  // Handle voice notes
  bot.on('message:voice', async (ctx) => {
    const state = getUserState(ctx.from!.id);
    
    if (state.paused) {
      return; // Silently ignore when paused
    }

    const voice = ctx.message.voice;
    
    if (voice.duration > MAX_VOICE_DURATION_SECONDS) {
      await ctx.reply(
        `⏱️ Voice notes are limited to 2 minutes.\n` +
        `Yours was ${Math.floor(voice.duration / 60)}:${(voice.duration % 60).toString().padStart(2, '0')}.\n` +
        `Try breaking it into smaller parts.`
      );
      return;
    }

    const processingMsg = await ctx.reply('🎤 Processing...');

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

      // If confirm mode is on, ask first
      if (state.confirmMode) {
        state.pendingIdea = { text: transcript, inputType: 'voice' };
        
        const keyboard = new InlineKeyboard()
          .text('✅ Save', 'confirm_save')
          .text('❌ Discard', 'confirm_discard');
        
        await ctx.api.editMessageText(
          ctx.chat.id,
          processingMsg.message_id,
          `💭 *Save this idea?*\n\n"${truncate(transcript, 200)}"`,
          { parse_mode: 'Markdown', reply_markup: keyboard }
        );
        return;
      }

      // Save directly
      await saveIdea(ctx, profile.id, 'voice', transcript, processingMsg.message_id, aiService);
    } catch (error) {
      console.error('Error processing voice:', error);
      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        "❌ Couldn't process that. Try again or send as text."
      );
    }
  });

  // Handle text messages
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith('/')) return;

    const state = getUserState(ctx.from!.id);

    // Check if this is an edit response
    if (state.pendingEdit) {
      try {
        const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
        await updateIdea(state.pendingEdit.ideaId, profile.id, { transcript_edited: text });
        
        // Delete the prompt message
        try {
          await ctx.api.deleteMessage(ctx.chat.id, state.pendingEdit.messageId);
        } catch {}
        
        state.pendingEdit = undefined;
        await ctx.reply('✅ Idea updated!');
        return;
      } catch (error) {
        console.error('Error updating idea:', error);
        state.pendingEdit = undefined;
        await ctx.reply('❌ Failed to update. Please try again.');
        return;
      }
    }

    // Check for question prefix
    if (text.startsWith('?')) {
      const question = text.substring(1).trim();
      await ctx.reply(
        `❓ That looks like a question, so I didn't save it.\n\n` +
        `For now, I just capture ideas. Try:\n` +
        `• /search to find ideas\n` +
        `• /recent to see recent ideas\n` +
        `• /help for all commands`
      );
      return;
    }

    // Check if paused
    if (state.paused) {
      return; // Silently ignore
    }

    const processingMsg = await ctx.reply('📝 Processing...');

    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);

      // If confirm mode is on, ask first
      if (state.confirmMode) {
        state.pendingIdea = { text, inputType: 'text' };
        
        const keyboard = new InlineKeyboard()
          .text('✅ Save', 'confirm_save')
          .text('❌ Discard', 'confirm_discard');
        
        await ctx.api.editMessageText(
          ctx.chat.id,
          processingMsg.message_id,
          `💭 *Save this idea?*\n\n"${truncate(text, 200)}"`,
          { parse_mode: 'Markdown', reply_markup: keyboard }
        );
        return;
      }

      // Save directly
      await saveIdea(ctx, profile.id, 'text', text, processingMsg.message_id, aiService);
    } catch (error) {
      console.error('Error processing text:', error);
      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        "❌ Something went wrong. Please try again."
      );
    }
  });

  // Handle inline keyboard callbacks
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const state = getUserState(ctx.from!.id);
    
    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);

      // Confirmation callbacks
      if (data === 'confirm_save' && state.pendingIdea) {
        await ctx.answerCallbackQuery({ text: 'Saving...' });
        await saveIdea(
          ctx, 
          profile.id, 
          state.pendingIdea.inputType, 
          state.pendingIdea.text, 
          ctx.callbackQuery.message?.message_id,
          aiService
        );
        state.pendingIdea = undefined;
        return;
      }

      if (data === 'confirm_discard') {
        state.pendingIdea = undefined;
        await ctx.answerCallbackQuery({ text: 'Discarded' });
        await ctx.deleteMessage();
        return;
      }

      // Parse action:ideaId format
      const [action, ideaId] = data.split(':');

      switch (action) {
        case 'star':
          await updateIdea(ideaId, profile.id, { is_starred: true });
          await ctx.answerCallbackQuery({ text: '⭐ Starred!' });
          break;
        
        case 'unstar':
          await updateIdea(ideaId, profile.id, { is_starred: false });
          await ctx.answerCallbackQuery({ text: 'Unstarred' });
          break;
        
        case 'edit':
          state.pendingEdit = { 
            ideaId, 
            messageId: ctx.callbackQuery.message?.message_id || 0 
          };
          await ctx.answerCallbackQuery();
          await ctx.reply(
            '✏️ Send me the corrected text:',
            { reply_markup: { force_reply: true } }
          );
          break;
        
        case 'archive':
          await updateIdea(ideaId, profile.id, { is_archived: true });
          await ctx.answerCallbackQuery({ text: '🗑️ Archived' });
          await ctx.deleteMessage();
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
          keyboard.row().text('« Cancel', 'cancel');
          
          await ctx.answerCallbackQuery();
          await ctx.editMessageReplyMarkup({ reply_markup: keyboard });
          break;
        
        case 'setcat':
          const parts = data.split(':');
          const setCatIdeaId = parts[1];
          const newCategory = parts.slice(2).join(':');
          await updateIdea(setCatIdeaId, profile.id, { category_edited: newCategory });
          await ctx.answerCallbackQuery({ text: `Category: ${newCategory}` });
          await ctx.deleteMessage();
          break;
        
        case 'cancel':
          await ctx.answerCallbackQuery({ text: 'Cancelled' });
          await ctx.deleteMessage();
          break;
      }
    } catch (error) {
      console.error('Error handling callback:', error);
      await ctx.answerCallbackQuery({ text: 'Error occurred' });
    }
  });

  return bot;
}

// Helper to save an idea and show result
async function saveIdea(
  ctx: any,
  profileId: string,
  inputType: 'voice' | 'text',
  transcript: string,
  messageId: number | undefined,
  aiService: AIProvider
) {
  const existingCategories = await getUserCategories(profileId);
  const categorization = await aiService.categorize(transcript, existingCategories);
  
  const idea = await createIdea(
    profileId,
    inputType,
    transcript,
    categorization.category,
    categorization.confidence,
    categorization.tags
  );

  const keyboard = new InlineKeyboard()
    .text('⭐', `star:${idea.id}`)
    .text('✏️', `edit:${idea.id}`)
    .text('🏷️', `recat:${idea.id}`)
    .text('🗑️', `archive:${idea.id}`);

  const message = 
    `✅ *Saved!*\n\n` +
    `💡 "${truncate(transcript, 150)}"\n\n` +
    `📁 ${categorization.category}\n` +
    `🏷️ ${categorization.tags.map(t => `#${t}`).join(' ') || 'no tags'}`;

  if (messageId) {
    await ctx.api.editMessageText(ctx.chat.id, messageId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  } else {
    await ctx.reply(message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard,
    });
  }
}
