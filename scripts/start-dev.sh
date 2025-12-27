#!/bin/bash

set -e

echo "Starting App Template development environment..."

# Check if .env exists, if not copy from example
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
fi

# Start all services
echo "Starting Docker Compose services..."
docker compose up -d

echo ""
echo "Services started successfully!"
echo ""
echo "Access points:"
echo "  - Frontend:   http://localhost:5173"
echo "  - Backend:    http://localhost:8000"
echo "  - API Docs:   http://localhost:8000/docs"
echo "  - MCP Server: http://localhost:8080"
echo "  - Database:   localhost:5432"
echo ""
echo "To view logs: docker compose logs -f"
echo "To stop: docker compose down"
