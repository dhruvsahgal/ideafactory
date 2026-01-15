import Groq from 'groq-sdk';
import OpenAI from 'openai';
import type { AIProvider, CategoryResult, InsightResult, Idea } from '../types/index.js';

const CATEGORIZE_SYSTEM_PROMPT = `You are an AI that categorizes ideas. Given an idea text and a list of existing categories, you must:
1. Assign the most appropriate category (use existing if it fits, or suggest a new one)
2. Provide a confidence score between 0 and 1
3. Extract 1-5 relevant lowercase tags

Respond in JSON format only:
{"category": "string", "confidence": 0.0-1.0, "tags": ["tag1", "tag2"]}

Default categories if none exist: Product, Business, Personal, Creative, Technical, Learning`;

const INSIGHTS_SYSTEM_PROMPT = `You're a top notch pattern recognizer, your ability to connect ideas and thoughts is one of a kind. Please help me find the links in the texts I provide.

Given the following ideas from the past 30 days, provide:
1. Three recurring themes you notice
2. Any interesting connections between seemingly unrelated ideas
3. One observation about their thinking patterns

Be specific. Reference actual ideas by quoting key phrases. Keep total response under 200 words.

Respond in JSON format only:
{"themes": ["theme1", "theme2", "theme3"], "connections": ["connection1"], "observation": "string"}`;

export class GroqProvider implements AIProvider {
  private groqClient: Groq;

  constructor(apiKey: string) {
    this.groqClient = new Groq({ apiKey });
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    const uint8Array = new Uint8Array(audioBuffer);
    const file = new File([uint8Array], 'audio.ogg', { type: 'audio/ogg' });
    const transcription = await this.groqClient.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      language: 'en',
    });
    return transcription.text;
  }

  async categorize(text: string, existingCategories: string[]): Promise<CategoryResult> {
    const categoriesContext = existingCategories.length > 0 
      ? `Existing categories: ${existingCategories.join(', ')}`
      : 'No existing categories yet.';

    const response = await this.groqClient.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: CATEGORIZE_SYSTEM_PROMPT },
        { role: 'user', content: `${categoriesContext}\n\nIdea: ${text}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from Groq');
    
    return JSON.parse(content) as CategoryResult;
  }

  async generateInsights(ideas: Idea[]): Promise<InsightResult> {
    const ideasText = ideas.map(i => 
      `[${i.created_at.split('T')[0]}] ${i.category}: ${i.transcript}`
    ).join('\n');

    const response = await this.groqClient.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
        { role: 'user', content: ideasText }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from Groq');
    
    return JSON.parse(content) as InsightResult;
  }
}

export class OpenAIProvider implements AIProvider {
  private openaiClient: OpenAI;

  constructor(apiKey: string) {
    this.openaiClient = new OpenAI({ apiKey });
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    const uint8Array = new Uint8Array(audioBuffer);
    const file = new File([uint8Array], 'audio.ogg', { type: 'audio/ogg' });
    const transcription = await this.openaiClient.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'en',
    });
    return transcription.text;
  }

  async categorize(text: string, existingCategories: string[]): Promise<CategoryResult> {
    const categoriesContext = existingCategories.length > 0 
      ? `Existing categories: ${existingCategories.join(', ')}`
      : 'No existing categories yet.';

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: CATEGORIZE_SYSTEM_PROMPT },
        { role: 'user', content: `${categoriesContext}\n\nIdea: ${text}` }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');
    
    return JSON.parse(content) as CategoryResult;
  }

  async generateInsights(ideas: Idea[]): Promise<InsightResult> {
    const ideasText = ideas.map(i => 
      `[${i.created_at.split('T')[0]}] ${i.category}: ${i.transcript}`
    ).join('\n');

    const response = await this.openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
        { role: 'user', content: ideasText }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');
    
    return JSON.parse(content) as InsightResult;
  }
}

export class AIServiceWithFallback implements AIProvider {
  private providers: AIProvider[];

  constructor(providers: AIProvider[]) {
    this.providers = providers;
  }

  private async tryWithFallback<T>(
    operation: (provider: AIProvider) => Promise<T>
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (const provider of this.providers) {
      try {
        return await operation(provider);
      } catch (error) {
        lastError = error as Error;
        console.error(`Provider failed, trying next:`, error);
      }
    }
    
    throw lastError || new Error('All providers failed');
  }

  async transcribe(audioBuffer: Buffer): Promise<string> {
    return this.tryWithFallback(p => p.transcribe(audioBuffer));
  }

  async categorize(text: string, existingCategories: string[]): Promise<CategoryResult> {
    return this.tryWithFallback(p => p.categorize(text, existingCategories));
  }

  async generateInsights(ideas: Idea[]): Promise<InsightResult> {
    return this.tryWithFallback(p => p.generateInsights(ideas));
  }
}
