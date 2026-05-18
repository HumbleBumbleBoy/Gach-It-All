const getApiBaseUrl = () => {
  if (import.meta.env.PROD) {
    return '';
  }
  // In development, point to your Express server
  return 'http://localhost:3000';
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
};