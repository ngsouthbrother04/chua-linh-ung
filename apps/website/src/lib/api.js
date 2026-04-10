// Frontend API Client for Phố Ẩm Thực Website
function resolveApiBaseUrl() {
  const raw = (
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000"
  ).trim();

  if (raw.includes("localhost")) {
    return raw.replace("localhost", "127.0.0.1");
  }

  return raw;
}

const API_BASE_URL = resolveApiBaseUrl();

function getDeviceId() {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = "web-" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

function getAccessToken() {
  return localStorage.getItem("accessToken");
}

function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem("accessToken", accessToken);
  if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
}

async function authFetch(url, options = {}) {
  const token = getAccessToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}

// Authentication
export const authAPI = {
  register: (email, password, fullName) =>
    fetch(`${API_BASE_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        fullName,
        deviceId: getDeviceId(),
      }),
    }).then((r) => r.json()),

  login: (email, password) =>
    fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, deviceId: getDeviceId() }),
    }).then((r) => r.json()),

  changePassword: (currentPassword, newPassword) =>
    authFetch(`${API_BASE_URL}/api/v1/auth/change-password`, {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data?.message || "Failed to change password");
      }
      return data;
    }),

  logout: () =>
    authFetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: "POST" })
      .then((r) => r.json())
      .then(() => {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
      }),

  redeemClaimCode: (claimCode) =>
    authFetch(`${API_BASE_URL}/api/v1/auth/payment/claim`, {
      method: "POST",
      body: JSON.stringify({ code: claimCode }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data?.message || "Không thể dùng mã đăng ký đối tác.");
      }
      return data;
    }),
};

// Partner
export const partnerAPI = {
  submitPartnerRegistrationRequest: ({ shopName, shopAddress, note }) =>
    authFetch(`${API_BASE_URL}/api/v1/users/me/partner-registration-requests`, {
      method: "POST",
      body: JSON.stringify({ shopName, shopAddress, note }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(
          data?.message || "Không thể gửi yêu cầu đăng ký đối tác.",
        );
      }
      return data?.data;
    }),

  listMyPartnerRegistrationRequests: () =>
    authFetch(
      `${API_BASE_URL}/api/v1/users/me/partner-registration-requests`,
    ).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(
          data?.message || "Không thể tải trạng thái yêu cầu đăng ký đối tác.",
        );
      }
      return data?.data?.items ?? [];
    }),

  getLatestPartnerRegistrationRequest: () =>
    authFetch(
      `${API_BASE_URL}/api/v1/users/me/partner-registration-requests/latest`,
    ).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(
          data?.message || "Không thể tải yêu cầu đăng ký đối tác gần nhất.",
        );
      }
      return data?.data ?? null;
    }),

  getMyPois: () =>
    authFetch(`${API_BASE_URL}/api/v1/admin/pois`).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(
          data?.message || "Không thể tải danh sách POI đối tác.",
        );
      }
      return data?.items ?? [];
    }),

  createPoiRequest: (payload) =>
    authFetch(`${API_BASE_URL}/api/v1/partner/pois`, {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data?.message || "Không thể gửi yêu cầu tạo POI.");
      }
      return data;
    }),

  updatePoiRequest: (poiId, payload) =>
    authFetch(`${API_BASE_URL}/api/v1/partner/pois/${poiId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data?.message || "Không thể cập nhật POI.");
      }
      return data;
    }),

  deletePoiRequest: (poiId, reason) =>
    authFetch(`${API_BASE_URL}/api/v1/partner/pois/${poiId}`, {
      method: "DELETE",
      body: JSON.stringify({ reason }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data?.message || "Không thể xóa POI.");
      }
      return data;
    }),

  uploadPoiImage: (poiId, imageFile) => {
    const token = getAccessToken();
    const formData = new FormData();
    formData.append("image", imageFile);

    return fetch(`${API_BASE_URL}/api/v1/partner/pois/${poiId}/image/upload`, {
      method: "POST",
      headers: token
        ? {
            Authorization: `Bearer ${token}`,
          }
        : {},
      body: formData,
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data?.message || "Không thể upload ảnh POI.");
      }
      return data;
    });
  },

  listMyApprovalRequests: async () => [],
};

// POIs
export const poisAPI = {
  getAll: (page = 1, limit = 20) =>
    authFetch(`${API_BASE_URL}/api/v1/pois?page=${page}&limit=${limit}`).then(
      (r) => r.json(),
    ),

  getById: (poiId) =>
    authFetch(`${API_BASE_URL}/api/v1/pois/${poiId}`).then((r) => r.json()),

  getFeatured: (limit = 6) =>
    authFetch(`${API_BASE_URL}/api/v1/pois/featured?limit=${limit}`)
      .then((r) => r.json())
      .then((res) => res?.data ?? []),

  searchByRadius: (latitude, longitude, radiusM, limit = 20) =>
    authFetch(`${API_BASE_URL}/api/v1/pois/search/radius`, {
      method: "POST",
      body: JSON.stringify({ latitude, longitude, radiusM, limit }),
    }).then((r) => r.json()),

  getByBounds: (north, south, east, west) =>
    authFetch(`${API_BASE_URL}/api/v1/pois/bounds`, {
      method: "POST",
      body: JSON.stringify({ north, south, east, west }),
    })
      .then((r) => r.json())
      .then((res) => res?.data ?? []),
};

// Tours
export const toursAPI = {
  getAll: (page = 1, limit = 20) =>
    authFetch(`${API_BASE_URL}/api/v1/tours?page=${page}&limit=${limit}`).then(
      (r) => r.json(),
    ),

  getById: (tourId) =>
    authFetch(`${API_BASE_URL}/api/v1/tours/${tourId}`).then((r) => r.json()),

  getFeatured: (limit = 4) =>
    authFetch(`${API_BASE_URL}/api/v1/tours/featured?limit=${limit}`)
      .then((r) => r.json())
      .then((res) => res?.data ?? []),
};

// Search
export const searchAPI = {
  global: (query, type = "poi,tour", limit = 20) =>
    authFetch(
      `${API_BASE_URL}/api/v1/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`,
    ).then((r) => r.json()),
};

// Users
export const usersAPI = {
  getProfile: () =>
    authFetch(`${API_BASE_URL}/api/v1/users/me`).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data?.message || "Failed to fetch profile");
      }
      return data;
    }),

  updateProfile: (fullName, avatar) =>
    authFetch(`${API_BASE_URL}/api/v1/users/me`, {
      method: "PATCH",
      body: JSON.stringify({ fullName, avatar }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) {
        throw new Error(data?.message || "Failed to update profile");
      }
      return data;
    }),

  getFavorites: (page = 1, limit = 20) =>
    authFetch(
      `${API_BASE_URL}/api/v1/users/me/favorites?page=${page}&limit=${limit}`,
    ).then((r) => r.json()),
};

// Sync
export const syncAPI = {
  getManifest: () =>
    authFetch(`${API_BASE_URL}/api/v1/sync/manifest`).then((r) => r.json()),

  getFull: (version) =>
    authFetch(
      `${API_BASE_URL}/api/v1/sync/full${version ? `?version=${version}` : ""}`,
    ).then((r) => r.json()),

  getIncremental: (fromVersion) =>
    authFetch(`${API_BASE_URL}/api/v1/sync/incremental`, {
      method: "POST",
      body: JSON.stringify({ fromVersion }),
    }).then((r) => r.json()),
};

// Analytics
export const analyticsAPI = {
  submitEvents: (events) =>
    authFetch(`${API_BASE_URL}/api/v1/analytics/events`, {
      method: "POST",
      body: JSON.stringify({ events }),
    }).then((r) => r.json()),

  sendHeartbeat: () =>
    authFetch(`${API_BASE_URL}/api/v1/analytics/presence/heartbeat`, {
      method: "POST",
      body: JSON.stringify({
        deviceId: getDeviceId(),
        timestamp: Date.now(),
      }),
    }).then((r) => r.json()),

  getStats: () =>
    authFetch(`${API_BASE_URL}/api/v1/analytics/stats`).then((r) => r.json()),
};

// TTS
export const ttsAPI = {
  previewFromText: async (text, language = "auto") => {
    const response = await authFetch(
      `${API_BASE_URL}/api/v1/auth/tts-preview`,
      {
        method: "POST",
        headers: {
          Accept: "audio/wav",
        },
        body: JSON.stringify({ text, language }),
      },
    );

    if (!response.ok) {
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await response.json();
        throw new Error(data?.message || "TTS preview failed");
      }

      const fallbackMessage = await response.text();
      throw new Error(fallbackMessage || "TTS preview failed");
    }

    const blob = await response.blob();
    return {
      blob,
      audioUrl: URL.createObjectURL(blob),
    };
  },
};

// Export utilities
export function setAuthTokens(accessToken, refreshToken) {
  setTokens(accessToken, refreshToken);
}

export function clearAuth() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

export function getAuthToken() {
  return getAccessToken();
}
