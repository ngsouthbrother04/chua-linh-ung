/**
 * Frontend API Client for Phố Ẩm Thực Website
 * Handles all HTTP requests to the backend API
 */

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:3000";

// Utility: Get or create device ID
function getDeviceId() {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId =
      "web-" + Math.random().toString(36).substr(2, 9) + "-" + Date.now();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

// Utility: Get stored tokens
function getTokens() {
  return {
    accessToken: localStorage.getItem("accessToken"),
    refreshToken: localStorage.getItem("refreshToken"),
  };
}

// Utility: Store tokens
function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
}

// Utility: Clear tokens
function clearTokens() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

// Utility: Fetch with auth header
async function authFetch(url, options = {}) {
  const { accessToken } = getTokens();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If 401 and we have refresh token, try to refresh
  if (response.status === 401 && getTokens().refreshToken) {
    const refreshed = await apiClient.auth.refreshToken();
    if (refreshed.accessToken) {
      headers["Authorization"] = `Bearer ${refreshed.accessToken}`;
      return fetch(url, {
        ...options,
        headers,
      });
    }
  }

  return response;
}

export const apiClient = {
  // ==============================
  // Authentication Endpoints
  // ==============================
  auth: {
    register: async (email, password, fullName) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          deviceId: getDeviceId(),
        }),
      });
      const data = await response.json();
      if (data.accessToken) {
        setTokens(data.accessToken, data.refreshToken);
      }
      return data;
    },

    login: async (email, password) => {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          deviceId: getDeviceId(),
        }),
      });
      const data = await response.json();
      if (data.accessToken) {
        setTokens(data.accessToken, data.refreshToken);
      }
      return data;
    },

    refreshToken: async () => {
      const { refreshToken } = getTokens();
      if (!refreshToken) return null;

      const response = await fetch(
        `${API_BASE_URL}/api/v1/auth/token-refresh`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        },
      );

      const data = await response.json();
      if (data.accessToken) {
        setTokens(data.accessToken, data.refreshToken);
      } else {
        clearTokens();
      }
      return data;
    },

    logout: async () => {
      const response = await authFetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
      });
      clearTokens();
      return response.json();
    },

    initiatePayment: async (provider, amount, currency = "VND") => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/auth/payment/initiate`,
        {
          method: "POST",
          body: JSON.stringify({
            provider,
            amount,
            currency,
            deviceId: getDeviceId(),
            returnUrl: window.location.href,
          }),
        },
      );
      return response.json();
    },

    redeemClaimCode: async (code) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/auth/payment/claim`,
        {
          method: "POST",
          body: JSON.stringify({ code }),
        },
      );
      return response.json();
    },
  },

  // ==============================
  // POI Endpoints
  // ==============================
  pois: {
    getAll: async (page = 1, limit = 20) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/pois?page=${page}&limit=${limit}`,
      );
      return response.json();
    },

    getById: async (poiId) => {
      const response = await authFetch(`${API_BASE_URL}/api/v1/pois/${poiId}`);
      return response.json();
    },

    getFeatured: async (limit = 6) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/pois/featured?limit=${limit}`,
      );
      return response.json();
    },

    searchByRadius: async (latitude, longitude, radiusM, limit = 20) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/pois/search/radius`,
        {
          method: "POST",
          body: JSON.stringify({
            latitude,
            longitude,
            radiusM,
            limit,
          }),
        },
      );
      return response.json();
    },

    getByBounds: async (north, south, east, west) => {
      const response = await authFetch(`${API_BASE_URL}/api/v1/pois/bounds`, {
        method: "POST",
        body: JSON.stringify({ north, south, east, west }),
      });
      return response.json();
    },
  },

  // ==============================
  // Tour Endpoints
  // ==============================
  tours: {
    getAll: async (page = 1, limit = 20) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/tours?page=${page}&limit=${limit}`,
      );
      return response.json();
    },

    getById: async (tourId) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/tours/${tourId}`,
      );
      return response.json();
    },

    getFeatured: async (limit = 4) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/tours/featured?limit=${limit}`,
      );
      return response.json();
    },
  },

  // ==============================
  // Search Endpoints
  // ==============================
  search: {
    global: async (query, type = "poi,tour", limit = 20) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`,
      );
      return response.json();
    },
  },

  // ==============================
  // User Profile Endpoints
  // ==============================
  users: {
    getProfile: async () => {
      const response = await authFetch(`${API_BASE_URL}/api/v1/users/me`);
      return response.json();
    },

    updateProfile: async (fullName, avatar) => {
      const response = await authFetch(`${API_BASE_URL}/api/v1/users/me`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(fullName && { fullName }),
          ...(avatar && { avatar }),
        }),
      });
      return response.json();
    },

    getFavorites: async (page = 1, limit = 20) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/users/me/favorites?page=${page}&limit=${limit}`,
      );
      return response.json();
    },
  },

  // ==============================
  // Sync Endpoints
  // ==============================
  sync: {
    getManifest: async () => {
      const response = await authFetch(`${API_BASE_URL}/api/v1/sync/manifest`);
      return response.json();
    },

    getFull: async (version) => {
      const url = version
        ? `${API_BASE_URL}/api/v1/sync/full?version=${version}`
        : `${API_BASE_URL}/api/v1/sync/full`;
      const response = await authFetch(url);
      return response.json();
    },

    getIncremental: async (fromVersion) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/sync/incremental`,
        {
          method: "POST",
          body: JSON.stringify({ fromVersion }),
        },
      );
      return response.json();
    },
  },

  // ==============================
  // Analytics Endpoints
  // ==============================
  analytics: {
    submitEvents: async (events) => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/analytics/events`,
        {
          method: "POST",
          body: JSON.stringify({ events }),
        },
      );
      return response.json();
    },

    sendHeartbeat: async () => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/analytics/presence/heartbeat`,
        {
          method: "POST",
          body: JSON.stringify({
            deviceId: getDeviceId(),
            timestamp: Date.now(),
          }),
        },
      );
      return response.json();
    },

    sendOffline: async () => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/analytics/presence/offline`,
        {
          method: "POST",
          body: JSON.stringify({
            deviceId: getDeviceId(),
          }),
        },
      );
      return response.json();
    },

    getStats: async () => {
      const response = await authFetch(
        `${API_BASE_URL}/api/v1/analytics/stats`,
      );
      return response.json();
    },
  },

  // Utility methods
  getDeviceId,
  getTokens,
  setTokens,
  clearTokens,
};
