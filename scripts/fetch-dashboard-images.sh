#!/bin/bash
# Fetch one real image URL per dashboard tile (sequential, reliable).
# Uses z-ai image-search with --count 3 --no-rank for speed.

OUT="/home/z/my-project/scripts/image-urls.txt"
> "$OUT"

fetch_one() {
  local key="$1"
  local query="$2"
  local tmp="/tmp/img-${key}.json"
  timeout 110 z-ai image-search -q "$query" -c 3 --no-rank --gl us -o "$tmp" 2>/dev/null
  if [ -f "$tmp" ]; then
    local url=$(python3 -c "import json; d=json.load(open('$tmp')); print(d['results'][0]['original_url'] if d.get('success') and d.get('results') else '')" 2>/dev/null)
    if [ -n "$url" ]; then
      echo "${key}|${url}" >> "$OUT"
      echo "OK $key"
      return 0
    fi
  fi
  echo "FAIL $key"
  return 1
}

fetch_one production "industrial brick manufacturing factory conveyor"
fetch_one dailySell "retail shop cash sale money"
fetch_one customerPayment "credit card payment terminal"
fetch_one stock "warehouse inventory boxes shelves"
fetch_one orders "clipboard order paperwork desk"
fetch_one dispatch "delivery truck cargo logistics"
fetch_one expenses "calculator coins finance money"
fetch_one labourPayment "construction worker wages helmet"
fetch_one tractorPayment "red farm tractor field"
fetch_one dustPurchase "stone dust gravel quarry"
fetch_one cementPurchase "cement bags construction stack"
fetch_one hardner "industrial chemical liquid drum"
fetch_one electricity "electric power transmission tower"
fetch_one factoryStuff "factory machinery industrial tools"
fetch_one bills "invoice paper receipt documents"
fetch_one customers "business handshake meeting people"
fetch_one reports "business analytics chart dashboard"
fetch_one settings "gear settings mechanical cog"

echo "---DONE---"
wc -l "$OUT"
cat "$OUT"
