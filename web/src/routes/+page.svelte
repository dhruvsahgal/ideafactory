<script lang="ts">
  import { onMount } from 'svelte';
  import { auth, apiCall } from '$lib/auth';
  import type { Idea, Category } from '$lib/supabase';
  
  let ideas: Idea[] = [];
  let categories: string[] = [];
  let loading = true;
  let error = '';
  let searchQuery = '';
  let selectedCategory: string | null = null;
  let showStarredOnly = false;
  let sortBy: 'newest' | 'oldest' = 'newest';
  
  // Edit modal state
  let editingIdea: Idea | null = null;
  let editTranscript = '';
  let editCategory = '';
  let editTags = '';
  let saving = false;
  
  onMount(async () => {
    await loadIdeas();
    await loadCategories();
  });
  
  async function loadIdeas() {
    loading = true;
    error = '';
    
    try {
      let endpoint = '/api/ideas';
      const params = new URLSearchParams();
      
      if (searchQuery) params.set('search', searchQuery);
      if (selectedCategory) params.set('category', selectedCategory);
      
      if (params.toString()) endpoint += '?' + params.toString();
      
      const data = await apiCall<{ ideas: Idea[] }>(endpoint);
      ideas = data.ideas || [];
    } catch (e: any) {
      error = e.message || 'Failed to load ideas';
    } finally {
      loading = false;
    }
  }
  
  async function loadCategories() {
    try {
      const data = await apiCall<{ categories: string[] }>('/api/categories');
      categories = data.categories || [];
    } catch (e) {
      console.error('Failed to load categories:', e);
    }
  }
  
  $: filteredIdeas = (() => {
    let result = ideas;
    
    if (showStarredOnly) {
      result = result.filter(idea => idea.is_starred);
    }
    
    result = [...result].sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
    });
    
    return result;
  })();
  
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  
  function openEditModal(idea: Idea) {
    editingIdea = idea;
    editTranscript = idea.transcript_edited || idea.transcript;
    editCategory = idea.category_edited || idea.category;
    editTags = idea.tags.join(', ');
  }
  
  function closeEditModal() {
    editingIdea = null;
    saving = false;
  }
  
  async function saveEdit() {
    if (!editingIdea) return;
    saving = true;
    
    try {
      await apiCall(`/api/ideas/${editingIdea.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          transcript_edited: editTranscript,
          category_edited: editCategory,
          tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
        }),
      });
      
      // Update local state
      ideas = ideas.map(idea => {
        if (idea.id === editingIdea?.id) {
          return {
            ...idea,
            transcript_edited: editTranscript,
            category_edited: editCategory,
            tags: editTags.split(',').map(t => t.trim()).filter(Boolean),
          };
        }
        return idea;
      });
      
      closeEditModal();
    } catch (e: any) {
      error = e.message || 'Failed to save';
      saving = false;
    }
  }
  
  async function toggleStar(idea: Idea) {
    try {
      await apiCall(`/api/ideas/${idea.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_starred: !idea.is_starred }),
      });
      
      ideas = ideas.map(i => {
        if (i.id === idea.id) {
          return { ...i, is_starred: !i.is_starred };
        }
        return i;
      });
    } catch (e) {
      console.error('Failed to toggle star:', e);
    }
  }
  
  async function archiveIdea(idea: Idea) {
    try {
      await apiCall(`/api/ideas/${idea.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_archived: true }),
      });
      
      ideas = ideas.filter(i => i.id !== idea.id);
    } catch (e) {
      console.error('Failed to archive:', e);
    }
  }
  
  function handleSearch() {
    loadIdeas();
  }
  
  function handleCategoryChange() {
    loadIdeas();
  }
</script>

<div class="container">
  <div class="page-header">
    <h1 class="page-title">Your Ideas</h1>
    <p class="page-subtitle">{filteredIdeas.length} ideas captured</p>
  </div>
  
  <div class="filters-bar">
    <form class="search-wrapper" on:submit|preventDefault={handleSearch}>
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      <input 
        type="text" 
        class="input search-input" 
        placeholder="Search ideas..."
        bind:value={searchQuery}
        on:keyup={(e) => e.key === 'Enter' && handleSearch()}
      />
    </form>
    
    <div class="filter-buttons">
      <select class="input filter-select" bind:value={selectedCategory} on:change={handleCategoryChange}>
        <option value={null}>All Categories</option>
        {#each categories as category}
          <option value={category}>{category}</option>
        {/each}
      </select>
      
      <button 
        class="btn btn-secondary filter-btn"
        class:active={showStarredOnly}
        on:click={() => showStarredOnly = !showStarredOnly}
      >
        ⭐ Starred
      </button>
      
      <select class="input filter-select" bind:value={sortBy}>
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </div>
  </div>
  
  {#if error}
    <div class="error-banner">
      {error}
      <button class="btn btn-ghost btn-sm" on:click={() => error = ''}>✕</button>
    </div>
  {/if}
  
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading your ideas...</p>
    </div>
  {:else if filteredIdeas.length === 0}
    <div class="empty-state card">
      <div class="empty-icon">💭</div>
      <h3>No ideas found</h3>
      <p>Start capturing ideas through the Telegram bot!</p>
    </div>
  {:else}
    <div class="ideas-grid">
      {#each filteredIdeas as idea (idea.id)}
        <article class="idea-card card">
          <div class="idea-header">
            <span class="category-badge" data-category={(idea.category_edited || idea.category).toLowerCase()}>
              {idea.category_edited || idea.category}
            </span>
            <div class="idea-meta">
              <span class="idea-type" title={idea.original_input_type === 'voice' ? 'Voice note' : 'Text'}>
                {idea.original_input_type === 'voice' ? '🎤' : '✍️'}
              </span>
              <span class="idea-date">{formatDate(idea.created_at)}</span>
            </div>
          </div>
          
          <p class="idea-transcript">
            {idea.transcript_edited || idea.transcript}
          </p>
          
          {#if idea.tags && idea.tags.length > 0}
            <div class="idea-tags">
              {#each idea.tags as tag}
                <span class="tag">#{tag}</span>
              {/each}
            </div>
          {/if}
          
          <div class="idea-actions">
            <button 
              class="btn btn-ghost btn-sm"
              class:starred={idea.is_starred}
              on:click={() => toggleStar(idea)}
            >
              {idea.is_starred ? '⭐' : '☆'}
            </button>
            <button class="btn btn-ghost btn-sm" on:click={() => openEditModal(idea)}>
              ✏️ Edit
            </button>
            <button class="btn btn-ghost btn-sm" on:click={() => archiveIdea(idea)}>
              🗑️
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<!-- Edit Modal -->
{#if editingIdea}
  <div class="modal-overlay" on:click={closeEditModal} on:keydown={(e) => e.key === 'Escape' && closeEditModal()} role="button" tabindex="0">
    <div class="modal card" on:click|stopPropagation on:keydown|stopPropagation role="dialog">
      <div class="modal-header">
        <h2>Edit Idea</h2>
        <button class="btn btn-ghost" on:click={closeEditModal}>✕</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label for="transcript">Transcript</label>
          <textarea 
            id="transcript" 
            class="input textarea" 
            rows="4"
            bind:value={editTranscript}
          ></textarea>
        </div>
        
        <div class="form-group">
          <label for="category">Category</label>
          <select id="category" class="input" bind:value={editCategory}>
            {#each categories as category}
              <option value={category}>{category}</option>
            {/each}
            <option value="Product">Product</option>
            <option value="Business">Business</option>
            <option value="Personal">Personal</option>
            <option value="Creative">Creative</option>
            <option value="Technical">Technical</option>
            <option value="Learning">Learning</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="tags">Tags (comma-separated)</label>
          <input 
            id="tags" 
            type="text" 
            class="input" 
            placeholder="tag1, tag2, tag3"
            bind:value={editTags}
          />
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="btn btn-secondary" on:click={closeEditModal} disabled={saving}>Cancel</button>
        <button class="btn btn-primary" on:click={saveEdit} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .page-header {
    margin-bottom: var(--space-lg);
  }
  
  .page-title {
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--color-text);
    margin-bottom: var(--space-xs);
  }
  
  .page-subtitle {
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
  }
  
  .filters-bar {
    display: flex;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
    flex-wrap: wrap;
  }
  
  .search-wrapper {
    position: relative;
    flex: 1;
    min-width: 200px;
  }
  
  .search-icon {
    position: absolute;
    left: var(--space-md);
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    color: var(--color-text-muted);
  }
  
  .search-input {
    padding-left: 44px;
  }
  
  .filter-buttons {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }
  
  .filter-select {
    width: auto;
    min-width: 140px;
  }
  
  .filter-btn.active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  
  .error-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-danger-light);
    color: var(--color-danger);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-md);
    font-size: var(--text-sm);
  }
  
  .ideas-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: var(--space-md);
  }
  
  .idea-card {
    padding: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    transition: box-shadow var(--transition-fast);
  }
  
  .idea-card:hover {
    box-shadow: var(--shadow-md);
  }
  
  .idea-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .idea-meta {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-xs);
    color: var(--color-text-muted);
  }
  
  .idea-transcript {
    font-size: var(--text-sm);
    color: var(--color-text);
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .idea-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs);
  }
  
  .idea-actions {
    display: flex;
    gap: var(--space-xs);
    margin-top: auto;
    padding-top: var(--space-sm);
    border-top: 1px solid var(--color-border-light);
  }
  
  .idea-actions .starred {
    color: var(--color-warning);
  }
  
  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl);
    text-align: center;
    color: var(--color-text-secondary);
  }
  
  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--space-md);
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
  
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-md);
    z-index: 200;
  }
  
  .modal {
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    border-bottom: 1px solid var(--color-border-light);
  }
  
  .modal-header h2 {
    font-size: var(--text-lg);
    font-weight: 600;
  }
  
  .modal-body {
    padding: var(--space-md);
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-sm);
    padding: var(--space-md);
    border-top: 1px solid var(--color-border-light);
  }
  
  .form-group {
    margin-bottom: var(--space-md);
  }
  
  .form-group label {
    display: block;
    font-size: var(--text-sm);
    font-weight: 500;
    margin-bottom: var(--space-xs);
    color: var(--color-text-secondary);
  }
  
  .textarea {
    resize: vertical;
    min-height: 100px;
    font-family: inherit;
  }
</style>
