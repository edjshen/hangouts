#!/bin/bash
# Start script for Render

cd /opt/render/project/src/repo

# Generate Prisma client
npx prisma generate

# Push database schema (creates tables if they don't exist)
npx prisma db push --accept-data-loss || true

# Start the server
node src/server/index.js
