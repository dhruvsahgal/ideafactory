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
  getAllIdeas,
} from '../services/supabase.js';

const MAX_VOICE_DURATION_SECONDS = 120;

// User state management
interface UserState {
  pendingEdit?: { ideaId: string; messageId: number };
  pendingSearch?: boolean;
  paused?: boolean;
  confirmMode?: boolean;
  pendingIdea?: { text: string; inputType: 'voice' | 'text' };
  browseOffset?: number;
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

function formatIdea(idea: { created_at: string; category: string; transcript: string; is_starred: boolean }): string {
  const date = new Date(idea.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const star = idea.is_starred ? '⭐ ' : '';
  return `${star}[${date}] ${idea.category}: ${truncate(idea.transcript, 50)}`;
}

// Main menu keyboard
function getMainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📋 My Ideas', 'menu_ideas')
    .text('🔍 Search', 'menu_search')
    .row()
    .text('📊 Stats', 'menu_stats')
    .text('⚙️ Settings', 'menu_settings')
    .row()
    .text('❓ Help', 'menu_help');
}

// Settings keyboard
function getSettingsKeyboard(state: UserState): InlineKeyboard {
  return new InlineKeyboard()
    .text(state.paused ? '▶️ Resume Capture' : '⏸️ Pause Capture', 'settings_pause')
    .row()
    .text(state.confirmMode ? '☑️ Auto-save: OFF' : '✅ Auto-save: ON', 'settings_confirm')
    .row()
    .text('« Back to Menu', 'menu_main');
}

export function setupTelegramBot(token: string, aiService: AIProvider): Bot {
  const bot = new Bot(token);

  // /start command - show main menu
  bot.command('start', async (ctx) => {
    const state = getUserState(ctx.from!.id);
    state.paused = false;
    state.pendingSearch = false;
    state.pendingEdit = undefined;
    
    await ctx.reply(
      `💡 *Welcome to IdeaFactory!*\n\n` +
      `I capture and organize your ideas.\n\n` +
      `*Quick start:*\n` +
      `• Send text or voice → I'll save it\n` +
      `• Start with \`?\` → Won't be saved\n\n` +
      `What would you like to do?`,
      { parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard() }
    );
  });

  // /menu command - show main menu
  bot.command('menu', async (ctx) => {
    await ctx.reply(
      `💡 *IdeaFactory Menu*`,
      { parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard() }
    );
  });

  // Legacy commands still work
  bot.command('recent', async (ctx) => {
    await showIdeas(ctx, 0);
  });

  bot.command('search', async (ctx) => {
    const query = ctx.match?.trim();
    if (!query) {
      const state = getUserState(ctx.from!.id);
      state.pendingSearch = true;
      await ctx.reply('🔍 What would you like to search for?', {
        reply_markup: { force_reply: true }
      });
      return;
    }
    await performSearch(ctx, query);
  });

  bot.command('stats', async (ctx) => {
    await showStats(ctx);
  });

  bot.command('help', async (ctx) => {
    await showHelp(ctx);
  });

  bot.command('settings', async (ctx) => {
    const state = getUserState(ctx.from!.id);
    await ctx.reply(
      `⚙️ *Settings*\n\n` +
      `Configure how IdeaFactory works for you.`,
      { parse_mode: 'Markdown', reply_markup: getSettingsKeyboard(state) }
    );
  });

  bot.command('pause', async (ctx) => {
    const state = getUserState(ctx.from!.id);
    state.paused = true;
    await ctx.reply('⏸️ Paused. Send /resume or use Settings to start again.');
  });

  bot.command('resume', async (ctx) => {
    const state = getUserState(ctx.from!.id);
    state.paused = false;
    await ctx.reply('▶️ Resumed! I\'m capturing ideas again.');
  });

  // Handle voice notes
  bot.on('message:voice', async (ctx) => {
    const state = getUserState(ctx.from!.id);
    
    if (state.paused) return;

    const voice = ctx.message.voice;
    
    if (voice.duration > MAX_VOICE_DURATION_SECONDS) {
      await ctx.reply(`⏱️ Max 2 minutes. Yours: ${Math.floor(voice.duration / 60)}:${(voice.duration % 60).toString().padStart(2, '0')}`);
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
      
      if (!transcript?.trim()) {
        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id,
          "❌ Couldn't understand. Try again or send as text.");
        return;
      }

      if (state.confirmMode) {
        state.pendingIdea = { text: transcript, inputType: 'voice' };
        const keyboard = new InlineKeyboard()
          .text('✅ Save', 'confirm_save')
          .text('❌ Discard', 'confirm_discard');
        
        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id,
          `💭 *Save this?*\n\n"${truncate(transcript, 200)}"`,
          { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      }

      await saveIdea(ctx, profile.id, 'voice', transcript, processingMsg.message_id, aiService);
    } catch (error) {
      console.error('Voice error:', error);
      await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id,
        "❌ Error processing. Try again.");
    }
  });

  // Handle text messages
  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (!text || text.startsWith('/')) return;

    const state = getUserState(ctx.from!.id);

    // Handle pending edit
    if (state.pendingEdit) {
      try {
        const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
        await updateIdea(state.pendingEdit.ideaId, profile.id, { transcript_edited: text });
        try { await ctx.api.deleteMessage(ctx.chat.id, state.pendingEdit.messageId); } catch {}
        state.pendingEdit = undefined;
        await ctx.reply('✅ Updated!');
        return;
      } catch (error) {
        state.pendingEdit = undefined;
        await ctx.reply('❌ Update failed.');
        return;
      }
    }

    // Handle pending search
    if (state.pendingSearch) {
      state.pendingSearch = false;
      await performSearch(ctx, text);
      return;
    }

    // Question prefix - don't save
    if (text.startsWith('?')) {
      await ctx.reply(
        `❓ Questions aren't saved.\n\nUse the menu to browse:`,
        { reply_markup: getMainMenuKeyboard() }
      );
      return;
    }

    // Paused - ignore
    if (state.paused) return;

    const processingMsg = await ctx.reply('📝 Processing...');

    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);

      if (state.confirmMode) {
        state.pendingIdea = { text, inputType: 'text' };
        const keyboard = new InlineKeyboard()
          .text('✅ Save', 'confirm_save')
          .text('❌ Discard', 'confirm_discard');
        
        await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id,
          `💭 *Save this?*\n\n"${truncate(text, 200)}"`,
          { parse_mode: 'Markdown', reply_markup: keyboard });
        return;
      }

      await saveIdea(ctx, profile.id, 'text', text, processingMsg.message_id, aiService);
    } catch (error) {
      console.error('Text error:', error);
      await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, "❌ Error. Try again.");
    }
  });

  // Handle all inline keyboard callbacks
  bot.on('callback_query:data', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const state = getUserState(ctx.from!.id);
    
    try {
      const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);

      // Menu actions
      if (data === 'menu_main') {
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
          `💡 *IdeaFactory Menu*`,
          { parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard() }
        );
        return;
      }

      if (data === 'menu_ideas') {
        await ctx.answerCallbackQuery();
        state.browseOffset = 0;
        await showIdeasInline(ctx, profile.id, 0);
        return;
      }

      if (data === 'menu_search') {
        state.pendingSearch = true;
        await ctx.answerCallbackQuery();
        await ctx.editMessageText('🔍 *Search*\n\nSend me what you\'re looking for:', 
          { parse_mode: 'Markdown' });
        return;
      }

      if (data === 'menu_stats') {
        await ctx.answerCallbackQuery();
        await showStatsInline(ctx, profile.id);
        return;
      }

      if (data === 'menu_settings') {
        await ctx.answerCallbackQuery();
        await ctx.editMessageText(
          `⚙️ *Settings*`,
          { parse_mode: 'Markdown', reply_markup: getSettingsKeyboard(state) }
        );
        return;
      }

      if (data === 'menu_help') {
        await ctx.answerCallbackQuery();
        await showHelpInline(ctx);
        return;
      }

      // Settings actions
      if (data === 'settings_pause') {
        state.paused = !state.paused;
        await ctx.answerCallbackQuery({ text: state.paused ? 'Paused' : 'Resumed' });
        await ctx.editMessageText(
          `⚙️ *Settings*`,
          { parse_mode: 'Markdown', reply_markup: getSettingsKeyboard(state) }
        );
        return;
      }

      if (data === 'settings_confirm') {
        state.confirmMode = !state.confirmMode;
        await ctx.answerCallbackQuery({ text: state.confirmMode ? 'Confirm mode ON' : 'Auto-save ON' });
        await ctx.editMessageText(
          `⚙️ *Settings*`,
          { parse_mode: 'Markdown', reply_markup: getSettingsKeyboard(state) }
        );
        return;
      }

      // Browse pagination
      if (data.startsWith('browse_')) {
        const offset = parseInt(data.split('_')[1]);
        state.browseOffset = offset;
        await ctx.answerCallbackQuery();
        await showIdeasInline(ctx, profile.id, offset);
        return;
      }

      // Confirmation actions
      if (data === 'confirm_save' && state.pendingIdea) {
        await ctx.answerCallbackQuery({ text: 'Saving...' });
        await saveIdea(ctx, profile.id, state.pendingIdea.inputType, state.pendingIdea.text,
          ctx.callbackQuery.message?.message_id, aiService);
        state.pendingIdea = undefined;
        return;
      }

      if (data === 'confirm_discard') {
        state.pendingIdea = undefined;
        await ctx.answerCallbackQuery({ text: 'Discarded' });
        await ctx.deleteMessage();
        return;
      }

      // Idea actions
      const [action, ideaId, ...rest] = data.split(':');

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
          state.pendingEdit = { ideaId, messageId: ctx.callbackQuery.message?.message_id || 0 };
          await ctx.answerCallbackQuery();
          await ctx.reply('✏️ Send the corrected text:', { reply_markup: { force_reply: true } });
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
          const newCategory = rest.join(':');
          await updateIdea(ideaId, profile.id, { category_edited: newCategory });
          await ctx.answerCallbackQuery({ text: `→ ${newCategory}` });
          await ctx.deleteMessage();
          break;

        case 'view':
          await ctx.answerCallbackQuery();
          await showIdeaDetail(ctx, profile.id, ideaId);
          break;

        case 'cancel':
          await ctx.answerCallbackQuery();
          await ctx.deleteMessage();
          break;
      }
    } catch (error) {
      console.error('Callback error:', error);
      await ctx.answerCallbackQuery({ text: 'Error' });
    }
  });

  return bot;
}

// Helper functions
async function showIdeas(ctx: any, offset: number) {
  try {
    const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
    const ideas = await getRecentIdeas(profile.id, 10);

    if (ideas.length === 0) {
      await ctx.reply("No ideas yet. Send me something!", { reply_markup: getMainMenuKeyboard() });
      return;
    }

    const formatted = ideas.map((idea, i) => `${i + 1}. ${formatIdea(idea)}`).join('\n');
    await ctx.reply(`📋 *Recent Ideas*\n\n${formatted}`, { 
      parse_mode: 'Markdown',
      reply_markup: getMainMenuKeyboard()
    });
  } catch (error) {
    console.error('Show ideas error:', error);
    await ctx.reply('Error loading ideas.');
  }
}

async function showIdeasInline(ctx: any, profileId: string, offset: number) {
  try {
    const ideas = await getAllIdeas(profileId, 5, offset);
    const stats = await getUserStats(profileId);

    if (ideas.length === 0 && offset === 0) {
      await ctx.editMessageText(
        `📋 *My Ideas*\n\nNo ideas yet! Send me text or voice to capture your first idea.`,
        { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('« Menu', 'menu_main') }
      );
      return;
    }

    const formatted = ideas.map((idea, i) => 
      `${offset + i + 1}. ${formatIdea(idea)}`
    ).join('\n');

    const keyboard = new InlineKeyboard();
    
    // Navigation
    if (offset > 0) {
      keyboard.text('« Prev', `browse_${offset - 5}`);
    }
    if (ideas.length === 5 && offset + 5 < stats.totalIdeas) {
      keyboard.text('Next »', `browse_${offset + 5}`);
    }
    keyboard.row().text('« Menu', 'menu_main');

    await ctx.editMessageText(
      `📋 *My Ideas* (${offset + 1}-${offset + ideas.length} of ${stats.totalIdeas})\n\n${formatted}`,
      { parse_mode: 'Markdown', reply_markup: keyboard }
    );
  } catch (error) {
    console.error('Show ideas inline error:', error);
  }
}

async function showIdeaDetail(ctx: any, profileId: string, ideaId: string) {
  // TODO: Implement detailed view
}

async function showStats(ctx: any) {
  try {
    const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
    const stats = await getUserStats(profile.id);

    let message = `📊 *Your Stats*\n\n`;
    message += `Total: ${stats.totalIdeas} ideas\n`;
    message += `This month: ${stats.thisMonth}\n`;

    if (stats.topCategories.length > 0) {
      message += `\n*Top Categories:*\n`;
      stats.topCategories.slice(0, 5).forEach((cat) => {
        message += `• ${cat.name}: ${cat.count}\n`;
      });
    }

    await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard() });
  } catch (error) {
    await ctx.reply('Error loading stats.');
  }
}

async function showStatsInline(ctx: any, profileId: string) {
  try {
    const stats = await getUserStats(profileId);

    let message = `📊 *Your Stats*\n\n`;
    message += `Total: ${stats.totalIdeas} ideas\n`;
    message += `This month: ${stats.thisMonth}\n`;

    if (stats.topCategories.length > 0) {
      message += `\n*Top Categories:*\n`;
      stats.topCategories.slice(0, 5).forEach((cat) => {
        message += `• ${cat.name}: ${cat.count}\n`;
      });
    }

    await ctx.editMessageText(message, { 
      parse_mode: 'Markdown', 
      reply_markup: new InlineKeyboard().text('« Menu', 'menu_main') 
    });
  } catch (error) {
    console.error('Stats error:', error);
  }
}

async function showHelp(ctx: any) {
  await ctx.reply(
    `❓ *Help*\n\n` +
    `*Capture ideas:*\n` +
    `• Send text or voice → Saved automatically\n` +
    `• Start with \`?\` → Not saved (for questions)\n\n` +
    `*Commands:*\n` +
    `/menu - Open main menu\n` +
    `/recent - Recent ideas\n` +
    `/search - Search ideas\n` +
    `/stats - Your statistics\n` +
    `/settings - Configure bot\n` +
    `/pause /resume - Control capture`,
    { parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard() }
  );
}

async function showHelpInline(ctx: any) {
  await ctx.editMessageText(
    `❓ *Help*\n\n` +
    `*Capture ideas:*\n` +
    `• Send text or voice → Saved automatically\n` +
    `• Start with \`?\` → Not saved\n\n` +
    `*Tips:*\n` +
    `• Use Settings to pause capture\n` +
    `• Use Settings for confirm mode\n` +
    `• Type /menu anytime for this menu`,
    { parse_mode: 'Markdown', reply_markup: new InlineKeyboard().text('« Menu', 'menu_main') }
  );
}

async function performSearch(ctx: any, query: string) {
  try {
    const profile = await getOrCreateProfile(ctx.from!.id, ctx.from?.username);
    const ideas = await searchIdeas(profile.id, query);

    if (ideas.length === 0) {
      await ctx.reply(`No results for "${query}"`, { reply_markup: getMainMenuKeyboard() });
      return;
    }

    const formatted = ideas.map((idea, i) => `${i + 1}. ${formatIdea(idea)}`).join('\n');
    await ctx.reply(
      `🔍 *"${query}"* - ${ideas.length} result(s)\n\n${formatted}`,
      { parse_mode: 'Markdown', reply_markup: getMainMenuKeyboard() }
    );
  } catch (error) {
    await ctx.reply('Search failed.');
  }
}

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
    `"${truncate(transcript, 150)}"\n\n` +
    `📁 ${categorization.category}  🏷️ ${categorization.tags.map(t => `#${t}`).join(' ') || '-'}`;

  if (messageId) {
    await ctx.api.editMessageText(ctx.chat.id, messageId, message, {
      parse_mode: 'Markdown', reply_markup: keyboard
    });
  } else {
    await ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}
