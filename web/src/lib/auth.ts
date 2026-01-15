import { writable } from 'svelte/store';
import { browser } from '$app/environment';

interface User {
  id: string;
  telegramUserId: number;
  username?: string;
  displayName: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
}

const initialState: AuthState = {
  user: null,
  token: null,
  loading: true,
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,
    
    init() {
      if (!browser) return;
      
      const token = localStorage.getItem('auth_token');
      const userJson = localStorage.getItem('auth_user');
      
      if (token && userJson) {
        try {
          const user = JSON.parse(userJson);
          set({ user, token, loading: false });
        } catch {
          this.logout();
        }
      } else {
        set({ user: null, token: null, loading: false });
      }
    },
    
    setAuth(token: string, user: User) {
      if (browser) {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('auth_user', JSON.stringify(user));
      }
      set({ user, token, loading: false });
    },
    
    logout() {
      if (browser) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
      set({ user: null, token: null, loading: false });
    },
    
    getToken(): string | null {
      if (!browser) return null;
      return localStorage.getItem('auth_token');
    }
  };
}

export const auth = createAuthStore();

// API helper with auth
export async function apiCall<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<T> {
  const token = auth.getToken();
  // Remove trailing slash from API URL
  const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  
  const response = await fetch(`${apiUrl}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  
  if (response.status === 401) {
    auth.logout();
    throw new Error('Unauthorized');
  }
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  
  return response.json();
}
