// Simple in-memory cache for profile images
class ImageCache {
  private cache = new Map<string, { url: string; timestamp: number }>();
  private readonly CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

  set(key: string, url: string): void {
    this.cache.set(key, {
      url,
      timestamp: Date.now(),
    });
  }

  get(key: string): string | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check if cache is still valid
    if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return cached.url;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Generate cache key for user avatar
  getUserAvatarKey(userId: string): string {
    return `avatar:${userId}`;
  }
}

// Export singleton instance
export const imageCache = new ImageCache();
