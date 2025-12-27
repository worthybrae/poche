# App Template

A full-stack application template with AI-assisted development capabilities via MCP (Model Context Protocol).

## Stack

| Layer | Technology |
|-------|------------|
| Backend | Python FastAPI + SQLModel + Alembic |
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui |
| Database | PostgreSQL 16 |
| MCP Server | Python (FastMCP) - unified server with 3 integrations |

## Quick Start

1. **Clone and setup**
   ```bash
   cp .env.example .env
   ```

2. **Start the development environment**
   ```bash
   chmod +x scripts/start-dev.sh
   ./scripts/start-dev.sh
   ```

   Or manually:
   ```bash
   docker compose up -d
   ```

3. **Access the services**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - API Docs: http://localhost:8000/docs
   - MCP Server: http://localhost:8080

## Project Structure

```
app-template/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── api/routes/
│   │   ├── models/
│   │   └── schemas/
│   └── alembic/       # Database migrations
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/ui/
│   │   ├── pages/
│   │   └── api/
│   └── tailwind.config.ts
├── mcp-server/        # Unified MCP server
│   └── src/
│       ├── server.py
│       └── integrations/
│           ├── postgres.py
│           ├── fastapi.py
│           └── playwright.py
└── docker-compose.yml
```

## MCP Server

The unified MCP server provides AI assistants with tools to interact with your application:

### Database Tools (PostgreSQL)
- `db_list_tables` - List all tables in the database
- `db_describe_table` - Get table schema details
- `db_execute_query` - Run read-only SQL queries
- `db_get_schema` - Get complete database schema

### API Tools (FastAPI)
- `api_get_schema` - Retrieve OpenAPI schema
- `api_list_endpoints` - List all API endpoints
- `api_call` - Make HTTP requests to the API
- `api_test` - Run API tests with assertions
- `api_health_check` - Check API health

### Browser Tools (Playwright)
- `browser_navigate` - Navigate to URLs
- `browser_screenshot` - Capture screenshots
- `browser_click` - Click elements
- `browser_fill` - Fill form inputs
- `browser_get_content` - Extract page content
- `browser_visual_test` - Run visual assertions
- `browser_generate_test` - Generate Playwright test code
- `browser_cleanup` - Clean up browser resources

### Configure Claude Desktop / Claude Code

Generate and install MCP configuration:

```bash
python scripts/generate-mcp-config.py --install
```

Or manually add to your Claude configuration:

```json
{
  "mcpServers": {
    "app-dev": {
      "type": "sse",
      "url": "http://localhost:8080/sse"
    }
  }
}
```

## Development

### Backend

```bash
cd backend

# Install dependencies
pip install uv
uv pip install -e ".[dev]"

# Run migrations
alembic upgrade head

# Run server
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Add shadcn/ui components
npx shadcn@latest add button
```

### Database Migrations

```bash
cd backend

# Create a new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Docker Commands

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Rebuild after changes
docker compose up -d --build

# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Environment Variables

See `.env.example` for all available configuration options.

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | Database user | `app` |
| `POSTGRES_PASSWORD` | Database password | `app` |
| `POSTGRES_DB` | Database name | `app` |
| `DATABASE_URL` | Full database URL | (constructed) |
| `VITE_API_URL` | Frontend API URL | `http://localhost:8000` |
| `MCP_PORT` | MCP server port | `8080` |
