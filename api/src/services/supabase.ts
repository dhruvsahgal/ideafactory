import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Idea, Profile, Category, Insight } from '../types/index.js';

let supabase: SupabaseClient;

export function initSupabase(url: string, serviceRoleKey: string): SupabaseClient {
  supabase = createClient(url, serviceRoleKey);
  return supabase;
}

export function getSupabase(): SupabaseClient {
  if (!supabase) throw new Error('Supabase not initialized');
  return supabase;
}

export async function getOrCreateProfile(
  telegramUserId: number,
  telegramUsername?: string
): Promise<Profile> {
  const { data: existing } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('telegram_user_id', telegramUserId)
    .single();

  if (existing) return existing as Profile;

  const { data: created, error } = await getSupabase()
    .from('profiles')
    .insert({
      telegram_user_id: telegramUserId,
      telegram_username: telegramUsername,
      display_name: telegramUsername,
    })
    .select()
    .single();

  if (error) throw error;
  return created as Profile;
}

export async function createIdea(
  userId: string,
  inputType: 'voice' | 'text',
  transcript: string,
  category: string,
  confidence: number,
  tags: string[]
): Promise<Idea> {
  const { data, error } = await getSupabase()
    .from('ideas')
    .insert({
      user_id: userId,
      original_input_type: inputType,
      transcript,
      category,
      confidence_score: confidence,
      tags,
    })
    .select()
    .single();

  if (error) throw error;
  
  await updateCategoryCount(userId, category);
  await incrementIdeasThisMonth(userId);
  
  return data as Idea;
}

export async function getUserCategories(userId: string): Promise<string[]> {
  const { data } = await getSupabase()
    .from('categories')
    .select('name')
    .eq('user_id', userId);

  return data?.map(c => c.name) || [];
}

export async function updateCategoryCount(userId: string, categoryName: string): Promise<void> {
  const { data: existing } = await getSupabase()
    .from('categories')
    .select('id, idea_count')
    .eq('user_id', userId)
    .eq('name', categoryName)
    .single();

  if (existing) {
    await getSupabase()
      .from('categories')
      .update({ idea_count: (existing.idea_count || 0) + 1 })
      .eq('id', existing.id);
  } else {
    await getSupabase()
      .from('categories')
      .insert({
        user_id: userId,
        name: categoryName,
        idea_count: 1,
      });
  }
}

export async function incrementIdeasThisMonth(userId: string): Promise<void> {
  const { data } = await getSupabase()
    .from('profiles')
    .select('ideas_this_month')
    .eq('id', userId)
    .single();

  await getSupabase()
    .from('profiles')
    .update({ ideas_this_month: (data?.ideas_this_month || 0) + 1 })
    .eq('id', userId);
}

export async function getRecentIdeas(userId: string, limit = 5): Promise<Idea[]> {
  const { data, error } = await getSupabase()
    .from('ideas')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Idea[];
}

export async function searchIdeas(userId: string, query: string): Promise<Idea[]> {
  // Escape special characters for LIKE pattern
  const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');
  
  const { data, error } = await getSupabase()
    .from('ideas')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .ilike('transcript', `%${sanitizedQuery}%`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data as Idea[];
}

export async function getIdeasByCategory(userId: string, category: string): Promise<Idea[]> {
  const { data, error } = await getSupabase()
    .from('ideas')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .ilike('category', category)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data as Idea[];
}

export async function getUserStats(userId: string): Promise<{
  totalIdeas: number;
  thisMonth: number;
  topCategories: { name: string; count: number }[];
}> {
  const { count: totalIdeas } = await getSupabase()
    .from('ideas')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_archived', false);

  const { data: profile } = await getSupabase()
    .from('profiles')
    .select('ideas_this_month')
    .eq('id', userId)
    .single();

  const { data: categories } = await getSupabase()
    .from('categories')
    .select('name, idea_count')
    .eq('user_id', userId)
    .order('idea_count', { ascending: false })
    .limit(5);

  return {
    totalIdeas: totalIdeas || 0,
    thisMonth: profile?.ideas_this_month || 0,
    topCategories: categories?.map(c => ({ name: c.name, count: c.idea_count })) || [],
  };
}

export async function getIdeasForInsights(userId: string, days = 30): Promise<Idea[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await getSupabase()
    .from('ideas')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Idea[];
}

export async function updateIdea(
  ideaId: string,
  userId: string,
  updates: Partial<Pick<Idea, 'transcript_edited' | 'category_edited' | 'is_starred' | 'is_archived' | 'tags'>>
): Promise<Idea> {
  const { data, error } = await getSupabase()
    .from('ideas')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', ideaId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as Idea;
}
