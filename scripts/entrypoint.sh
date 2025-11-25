#!/bin/sh
set -e

echo "========================================"
echo " Dashboard Application Startup"
echo "========================================"

# Wait for database to be ready
echo ""
echo "[1/4] Waiting for database connection..."
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
echo "[2/4] Applying database schema..."
npx prisma db push --skip-generate
echo "[OK] Schema applied"

# Seed database
echo ""
echo "[3/4] Seeding database..."
if [ -f "./.csv/content_performance.csv" ] && [ -f "./.csv/player_history.csv" ]; then
  npx tsx scripts/seed.ts
  echo "[OK] Seeding completed"
  # 시드 완료 표시 파일 생성
  touch /tmp/seed-complete
else
  echo "[WARN] CSV files not found. Skipping seed."
  echo "  Expected: .csv/content_performance.csv"
  echo "  Expected: .csv/player_history.csv"
  touch /tmp/seed-complete
fi

# Start application
echo ""
echo "[4/4] Starting Next.js server..."
echo "========================================"
echo ""
exec npm start
