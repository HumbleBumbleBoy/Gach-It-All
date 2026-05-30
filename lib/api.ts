export const apiClient = {
  async userLogin() {
    const response = await fetch(`/api/user-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return response.json();
  },

  async updateCurrency(amount: number) {
    const response = await fetch(`/api/user/currency`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ amount })
    });
    return response.json();
  },

  async getCurrency() {
    try {
      const response = await fetch(`/api/user/currency`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch currency:', error);
      return { currency: 0 };
    }
  },

  async getInventory() {
    const response = await fetch(`/api/user/inventory`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getCards() {
    const response = await fetch(`/api/cards`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getCollection() {
    const response = await fetch(`/api/user/collection`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getAchievements() {
    const response = await fetch(`/api/achievements`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getUserAchievements() {
    const response = await fetch(`/api/user/achievements`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getUserStats() {
    const response = await fetch(`/api/user/stats`, {
      credentials: 'include',
    });
    return response.json();
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
    const response = await fetch(`/api/packs`, {
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
    const response = await fetch(`/api/cards/sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cardId })
    });
    return response.json();
  },

  async toggleFavorite(cardId: number, isFavourited: boolean) {
    const response = await fetch(`/api/cards/favorite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cardId, isFavourited })
    });
    return response.json();
  },

  async getFavorites() {
    const response = await fetch(`/api/cards/favorites`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getUserStatus() {
    const response = await fetch(`/api/user/status`, {
      credentials: 'include',
    });
    return response.json();
  },

  async checkCardCompletion(cardTemplateId: number) {
    const response = await fetch(`/api/user/check-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cardTemplateId })
    });
    return response.json();
  },

  async batchSellCards(cardIds: number[]) {
    const response = await fetch(`/api/cards/batch-sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ cardIds })
    });
    return response.json();
  },

  async getShopItems() {
    const response = await fetch(`/api/shop/items`, {
      credentials: 'include',
    });
    return response.json();
  },

  async purchaseShopItem(data: { itemId: number; quality?: string; enhancement?: string; price?: number; slotId?: number }) {
    const response = await fetch(`/api/shop/purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return response.json();
  },

  async sellInventoryItem(inventoryId: number) {
    const response = await fetch(`/api/inventory/sell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ inventoryId })
    });
    return response.json();
  },

  async getPurchasedSlots() {
    const response = await fetch(`/api/shop/purchases`, {
      credentials: 'include',
    });
    return response.json();
  },
};