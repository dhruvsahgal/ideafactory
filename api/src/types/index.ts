export interface Idea {
  id: string;
  user_id: string;
  original_input_type: 'voice' | 'text';
  transcript: string;
  transcript_edited?: string;
  category: string;
  category_edited?: string;
  confidence_score?: number;
  tags: string[];
  source_context?: string;
  is_archived: boolean;
  is_starred: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  telegram_user_id: number;
  telegram_username?: string;
  display_name?: string;
  ideas_this_month: number;
  confirm_mode?: boolean;
  paused?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  color?: string;
  idea_count: number;
  created_at: string;
}

export interface Insight {
  id: string;
  user_id: string;
  insight_type: 'pattern' | 'trend' | 'suggestion';
  content: Record<string, unknown>;
  generated_at: string;
  expires_at?: string;
}

export interface CategoryResult {
  category: string;
  confidence: number;
  tags: string[];
}

export interface InsightResult {
  themes: string[];
  connections: string[];
  observation: string;
}

export interface AIProvider {
  transcribe(audioBuffer: Buffer): Promise<string>;
  categorize(text: string, existingCategories: string[]): Promise<CategoryResult>;
  generateInsights(ideas: Idea[]): Promise<InsightResult>;
}
