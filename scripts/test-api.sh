#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"

if [[ -z "${API_KEY:-}" ]] && [[ -f ".env" ]]; then
  API_KEY="$(grep -E '^API_KEY=' .env | head -n1 | cut -d'=' -f2-)"
fi

if [[ -z "${API_KEY:-}" ]]; then
  echo "Missing API_KEY. Set it in the environment or in .env."
  exit 1
fi

request() {
  local path="$1"
  echo
  echo "GET ${BASE_URL}${path}"
  curl -sS -H "api-key: ${API_KEY}" -w "\nHTTP %{http_code}\n" "${BASE_URL}${path}" | head -c 400
  echo
}

request "/v1/bibles"
request "/v1/bibles/NKJV/books"
request "/v1/bibles/NKJV/chapters/GEN.1"
request "/v1/bibles/NKJV/passages/GEN.1.1-GEN.1.5"
request "/v1/votd"
request "/v1/openapi.json"
