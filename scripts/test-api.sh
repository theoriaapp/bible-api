#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8787}"
EXPECT_DATA="${EXPECT_DATA:-true}"
EXPECT_VOTD="${EXPECT_VOTD:-true}"
CURL_INSECURE="${CURL_INSECURE:-false}"

if [[ -z "${API_KEY:-}" ]] && [[ -f ".env" ]]; then
  API_KEY="$(grep -E '^API_KEY=' .env | head -n1 | cut -d'=' -f2-)"
fi

if [[ -z "${API_KEY:-}" ]]; then
  echo "Missing API_KEY. Set it in the environment or in .env."
  exit 1
fi

curl_args=(-sS -H "api-key: ${API_KEY}")
if [[ "${CURL_INSECURE}" == "true" ]]; then
  curl_args+=(-k)
fi

request() {
  local path="$1"
  local expected_codes="$2"
  local tmp_body
  tmp_body="$(mktemp)"
  local status
  status="$(curl "${curl_args[@]}" -o "${tmp_body}" -w "%{http_code}" "${BASE_URL}${path}")"
  if [[ ",${expected_codes}," != *",${status},"* ]]; then
    echo "FAIL ${path} expected ${expected_codes} got ${status}" >&2
    cat "${tmp_body}"
    rm -f "${tmp_body}"
    exit 1
  fi
  echo "OK   ${path} -> ${status}" >&2
  echo "${tmp_body}"
}

assert_json() {
  local body_file="$1"
  local expression="$2"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync('${body_file}','utf8')); if (!(${expression})) { console.error('Assertion failed'); process.exit(1);} "
}

assert_contains() {
  local body_file="$1"
  local needle="$2"
  if ! grep -q "${needle}" "${body_file}"; then
    echo "Assertion failed: '${needle}' not found"
    exit 1
  fi
}

echo "Base URL: ${BASE_URL}"
echo "EXPECT_DATA=${EXPECT_DATA} EXPECT_VOTD=${EXPECT_VOTD} CURL_INSECURE=${CURL_INSECURE}"

body="$(request "/v1/bibles" "200")"
assert_json "${body}" "Array.isArray(data.data) && data.data.length > 0"
rm -f "${body}"

if [[ "${EXPECT_DATA}" == "true" ]]; then
  body="$(request "/v1/bibles/NKJV/books" "200")"
  assert_json "${body}" "Array.isArray(data.data) && data.data.length > 0"
  rm -f "${body}"

  body="$(request "/v1/bibles/NKJV/chapters/GEN.1" "200")"
  assert_json "${body}" "Array.isArray(data.data.content) && data.data.content.length > 0"
  rm -f "${body}"

  body="$(request "/v1/bibles/NKJV/passages/GEN.1.1-GEN.1.5" "200")"
  assert_json "${body}" "Array.isArray(data.data.content) && data.data.content.length > 0"
  rm -f "${body}"
else
  request "/v1/bibles/NKJV/books" "200,404" >/dev/null
  request "/v1/bibles/NKJV/chapters/GEN.1" "200,404" >/dev/null
  request "/v1/bibles/NKJV/passages/GEN.1.1-GEN.1.5" "200,404" >/dev/null
fi

if [[ "${EXPECT_VOTD}" == "true" ]]; then
  body="$(request "/v1/votd" "200")"
  assert_json "${body}" "data.data && data.data.id"
  rm -f "${body}"
else
  request "/v1/votd" "200,404" >/dev/null
fi

body="$(request "/openapi.json" "200")"
assert_json "${body}" "data.paths && data.paths['/v1/bibles']"
rm -f "${body}"

body="$(request "/docs" "200")"
assert_contains "${body}" "swagger-ui"
rm -f "${body}"

echo "All tests passed."
