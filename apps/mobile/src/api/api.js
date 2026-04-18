import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API = axios.create({
  // baseURL: "http://192.168.1.15:3000/api/v1", //Tuấn
  // Sửa thành IP mới từ ipconfig của bạn
  baseURL: "http://192.168.58.251:3000/api/v1",
});

const DEVICE_ID_KEY = "deviceId";
const SESSION_ID_KEY = "sessionId";

async function ensureDeviceId() {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (!deviceId) {
    deviceId = `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }

  return deviceId;
}

async function getStoredSessionId() {
  return (await AsyncStorage.getItem(SESSION_ID_KEY))?.trim() || "";
}

async function saveSessionContext({ accessToken, refreshToken, sessionId }) {
  if (accessToken) {
    await AsyncStorage.setItem("userToken", accessToken);
  }

  if (refreshToken) {
    await AsyncStorage.setItem("refreshToken", refreshToken);
  }

  if (sessionId) {
    await AsyncStorage.setItem(SESSION_ID_KEY, sessionId);
  }
}

async function sendPresenceHeartbeat({ language = "vi" } = {}) {
  const token = await AsyncStorage.getItem("userToken");
  if (!token) {
    return null;
  }

  const deviceId = await ensureDeviceId();
  const response = await API.post(
    "/analytics/presence/heartbeat",
    {
      deviceId,
      timestamp: Date.now(),
      language,
      sessionId: await getStoredSessionId(),
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return response.data;
}

async function sendPresenceOffline() {
  const token = await AsyncStorage.getItem("userToken");
  if (!token) {
    return null;
  }

  const deviceId = await ensureDeviceId();
  const response = await API.post(
    "/analytics/presence/offline",
    {
      deviceId,
      sessionId: await getStoredSessionId(),
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  return response.data;
}

export default API;
export {
  ensureDeviceId,
  getStoredSessionId,
  saveSessionContext,
  sendPresenceHeartbeat,
  sendPresenceOffline,
};
