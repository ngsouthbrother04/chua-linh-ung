/**
 * Parse JWT token and extract payload (không validate signature frontend-side)
 * Token được verify bởi backend khi issue, nên ta chỉ cần parse payload
 */
export function parseJwt(token) {
  if (!token || typeof token !== "string") {
    return null;
  }

  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    // Decode base64url using atob (browser API)
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));

    return JSON.parse(decoded);
  } catch (error) {
    console.error("Failed to parse JWT:", error);
    return null;
  }
}

/**
 * Extract role from JWT token payload
 */
export function getRoleFromToken(token) {
  const payload = parseJwt(token);
  if (!payload || !payload.role) {
    return "USER";
  }
  return String(payload.role).toUpperCase();
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token) {
  const payload = parseJwt(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp < nowSeconds;
}
