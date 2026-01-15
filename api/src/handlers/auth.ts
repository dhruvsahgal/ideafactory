import { Request, Response } from 'express';
import crypto from 'crypto';
import { getOrCreateProfile } from '../services/supabase.js';

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  const { hash, ...authData } = data;
  
  // Create data check string (sorted alphabetically)
  const dataCheckArr = Object.entries(authData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);
  const dataCheckString = dataCheckArr.join('\n');
  
  // Create secret key from bot token
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  
  // Calculate HMAC
  const hmac = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  // Verify hash matches
  if (hmac !== hash) {
    return false;
  }
  
  // Check auth_date is not too old (allow 1 day)
  const now = Math.floor(Date.now() / 1000);
  if (now - data.auth_date > 86400) {
    return false;
  }
  
  return true;
}

export function createAuthHandler(botToken: string) {
  return async (req: Request, res: Response) => {
    try {
      const authData = req.body as TelegramAuthData;
      
      // Validate required fields
      if (!authData.id || !authData.hash || !authData.auth_date) {
        return res.status(400).json({ error: 'Missing required auth fields' });
      }
      
      // Verify Telegram auth data
      if (!verifyTelegramAuth(authData, botToken)) {
        return res.status(401).json({ error: 'Invalid auth data' });
      }
      
      // Get or create profile
      const displayName = authData.username || 
        `${authData.first_name}${authData.last_name ? ' ' + authData.last_name : ''}`;
      
      const profile = await getOrCreateProfile(authData.id, authData.username);
      
      // Create a simple session token (in production, use proper JWT)
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const sessionData = {
        token: sessionToken,
        profileId: profile.id,
        telegramUserId: authData.id,
        username: authData.username,
        displayName,
        expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      };
      
      // Store session in memory (in production, use Redis or database)
      sessions.set(sessionToken, sessionData);
      
      res.json({
        success: true,
        token: sessionToken,
        profile: {
          id: profile.id,
          telegramUserId: authData.id,
          username: authData.username,
          displayName,
        },
      });
    } catch (error) {
      console.error('Auth error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  };
}

// Simple in-memory session store (use Redis in production)
const sessions = new Map<string, {
  token: string;
  profileId: string;
  telegramUserId: number;
  username?: string;
  displayName: string;
  expiresAt: number;
}>();

export function getSession(token: string) {
  const session = sessions.get(token);
  if (!session) return null;
  
  // Check expiry
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  
  return session;
}

export function createAuthMiddleware() {
  return (req: Request, res: Response, next: Function) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.slice(7);
    const session = getSession(token);
    
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    // Attach session to request
    (req as any).session = session;
    next();
  };
}

export function createLogoutHandler() {
  return (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      sessions.delete(token);
    }
    res.json({ success: true });
  };
}

export function createMeHandler() {
  return (req: Request, res: Response) => {
    const session = (req as any).session;
    res.json({
      id: session.profileId,
      telegramUserId: session.telegramUserId,
      username: session.username,
      displayName: session.displayName,
    });
  };
}
