import AsyncStorage from "@react-native-async-storage/async-storage";

//const BASE_URL = "http://10.0.2.2:3001/api";
const BASE_URL = "https://app.londoncafejrz.com/api";
const POS_URL = "https://api.londoncafejrz.com/api";

async function parseJsonSafe(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;

  const token =
    (await AsyncStorage.getItem("token")) ||
    (await AsyncStorage.getItem("auth_token")) ||
    (await AsyncStorage.getItem("jwt")) ||
    "";

  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (fetchErr) {
    const err = new Error(`NETWORK_ERROR: ${fetchErr?.message || "fetch failed"}`);
    throw err;
  }

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      data?.details ||
      `HTTP_${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export async function posFetch(path, options = {}) {
  const url = `${POS_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const err = new Error(data?.error || "REQUEST_FAILED");
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}