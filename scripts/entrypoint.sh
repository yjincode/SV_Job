#!/bin/sh
set -e

echo "========================================"
echo " Dashboard Application Startup"
echo "========================================"

# Wait for database to be ready
echo ""
echo "[1/5] Waiting for database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

until echo "SELECT 1" | npx prisma db execute --stdin > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "[ERROR] Database connection failed after $MAX_RETRIES attempts"
    exit 1
  fi
  echo "  Waiting for database... (attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep 2
done
echo "[OK] Database connected"

# Apply schema
echo ""
echo "[2/5] Applying database schema..."
npx prisma db push --skip-generate
echo "[OK] Schema applied"

# Import CSV data
echo ""
echo "[3/5] Importing CSV data..."
if [ -f "./.csv/content_performance.csv" ] && [ -f "./.csv/player_history.csv" ]; then
  npx tsx scripts/import-csv.ts
  echo "[OK] CSV import completed"
else
  echo "[WARN] CSV files not found. Skipping import."
  echo "  Expected: .csv/content_performance.csv"
  echo "  Expected: .csv/player_history.csv"
  touch /tmp/seed-complete
  exec npm start
  exit 0
fi

# Build star schema
echo ""
echo "[4/5] Building star schema and aggregating KPIs..."
npx tsx scripts/seed.ts
echo "[OK] Star schema completed"

# 시드 완료 표시 파일 생성
touch /tmp/seed-complete

# Start application
echo ""
echo "[5/5] Starting Next.js server..."
echo "========================================"
echo ""
exec npm start
