<script lang="ts">
  import { onMount } from 'svelte';
  
  let loading = false;
  let insights: {
    themes: string[];
    connections: string[];
    observation: string;
  } | null = null;
  
  const stats = {
    totalIdeas: 47,
    thisMonth: 12,
    thisWeek: 5,
    voiceRatio: 62,
  };
  
  const categoryData = [
    { name: 'Product', count: 18, color: 'var(--cat-product)' },
    { name: 'Business', count: 12, color: 'var(--cat-business)' },
    { name: 'Technical', count: 8, color: 'var(--cat-technical)' },
    { name: 'Personal', count: 5, color: 'var(--cat-personal)' },
    { name: 'Creative', count: 4, color: 'var(--cat-creative)' },
  ];
  
  const topTags = [
    { name: 'pricing', count: 8 },
    { name: 'ux', count: 7 },
    { name: 'ai', count: 6 },
    { name: 'feature', count: 5 },
    { name: 'automation', count: 4 },
    { name: 'mobile', count: 4 },
    { name: 'onboarding', count: 3 },
    { name: 'integration', count: 3 },
  ];
  
  const weeklyActivity = [
    { day: 'Mon', count: 3 },
    { day: 'Tue', count: 5 },
    { day: 'Wed', count: 2 },
    { day: 'Thu', count: 4 },
    { day: 'Fri', count: 6 },
    { day: 'Sat', count: 1 },
    { day: 'Sun', count: 2 },
  ];
  
  const maxWeekly = Math.max(...weeklyActivity.map(d => d.count));
  
  const demoInsights = {
    themes: [
      "Pricing strategy is a recurring focus - you've mentioned subscription tiers, usage-based models, and competitor pricing multiple times",
      "User experience simplification appears frequently, especially around onboarding and reducing friction",
      "AI and automation capabilities are emerging as a key interest area"
    ],
    connections: [
      "Your pricing ideas and UX simplification thoughts connect - simpler products often command premium pricing through perceived value",
      "The AI/automation interest ties to your productivity system ideas - you're thinking about augmenting human capability"
    ],
    observation: "You tend to capture more ideas in the morning and on Fridays. Your thinking alternates between strategic (business/pricing) and tactical (features/UX) modes."
  };
  
  async function generateInsights() {
    loading = true;
    await new Promise(resolve => setTimeout(resolve, 2000));
    insights = demoInsights;
    loading = false;
  }
  
  onMount(() => {
    insights = demoInsights;
  });
</script>

<div class="container">
  <div class="page-header">
    <h1 class="page-title">Insights</h1>
    <p class="page-subtitle">Patterns and trends in your thinking</p>
  </div>
  
  <div class="stats-grid">
    <div class="stat-card card">
      <div class="stat-value">{stats.totalIdeas}</div>
      <div class="stat-label">Total Ideas</div>
    </div>
    <div class="stat-card card">
      <div class="stat-value">{stats.thisMonth}</div>
      <div class="stat-label">This Month</div>
      <div class="stat-trend positive">+{stats.thisMonth - 8} vs last month</div>
    </div>
    <div class="stat-card card">
      <div class="stat-value">{stats.thisWeek}</div>
      <div class="stat-label">This Week</div>
    </div>
    <div class="stat-card card">
      <div class="stat-value">{stats.voiceRatio}%</div>
      <div class="stat-label">Voice Notes</div>
    </div>
  </div>
  
  <div class="insights-grid">
    <div class="card insight-card">
      <h3 class="card-title">Categories</h3>
      <div class="category-bars">
        {#each categoryData as cat}
          {@const percent = (cat.count / stats.totalIdeas) * 100}
          <div class="category-row">
            <div class="category-info">
              <span class="category-name">{cat.name}</span>
              <span class="category-count">{cat.count}</span>
            </div>
            <div class="category-bar-bg">
              <div 
                class="category-bar" 
                style="width: {percent}%; background: {cat.color}"
              ></div>
            </div>
          </div>
        {/each}
      </div>
    </div>
    
    <div class="card insight-card">
      <h3 class="card-title">Weekly Activity</h3>
      <div class="activity-chart">
        {#each weeklyActivity as day}
          <div class="activity-day">
            <div class="activity-bar-container">
              <div 
                class="activity-bar"
                style="height: {(day.count / maxWeekly) * 100}%"
              ></div>
            </div>
            <span class="activity-label">{day.day}</span>
          </div>
        {/each}
      </div>
    </div>
    
    <div class="card insight-card">
      <h3 class="card-title">Top Tags</h3>
      <div class="tags-cloud">
        {#each topTags as tag}
          <span 
            class="tag-item"
            style="font-size: {12 + tag.count}px; opacity: {0.5 + (tag.count / 16)}"
          >
            #{tag.name}
          </span>
        {/each}
      </div>
    </div>
  </div>
  
  <div class="card ai-insights-card">
    <div class="ai-insights-header">
      <div>
        <h3 class="card-title">🧠 Pattern Analysis</h3>
        <p class="card-subtitle">AI-generated insights from your ideas</p>
      </div>
      <button 
        class="btn btn-secondary"
        on:click={generateInsights}
        disabled={loading}
      >
        {loading ? 'Analyzing...' : '🔄 Refresh'}
      </button>
    </div>
    
    {#if loading}
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
  
  .stat-trend {
    font-size: var(--text-xs);
    margin-top: var(--space-xs);
  }
  
  .stat-trend.positive {
    color: var(--color-success);
  }
  
  .insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }
  
  .insight-card {
    padding: var(--space-md);
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
    border-radius: var(--radius-full);
    transition: width 0.5s ease;
  }
  
  .activity-chart {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    height: 120px;
    gap: var(--space-sm);
  }
  
  .activity-day {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xs);
  }
  
  .activity-bar-container {
    width: 100%;
    height: 100px;
    display: flex;
    align-items: flex-end;
  }
  
  .activity-bar {
    width: 100%;
    background: var(--color-primary);
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
    min-height: 4px;
    transition: height 0.3s ease;
  }
  
  .activity-label {
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
  
  .tags-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
    align-items: center;
    justify-content: center;
    padding: var(--space-md) 0;
  }
  
  .tag-item {
    color: var(--color-primary);
    font-weight: 500;
    transition: transform var(--transition-fast);
  }
  
  .tag-item:hover {
    transform: scale(1.1);
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
  
  .loading-insights {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-xl);
    color: var(--color-text-secondary);
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
