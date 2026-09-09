import { apiClient } from './api';

class ClientState {
  private static instance: ClientState;
  private listeners: Map<string, Set<() => void>> = new Map();
  
  private _currency: number = 0;
  private _userStatus: string = 'STANDARD';
  private _userAchievements: any[] = [];
  private _achievements: any[] = [];
  private _initialized: boolean = false;
  private _initPromise: Promise<void> | null = null;
  
  static getInstance() {
    if (!ClientState.instance) {
      ClientState.instance = new ClientState();
    }
    return ClientState.instance;
  }
  
  subscribe(key: string, callback: () => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);
    return () => this.listeners.get(key)!.delete(callback);
  }
  
  private notify(key: string) {
    this.listeners.get(key)?.forEach(cb => cb());
  }
  
  async initialize() {
    if (this._initPromise) {
      return this._initPromise;
    }
    
    if (this._initialized) {
      return Promise.resolve();
    }
    
    this._initPromise = this._doInitialize();
    return this._initPromise;
  }
  
  private async _doInitialize() {
    try {
      const data = await apiClient.getAllUserData();
      
      this._currency = data?.currency ?? 0;
      this._userStatus = data?.userStatus ?? 'STANDARD';
      this._userAchievements = data?.userAchievements ?? [];
      this._achievements = data?.achievements ?? [];
      this._initialized = true;
      
      this.notify('all');
      this.notify('currency');
      this.notify('achievements');
    } catch (error) {
      console.warn('Failed to initialize client state, using defaults');
      this._currency = 0;
      this._userStatus = 'STANDARD';
      this._userAchievements = [];
      this._achievements = [];
      this._initialized = true;
    } finally {
      this._initPromise = null;
    }
  }
  
  // Getters
  get currency() { return this._currency; }
  get userStatus() { return this._userStatus; }
  get userAchievements() { return this._userAchievements; }
  get achievements() { return this._achievements; }
  get isInitialized() { return this._initialized; }
  
  // Setters - These should ONLY be used for non-purchase operations
  addCurrency(amount: number) {
    this._currency = Math.round((this._currency + amount) * 100) / 100;
    this.notify('currency');
    apiClient.updateCurrency(amount).catch(() => {
      this._currency = Math.round((this._currency - amount) * 100) / 100;
      this.notify('currency');
    });
  }
  
  setCurrency(amount: number) {
    this._currency = Math.round(amount * 100) / 100;
    this.notify('currency');
  }
  
  async refreshCurrency() {
    try {
      const data = await apiClient.getCurrency();
      this._currency = data?.currency ?? 0;
      this.notify('currency');
      return this._currency;
    } catch (error) {
      console.warn('Failed to refresh currency');
      return this._currency;
    }
  }
  
  updateAchievementProgress(achievementId: number, progress: number, isComplete: boolean) {
    const existing = this._userAchievements.find(a => a.achievement_id === achievementId);
    if (existing) {
      existing.progress = progress;
      if (isComplete && !existing.completed_at) {
        existing.completed_at = new Date().toISOString();
      }
    } else {
      this._userAchievements.push({
        achievement_id: achievementId,
        progress: progress,
        completed_at: isComplete ? new Date().toISOString() : null
      });
    }
    this.notify('achievements');
  }
  
  getUserProgress(achievementId: number) {
    const userAchievement = this._userAchievements.find(ua => ua.achievement_id === achievementId);
    return userAchievement || { progress: 0, completed_at: null };
  }
  
  async refresh() {
    try {
      const data = await apiClient.getAllUserData();
      this._currency = data?.currency ?? 0;
      this._userStatus = data?.userStatus ?? 'STANDARD';
      this._userAchievements = data?.userAchievements ?? [];
      this._achievements = data?.achievements ?? [];
      this.notify('all');
      this.notify('currency');
      this.notify('achievements');
    } catch (error) {
      console.warn('Failed to refresh client state');
    }
  }
}

export const clientState = ClientState.getInstance();