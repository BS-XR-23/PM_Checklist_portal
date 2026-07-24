#!/bin/sh
set -e

npx prisma migrate deploy

if [ -n "$SEED_ADMIN_EMAIL" ]; then
  npx tsx prisma/seed.ts || true
fi

exec "$@"
