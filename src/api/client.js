const BASE_URL = "http://192.168.1.90:3001/api";

export async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;

  // OJO: primero esparcimos options, y AL FINAL construimos headers,
  // para que NO se pierda Content-Type ni Authorization.
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  // Mejor parseo (hay endpoints que pueden regresar vacío)
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err = new Error(data?.error || "REQUEST_FAILED");
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}
