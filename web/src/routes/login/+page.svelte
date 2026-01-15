<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { auth } from '$lib/auth';
  import { browser } from '$app/environment';
  
  const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'IdeaFactoryBot';
  // Remove trailing slash from API URL
  const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  
  let loading = false;
  let error = '';
  let widgetContainer: HTMLDivElement;
  
  onMount(() => {
    // Check if already logged in
    auth.init();
    const unsubscribe = auth.subscribe(state => {
      if (!state.loading && state.user) {
        goto('/');
      }
    });
    
    // Setup Telegram callback
    if (browser) {
      // Global callback function for Telegram Widget
      (window as any).TelegramLoginWidget = {
        dataOnauth: handleTelegramAuth
      };
      
      // Create and inject the Telegram script
      createTelegramWidget();
    }
    
    return unsubscribe;
  });
  
  function createTelegramWidget() {
    if (!widgetContainer) return;
    
    // Clear any existing content
    widgetContainer.innerHTML = '';
    
    // Create script element
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-onauth', 'TelegramLoginWidget.dataOnauth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    
    widgetContainer.appendChild(script);
  }
  
  async function handleTelegramAuth(user: any) {
    console.log('Telegram auth received:', user);
    loading = true;
    error = '';
    
    try {
      const response = await fetch(`${API_URL}/api/auth/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      
      auth.setAuth(data.token, data.profile);
      goto('/');
    } catch (e: any) {
      console.error('Auth error:', e);
      error = e.message || 'Authentication failed';
      loading = false;
    }
  }
</script>

<div class="login-page">
  <div class="login-card card">
    <div class="login-header">
      <span class="logo-icon">💡</span>
      <h1>IdeaFactory</h1>
      <p>Capture and organize your ideas</p>
    </div>
    
    {#if loading}
      <div class="loading">
        <div class="spinner"></div>
        <p>Logging in...</p>
      </div>
    {:else}
      <div class="login-content">
        <p class="login-instruction">
          Sign in with your Telegram account to access your ideas
        </p>
        
        <div class="telegram-widget" bind:this={widgetContainer}>
          <!-- Telegram widget will be injected here -->
        </div>
        
        {#if error}
          <div class="error-message">
            {error}
          </div>
        {/if}
        
        <div class="login-help">
          <p>Don't have Telegram? <a href="https://telegram.org" target="_blank" rel="noopener">Get it here</a></p>
          <p class="hint">Your ideas from the Telegram bot will sync automatically</p>
        </div>
      </div>
    {/if}
  </div>
  
  <div class="setup-note">
    <strong>Setup required:</strong> Bot owner must run <code>/setdomain</code> in @BotFather
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-md);
    background: var(--color-bg);
  }
  
  .login-card {
    width: 100%;
    max-width: 400px;
    padding: var(--space-xl);
    text-align: center;
  }
  
  .login-header {
    margin-bottom: var(--space-xl);
  }
  
  .logo-icon {
    font-size: 48px;
    display: block;
    margin-bottom: var(--space-md);
  }
  
  .login-header h1 {
    font-size: var(--text-2xl);
    font-weight: 600;
    margin-bottom: var(--space-xs);
  }
  
  .login-header p {
    color: var(--color-text-secondary);
    font-size: var(--text-sm);
  }
  
  .login-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }
  
  .login-instruction {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  
  .telegram-widget {
    display: flex;
    justify-content: center;
    min-height: 48px;
    align-items: center;
  }
  
  .error-message {
    color: var(--color-danger);
    font-size: var(--text-sm);
    padding: var(--space-sm);
    background: var(--color-danger-light);
    border-radius: var(--radius-md);
  }
  
  .login-help {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
  
  .login-help p {
    margin-bottom: var(--space-xs);
  }
  
  .hint {
    font-style: italic;
  }
  
  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-xl);
  }
  
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .setup-note {
    margin-top: var(--space-lg);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-warning-light);
    color: var(--color-text-secondary);
    border-radius: var(--radius-md);
    font-size: var(--text-xs);
  }
  
  .setup-note code {
    background: rgba(0,0,0,0.1);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--font-mono);
  }
</style>
