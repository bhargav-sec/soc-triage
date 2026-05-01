#!/bin/bash
# Usage: INGEST_URL=https://your-app.vercel.app bash scripts/rescore-failed.sh
BASE_URL="${INGEST_URL:-http://localhost:3000}"

echo "Fetching unknown-severity events..."
# Pull IDs from Supabase directly via the API
IDS=$(curl -s \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  "$SUPABASE_URL/rest/v1/events?severity=eq.unknown&select=id&limit=100" \
  | jq -r '.[].id')

COUNT=0
for ID in $IDS; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/events/$ID/rescore")
  echo "  $ID → HTTP $STATUS"
  COUNT=$((COUNT + 1))
  sleep 0.5  # avoid rate-limiting Groq/Gemini
done

echo "Done. Rescored $COUNT events."
