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
    const response = await fetch(`/api/user/currency`, {
      credentials: 'include',
    });
    return response.json();
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
};