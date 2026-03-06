#!/bin/bash

echo "🚀 Starting database..."

docker compose up -d

echo "⏳ Waiting for database to be ready..."
until docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done

echo "✅ Database is ready!"

echo "🗄️ Running migrations..."
npm run db:migrate

echo "🎉 Database is ready to use!"
