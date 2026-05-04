import assert from "node:assert/strict";
import test from "node:test";

import { apiRequest, apiUrl } from "./api-client.mjs";

function jsonResponse(body, status = 200) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

test("apiUrl prefixes relative API paths", () => {
  assert.equal(apiUrl("/farmers/"), "http://localhost:8000/api/v1/farmers/");
  assert.equal(apiUrl("http://example.test/page"), "http://example.test/page");
});

test("apiRequest follows paginated list responses", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return jsonResponse({
        results: [{ id: 1 }],
        next: "http://localhost:8000/api/v1/farmers/?page=2",
      });
    }
    return jsonResponse({
      results: [{ id: 2 }],
      next: null,
    });
  };

  try {
    const result = await apiRequest("/farmers/", { fetchAllPages: true });

    assert.deepEqual(result, [{ id: 1 }, { id: 2 }]);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.credentials, "include");
    assert.equal(calls[1].url, "http://localhost:8000/api/v1/farmers/?page=2");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
