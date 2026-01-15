<script lang="ts">
  import { onMount } from 'svelte';
  import { apiCall } from '$lib/auth';
  
  let loading = true;
  let generating = false;
  let error = '';
  let stats: any = null;
  let insights: {
    themes: string[];
    connections: string[];
    observation: string;
  } | null = null;
  
  onMount(async () => {
    await loadStats();
    await loadInsights();
  });
  
  async function loadStats() {
    try {
      stats = await apiCall('/api/stats');
    } catch (e: any) {
      error = e.message || 'Failed to load stats';
    }
  }
  
  async function loadInsights() {
    loading = true;
    try {
      const data = await apiCall<{ insights: any; message?: string }>('/api/insights');
      insights = data.insights;
      if (data.message) {
        error = data.message;
      }
    } catch (e: any) {
      error = e.message || 'Failed to load insights';
    } finally {
      loading = false;
    }
  }
  
  async function generateInsights() {
    generating = true;
    error = '';
    try {
      const data = await apiCall<{ insights: any; message?: string }>('/api/insights');
      insights = data.insights;
      if (data.message) {
        error = data.message;
      }
    } catch (e: any) {
      error = e.message || 'Failed to generate insights';
    } finally {
      generating = false;
    }
  }
</script>

<div class="container">
  <div class="page-header">
    <h1 class="page-title">Insights</h1>
    <p class="page-subtitle">Patterns and trends in your thinking</p>
  </div>
  
  {#if error}
    <div class="info-banner">
      {error}
    </div>
  {/if}
  
  <!-- Stats Row -->
  {#if stats}
    <div class="stats-grid">
      <div class="stat-card card">
        <div class="stat-value">{stats.totalIdeas}</div>
        <div class="stat-label">Total Ideas</div>
      </div>
      <div class="stat-card card">
        <div class="stat-value">{stats.thisMonth}</div>
        <div class="stat-label">This Month</div>
      </div>
      <div class="stat-card card">
        <div class="stat-value">{stats.topCategories?.length || 0}</div>
        <div class="stat-label">Categories</div>
      </div>
    </div>
    
    <!-- Top Categories -->
    {#if stats.topCategories && stats.topCategories.length > 0}
      <div class="card insight-card">
        <h3 class="card-title">Top Categories</h3>
        <div class="category-bars">
          {#each stats.topCategories as cat}
            {@const percent = stats.totalIdeas > 0 ? (cat.count / stats.totalIdeas) * 100 : 0}
            <div class="category-row">
              <div class="category-info">
                <span class="category-name">{cat.name}</span>
                <span class="category-count">{cat.count}</span>
              </div>
              <div class="category-bar-bg">
                <div 
                  class="category-bar" 
                  style="width: {percent}%"
                ></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  {/if}
  
  <!-- AI Insights -->
  <div class="card ai-insights-card">
    <div class="ai-insights-header">
      <div>
        <h3 class="card-title">🧠 Pattern Analysis</h3>
        <p class="card-subtitle">AI-generated insights from your ideas</p>
      </div>
      <button 
        class="btn btn-secondary"
        on:click={generateInsights}
        disabled={loading || generating}
      >
        {generating ? 'Analyzing...' : '🔄 Refresh'}
      </button>
    </div>
    
    {#if loading || generating}
      <div class="loading-insights">
        <div class="spinner"></div>
        <p>Analyzing your ideas for patterns...</p>
      </div>
    {:else if insights}
      <div class="insights-content">
        <div class="insight-section">
          <h4>📌 Recurring Themes</h4>
          <ul class="insight-list">
            {#each insights.themes as theme}
              <li>{theme}</li>
            {/each}
          </ul>
        </div>
        
        <div class="insight-section">
          <h4>🔗 Connections</h4>
          <ul class="insight-list">
            {#each insights.connections as connection}
              <li>{connection}</li>
            {/each}
          </ul>
        </div>
        
        <div class="insight-section">
          <h4>💡 Observation</h4>
          <p class="observation">{insights.observation}</p>
        </div>
      </div>
    {:else}
      <div class="empty-insights">
        <p>No insights available yet. Capture more ideas to see patterns!</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .page-header {
    margin-bottom: var(--space-lg);
  }
  
  .page-title {
    font-size: var(--text-2xl);
    font-weight: 600;
    margin-bottom: var(--space-xs);
  }
  
  .page-subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  
  .info-banner {
    padding: var(--space-sm) var(--space-md);
    background: var(--color-warning-light);
    color: var(--color-warning);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-lg);
    font-size: var(--text-sm);
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }
  
  .stat-card {
    padding: var(--space-md);
    text-align: center;
  }
  
  .stat-value {
    font-size: var(--text-3xl);
    font-weight: 700;
    color: var(--color-text);
    line-height: 1;
  }
  
  .stat-label {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    margin-top: var(--space-xs);
  }
  
  .insight-card {
    padding: var(--space-md);
    margin-bottom: var(--space-lg);
  }
  
  .card-title {
    font-size: var(--text-base);
    font-weight: 600;
    margin-bottom: var(--space-md);
  }
  
  .card-subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  
  .category-bars {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .category-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .category-info {
    display: flex;
    justify-content: space-between;
    font-size: var(--text-sm);
  }
  
  .category-name {
    color: var(--color-text);
  }
  
  .category-count {
    color: var(--color-text-muted);
  }
  
  .category-bar-bg {
    height: 8px;
    background: var(--color-bg-hover);
    border-radius: var(--radius-full);
    overflow: hidden;
  }
  
  .category-bar {
    height: 100%;
    background: var(--color-primary);
    border-radius: var(--radius-full);
    transition: width 0.5s ease;
  }
  
  .ai-insights-card {
    padding: var(--space-lg);
  }
  
  .ai-insights-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
    gap: var(--space-md);
  }
  
  .loading-insights, .empty-insights {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-xl);
    color: var(--color-text-secondary);
    text-align: center;
  }
  
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: var(--space-md);
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .insights-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }
  
  .insight-section h4 {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: var(--space-sm);
  }
  
  .insight-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .insight-list li {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    padding-left: var(--space-md);
    position: relative;
    line-height: 1.6;
  }
  
  .insight-list li::before {
    content: '•';
    position: absolute;
    left: 0;
    color: var(--color-primary);
  }
  
  .observation {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    line-height: 1.6;
    padding: var(--space-md);
    background: var(--color-bg);
    border-radius: var(--radius-md);
    border-left: 3px solid var(--color-primary);
  }
</style>
