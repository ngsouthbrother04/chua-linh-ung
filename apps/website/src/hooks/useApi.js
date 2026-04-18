import { useState, useCallback, useEffect } from "react";
import { apiClient } from "../lib/apiClient";

/**
 * Hook for authentication management
 */
export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem("accessToken"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sync token to localStorage
  useEffect(() => {
    if (token) {
      localStorage.setItem("accessToken", token);
    } else {
      localStorage.removeItem("accessToken");
    }
  }, [token]);

  const register = useCallback(async (email, password, fullName) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.auth.register(email, password, fullName);
      if (data.accessToken) {
        setToken(data.accessToken);
        setUser(data.user);
      }
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.auth.login(email, password);
      if (data.accessToken) {
        setToken(data.accessToken);
        setUser(data.user);
      }
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await apiClient.auth.logout();
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const isAuthenticated = !!token && !!user;

  return {
    token,
    user,
    loading,
    error,
    isAuthenticated,
    register,
    login,
    logout,
  };
}

/**
 * Hook for fetching POIs
 */
export function usePois(page = 1, limit = 20) {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    apiClient.pois
      .getAll(page, limit)
      .then((res) => {
        if (res.status === "success") {
          setPois(res.data.items || res.data);
          setTotal(res.data.total || res.data.length);
        }
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [page, limit]);

  return { pois, loading, error, total };
}

/**
 * Hook for fetching featured POIs
 */
export function useFeaturedPois(limit = 6) {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient.pois
      .getFeatured(limit)
      .then((res) => {
        if (res.status === "success") {
          setPois(res.data);
        }
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [limit]);

  return { pois, loading, error };
}

/**
 * Hook for fetching single POI
 */
export function usePoi(poiId) {
  const [poi, setPoi] = useState(null);
  const [loading, setLoading] = useState(!!poiId);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!poiId) return;

    setLoading(true);
    apiClient.pois
      .getById(poiId)
      .then((res) => {
        if (res.status === "success") {
          setPoi(res.data);
        }
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [poiId]);

  return { poi, loading, error };
}

/**
 * Hook for POI search by radius
 */
export function usePoisByRadius(latitude, longitude, radiusM) {
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(
    async (lat = latitude, lng = longitude, radius = radiusM) => {
      if (!lat || !lng || !radius) return;

      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.pois.searchByRadius(lat, lng, radius);
        if (res.status === "success") {
          setPois(res.items);
        }
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (latitude && longitude && radiusM) {
      search(latitude, longitude, radiusM);
    }
  }, [latitude, longitude, radiusM, search]);

  return { pois, loading, error, search };
}

/**
 * Hook for fetching tours
 */
export function useTours(page = 1, limit = 20) {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    apiClient.tours
      .getAll(page, limit)
      .then((res) => {
        if (res.status === "success") {
          setTours(res.data.items || res.data);
          setTotal(res.data.total || res.data.length);
        }
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [page, limit]);

  return { tours, loading, error, total };
}

/**
 * Hook for fetching featured tours
 */
export function useFeaturedTours(limit = 4) {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiClient.tours
      .getFeatured(limit)
      .then((res) => {
        if (res.status === "success") {
          setTours(res.data);
        }
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [limit]);

  return { tours, loading, error };
}

/**
 * Hook for global search
 */
export function useSearch(query, type = "poi,tour", limit = 20) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = useCallback(
    async (q = query) => {
      if (!q || q.length < 2) {
        setResults(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.search.global(q, type, limit);
        if (res.status === "success") {
          setResults(res.results);
        }
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    },
    [type, limit],
  );

  useEffect(() => {
    if (query && query.length >= 2) {
      search(query);
    }
  }, [query, search]);

  return { results, loading, error, search };
}

/**
 * Hook for user profile
 */
export function useUserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.users.getProfile();
      if (res.status === "success") {
        setUser(res.data);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateProfile = useCallback(async (fullName, avatar) => {
    setLoading(true);
    try {
      const res = await apiClient.users.updateProfile(fullName, avatar);
      if (res.data) {
        setUser(res.data);
      }
      return res;
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  return { user, loading, error, refresh, updateProfile };
}

/**
 * Hook for analytics event tracking
 */
export function useAnalytics() {
  const trackEvent = useCallback(async (poiId, action, duration) => {
    try {
      await apiClient.analytics.submitEvents([
        {
          deviceId: apiClient.getDeviceId(),
          sessionId:
            sessionStorage.getItem("sessionId") || apiClient.getDeviceId(),
          poiId,
          action,
          durationMs: duration,
          timestamp: Date.now(),
        },
      ]);
    } catch (err) {
      console.error("Failed to track event:", err);
    }
  }, []);

  useEffect(() => {
    if (!sessionStorage.getItem("sessionId")) {
      sessionStorage.setItem("sessionId", "session-" + Date.now());
    }

    // Send heartbeat every 30 seconds
    const interval = setInterval(() => {
      apiClient.analytics
        .sendHeartbeat()
        .catch((err) => console.error("Heartbeat failed:", err));
    }, 30000);

    const sendOffline = () => {
      apiClient.analytics
        .sendOffline()
        .catch((err) => console.error("Offline presence failed:", err));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendOffline();
      }
    };

    window.addEventListener("pagehide", sendOffline);
    window.addEventListener("beforeunload", sendOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("pagehide", sendOffline);
      window.removeEventListener("beforeunload", sendOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      sendOffline();
    };
  }, []);

  return { trackEvent };
}
