const pendingRequests = new Map();
const requestCache = new Map();
const CACHE_TTL = 30000;

async function dedupeRequest(key: string, requestFn: () => Promise<any>, useCache = false) {
  // Check cache first
  if (useCache && requestCache.has(key)) {
    const { data, timestamp } = requestCache.get(key);
    if (Date.now() - timestamp < CACHE_TTL) {
      return data;
    }
    requestCache.delete(key);
  }
  
  // Check for pending request
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key);
  }
  
  const promise = requestFn().finally(() => {
    pendingRequests.delete(key);
  });
  
  pendingRequests.set(key, promise);
  const result = await promise;
  
  if (useCache) {
    requestCache.set(key, { data: result, timestamp: Date.now() });
  }
  
  return result;
}

async function retryRequest<T>(fn: () => Promise<T>, retries = 2, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(fn, retries - 1, delay);
    }
    throw error;
  }
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      credentials: 'include',
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export const apiClient = {
  
  async userLogin() {
    const response = await fetchWithTimeout(`/api/user-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return response.json();
  },

  async updateCurrency(amount: number) {
    const response = await fetchWithTimeout(`/api/user/currency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amount })
    });
    return response.json();
  },

  async getCurrency() {
    try {
      const response = await fetchWithTimeout(`/api/user/currency`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('Failed to fetch currency');
      return { currency: 0 };
    }
  },

  async getInventory() {
    const response = await fetchWithTimeout(`/api/user/inventory`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getCards() {
    const response = await fetchWithTimeout(`/api/cards`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getCollection() {
    const response = await fetchWithTimeout(`/api/user/collection`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getAchievements() {
    return dedupeRequest('achievements', async () => {
      const response = await fetchWithTimeout(`/api/achievements`, {
        credentials: 'include',
      });
      return response.json();
    }, true);
  },

  async getUserAchievements() {
    return dedupeRequest('userAchievements', async () => {
      const response = await fetchWithTimeout(`/api/user/achievements`, {
        credentials: 'include',
      });
      return response.json();
    }, true);
  },

  // Use for critical methods:
  async getUserStats() {
    return retryRequest(async () => {
      const response = await fetchWithTimeout(`/api/user/stats`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
  },

  async refreshAll() {      // update this as i go
    const [currency, stats, achievements, userAchievements] = await Promise.all([
      this.getCurrency(),
      this.getUserStats(),
      this.getAchievements(),
      this.getUserAchievements()
    ]);
    return { currency, stats, achievements, userAchievements };
  },

  async getPacks() {
    const response = await fetchWithTimeout(`/api/packs`, {
      credentials: 'include',
    });
    return response.json();
  },

  async openPack(packId: number) {
    const response = await fetch(`/api/gacha/pack`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ packId })
    });
    return response.json();
  },

  async sellCard(cardId: number) {
    const response = await fetchWithTimeout(`/api/cards/sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cardId })
    });
    return response.json();
  },

  async toggleFavorite(cardId: number, isFavourited: boolean) {
    const response = await fetchWithTimeout(`/api/cards/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cardId, isFavourited })
    });
    return response.json();
  },

  async getFavorites() {
    const response = await fetchWithTimeout(`/api/cards/favorites`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getUserStatus() {
    const response = await fetchWithTimeout(`/api/user/status`, {
      credentials: 'include',
    });
    return response.json();
  },

  async checkCardCompletion(cardTemplateId: number) {
    const response = await fetchWithTimeout(`/api/user/check-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cardTemplateId })
    });
    return response.json();
  },

  async batchSellCards(cardIds: number[]) {
    const response = await fetchWithTimeout(`/api/cards/batch-sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cardIds })
    });
    return response.json();
  },

  async getShopItems() {
    const response = await fetchWithTimeout(`/api/shop/items`, {
      credentials: 'include',
    });
    return response.json();
  },

  async purchaseShopItem(data: { itemId: number; quality?: string; enhancement?: string; price?: number; slotId?: number }) {
    const response = await fetchWithTimeout(`/api/shop/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async sellInventoryItem(inventoryId: number) {
    const response = await fetchWithTimeout(`/api/inventory/sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ inventoryId })
    });
    return response.json();
  },

  async getPurchasedSlots() {
    const response = await fetchWithTimeout(`/api/shop/purchases`, {
      credentials: 'include',
    });
    return response.json();
  },

  async refreshCardCache() {
    const response = await fetch(`/api/refresh-card-cache`, {
      method: 'POST',
      credentials: 'include',
    });
    return response.json();
  },
};