export const apiClient = {
  async userLogin() {
    const response = await fetch(`/api/user-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
};