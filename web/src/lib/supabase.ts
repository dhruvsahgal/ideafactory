import { createClient } from '@supabase/supabase-js';
import { browser } from '$app/environment';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = browser 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export type Idea = {
  id: string;
  user_id: string;
  original_input_type: 'voice' | 'text';
  transcript: string;
  transcript_edited?: string;
  category: string;
  category_edited?: string;
  confidence_score?: number;
  tags: string[];
  is_archived: boolean;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color?: string;
  idea_count: number;
};

export type Profile = {
  id: string;
  telegram_user_id: number;
  telegram_username?: string;
  display_name?: string;
  ideas_this_month: number;
};
