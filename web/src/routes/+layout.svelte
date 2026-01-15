<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { auth } from '$lib/auth';
  import '../app.css';
  
  let user: any = null;
  let loading = true;
  
  onMount(() => {
    auth.init();
    const unsubscribe = auth.subscribe(state => {
      user = state.user;
      loading = state.loading;
      
      // Redirect to login if not authenticated (except on login page)
      if (!state.loading && !state.user && $page.url.pathname !== '/login') {
        goto('/login');
      }
    });
    
    return unsubscribe;
  });
  
  function handleLogout() {
    auth.logout();
    goto('/login');
  }
</script>

{#if loading}
  <div class="loading-screen">
    <div class="spinner"></div>
  </div>
{:else if user || $page.url.pathname === '/login'}
  <div class="app-layout">
    {#if user}
      <header class="app-header">
        <div class="container header-content">
          <a href="/" class="logo">
            <span class="logo-icon">💡</span>
            <span class="logo-text">IdeaFactory</span>
          </a>
          <nav class="nav">
            <a href="/" class="nav-link">Ideas</a>
            <a href="/insights" class="nav-link">Insights</a>
          </nav>
          <div class="user-menu">
            <span class="username">@{user.username || user.displayName}</span>
            <button class="btn btn-ghost btn-sm" on:click={handleLogout}>Logout</button>
          </div>
        </div>
      </header>
    {/if}
    
    <main class="app-main">
      <slot />
    </main>
  </div>
{/if}

<style>
  .loading-screen {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .app-layout {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  .app-header {
    background: var(--color-bg-elevated);
    border-bottom: 1px solid var(--color-border-light);
    position: sticky;
    top: 0;
    z-index: 100;
  }
  
  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 60px;
    gap: var(--space-md);
  }
  
  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    text-decoration: none;
    color: var(--color-text);
  }
  
  .logo-icon {
    font-size: var(--text-xl);
  }
  
  .logo-text {
    font-size: var(--text-lg);
    font-weight: 600;
    letter-spacing: -0.5px;
  }
  
  .nav {
    display: flex;
    gap: var(--space-xs);
    flex: 1;
    justify-content: center;
  }
  
  .nav-link {
    padding: var(--space-sm) var(--space-md);
    color: var(--color-text-secondary);
    text-decoration: none;
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    font-weight: 500;
    transition: all var(--transition-fast);
  }
  
  .nav-link:hover {
    background: var(--color-bg-hover);
    color: var(--color-text);
    text-decoration: none;
  }
  
  .user-menu {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .username {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  
  .app-main {
    flex: 1;
    padding: var(--space-lg) 0;
  }
</style>
