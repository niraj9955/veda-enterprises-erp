#!/bin/bash
# Start Next.js dev server, wait for it, run security tests, then kill it.
set -e
cd /home/z/my-project

echo "=== Starting Next.js dev server ==="
npm run dev > /tmp/veda-dev.log 2>&1 &
SERVER_PID=$!
echo "Server PID: $SERVER_PID"

# Wait for server to be ready (max 30 seconds)
for i in $(seq 1 60); do
  if curl -s -o /dev/null --max-time 2 http://127.0.0.1:3000/api; then
    echo "Server ready after ${i}s"
    break
  fi
  sleep 0.5
done

# Final check
if ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:3000/api; then
  echo "Server did NOT start. Log tail:"
  tail -30 /tmp/veda-dev.log
  kill $SERVER_PID 2>/dev/null || true
  exit 1
fi

echo ""
echo "===== 1. UNAUTHENTICATED API ACCESS TEST ====="
ENDPOINTS=(
  "GET /api/dashboard"
  "GET /api/customers"
  "GET /api/daily-sell"
  "GET /api/payments"
  "GET /api/users"
  "GET /api/database"
  "GET /api/production"
  "GET /api/stock"
  "GET /api/stock/summary"
  "GET /api/orders"
  "GET /api/dispatch"
  "GET /api/expenses"
  "GET /api/reports"
  "GET /api/company"
  "GET /api/bills"
  "GET /api/customer-payment"
  "GET /api/labour-payment"
  "GET /api/tractor-payment"
  "GET /api/dust-purchase"
  "GET /api/cement-purchase"
  "GET /api/hardner"
  "GET /api/electricity"
  "GET /api/factory-stuff"
  "GET /api/admin/sync-all-stock"
  "GET /api/admin/fix-indexes"
  "GET /api/ai/config"
  "GET /api/debug/payment-sync"
  "GET /api/debug/sync"
)
for entry in "${ENDPOINTS[@]}"; do
  method=$(echo "$entry" | awk '{print $1}')
  path=$(echo "$entry" | awk '{print $2}')
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 -X "$method" "http://127.0.0.1:3000${path}")
  printf "  %-7s %-35s -> HTTP %s\n" "$method" "$path" "$code"
done

echo ""
echo "===== 2. WRITE OPERATIONS WITHOUT LOGIN ====="
echo -n "  POST   /api/customers                -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X POST "http://127.0.0.1:3000/api/customers" -H "Content-Type: application/json" -d '{"name":"Hacker","mobile":"9999999999"}'

echo -n "  POST   /api/daily-sell               -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X POST "http://127.0.0.1:3000/api/daily-sell" -H "Content-Type: application/json" -d '{"date":"2025-01-01","customerName":"Hacker","amount":100}'

echo -n "  POST   /api/users                    -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X POST "http://127.0.0.1:3000/api/users" -H "Content-Type: application/json" -d '{"name":"Hacker","email":"hack@evil.com","password":"123456"}'

echo -n "  POST   /api/database/clear-section   -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X POST "http://127.0.0.1:3000/api/database/clear-section" -H "Content-Type: application/json" -d '{"collection":"customers"}'

echo -n "  DELETE /api/database                 -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X DELETE "http://127.0.0.1:3000/api/database"

echo -n "  DELETE /api/daily-sell?all=true      -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X DELETE "http://127.0.0.1:3000/api/daily-sell?all=true"

echo -n "  POST   /api/admin/sync-all-stock     -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X POST "http://127.0.0.1:3000/api/admin/sync-all-stock"

echo -n "  POST   /api/admin/fix-indexes        -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X POST "http://127.0.0.1:3000/api/admin/fix-indexes"

echo -n "  POST   /api/import                   -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X POST "http://127.0.0.1:3000/api/import" -H "Content-Type: application/json" -d '{"module":"dailySell","data":[]}'

echo -n "  POST   /api/ai/parse                 -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X POST "http://127.0.0.1:3000/api/ai/parse" -H "Content-Type: application/json" -d '{"module":"dailySell","text":"customer Ramesh qty 100 rate 50"}'

echo -n "  POST   /api/auth/init                -> "
curl -s -o /dev/null -w "HTTP %{http_code}\n" --max-time 10 -X POST "http://127.0.0.1:3000/api/auth/init"

echo ""
echo "===== 3. AUTH/ME WITHOUT LOGIN ====="
curl -s --max-time 5 http://127.0.0.1:3000/api/auth/me
echo ""

echo ""
echo "===== 4. SECURITY HEADERS CHECK ====="
curl -s -I --max-time 5 http://127.0.0.1:3000/ | grep -iE "x-frame|x-content|x-xss|strict-transport|content-security|referrer-policy|permissions-policy|x-powered|set-cookie" || echo "  (no security headers found)"

echo ""
echo "===== 5. COOKIE ATTRIBUTES ====="
curl -s -I --max-time 5 http://127.0.0.1:3000/ | grep -i "set-cookie" || echo "  (no cookies set on /)"

echo ""
echo "===== 6. ROOT API RESPONSE ====="
curl -s --max-time 5 http://127.0.0.1:3000/api
echo ""

echo ""
echo "=== Stopping server ==="
kill $SERVER_PID 2>/dev/null || true
sleep 1
echo "Done."
