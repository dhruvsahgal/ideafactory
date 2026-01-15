<script lang="ts">
  import '../app.css';
</script>

<div class="app-layout">
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
    </div>
  </header>
  
  <main class="app-main">
    <slot />
  </main>
</div>

<style>
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
  
  .app-main {
    flex: 1;
    padding: var(--space-lg) 0;
  }
</style>
