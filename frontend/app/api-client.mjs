export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

export function apiUrl(path) {
  return /^https?:\/\//i.test(path) ? path : `${API_BASE_URL}${path}`;
}

export function getCookie(name) {
  if (typeof document === "undefined") return "";
  return document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split("=")[1] || "";
}

export async function apiRequest(path, options = {}) {
  const { fetchAllPages = false, ...requestOptions } = options;
  const method = requestOptions.method || "GET";
  const headers = {
    Accept: "application/json",
    ...requestOptions.headers,
  };

  if (requestOptions.body) {
    headers["Content-Type"] = "application/json";
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      headers["X-CSRFToken"] = csrfToken;
    }
  }

  const response = await fetch(apiUrl(path), {
    ...requestOptions,
    method,
    credentials: "include",
    headers,
    body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail =
      payload?.detail ||
      Object.values(payload || {}).flat().join(" ") ||
      `HTTP ${response.status}`;
    const error = new Error(detail);
    error.status = response.status;
    throw error;
  }

  if (fetchAllPages && method === "GET" && Array.isArray(payload?.results)) {
    const results = [...payload.results];
    let nextUrl = payload.next;
    let pageCount = 1;

    while (nextUrl && pageCount < 100) {
      const nextResponse = await fetch(apiUrl(nextUrl), {
        method: "GET",
        credentials: "include",
        headers,
      });
      const nextPayload = await nextResponse.json().catch(() => null);

      if (!nextResponse.ok) {
        const detail = nextPayload?.detail || `HTTP ${nextResponse.status}`;
        const error = new Error(detail);
        error.status = nextResponse.status;
        throw error;
      }

      results.push(...(nextPayload?.results || []));
      nextUrl = nextPayload?.next;
      pageCount += 1;
    }

    if (nextUrl) {
      throw new Error("Pagination limit exceeded while loading API data.");
    }

    return results;
  }

  return payload?.results || payload;
}
