const getApiBaseUrl = () => {
  if (import.meta.env.DEV) {
    return 'http://localhost:3000';  // Use express in dev
  }
  return '';  // Use prod origin
};

export const apiClient = {
  async userLogin() {
    const response = await fetch(`${getApiBaseUrl()}/api/user-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    return response.json();
  },
  
  async getCurrency() {
    const response = await fetch(`${getApiBaseUrl()}/api/user/currency`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getInventory() {
    const response = await fetch(`${getApiBaseUrl()}/api/user/inventory`, {
      credentials: 'include',
    });
    return response.json();
  },

  async getCollection() {
    const response = await fetch(`${getApiBaseUrl()}/api/user/collection`, {
      credentials: 'include',
    });
    return response.json();
  },

};