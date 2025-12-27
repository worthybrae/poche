# CLAUDE.md - Project Guide for AI Assistants

## Project Overview

This is a full-stack application template with AI-assisted development via MCP (Model Context Protocol).

**Stack:**
- Backend: Python FastAPI + SQLModel + Alembic
- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Database: PostgreSQL 16
- MCP Server: Unified Python server with database, API, and browser tools

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Development Flow                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Define Models    2. Generate Types    3. Use Everywhere         │
│  ┌──────────────┐   ┌───────────────┐   ┌─────────────────┐        │
│  │   SQLModel   │──▶│   OpenAPI     │──▶│  TypeScript     │        │
│  │   (Python)   │   │   Schema      │   │  Types (auto)   │        │
│  └──────────────┘   └───────────────┘   └─────────────────┘        │
│        │                                        │                   │
│        ▼                                        ▼                   │
│  ┌──────────────┐                      ┌─────────────────┐         │
│  │  PostgreSQL  │                      │  React Frontend │         │
│  │   Tables     │                      │  (type-safe)    │         │
│  └──────────────┘                      └─────────────────┘         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Key Conventions

### Single Source of Truth: SQLModel

**Models are defined ONCE in `backend/app/models/`** and flow everywhere:

1. **SQLModel class** → Database table (via Alembic migrations)
2. **SQLModel class** → Pydantic schema (request/response validation)
3. **FastAPI** → OpenAPI schema (auto-generated)
4. **Codegen** → TypeScript types (via `npm run codegen` in frontend)

### File Structure

```
app-template/
├── .claude/
│   ├── CLAUDE.md             # THIS FILE - AI assistant guide
│   └── skills/               # Integrated skills (frontend-design, etc.)
├── Makefile                  # All common commands (make help)
├── docker-compose.yml        # All services orchestration
│
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app entry point
│   │   ├── config.py        # Environment settings
│   │   ├── database.py      # Database connection
│   │   ├── models/          # SQLModel definitions (SOURCE OF TRUTH)
│   │   │   ├── __init__.py  # Export all models
│   │   │   ├── base.py      # Base model with common fields
│   │   │   └── *.py         # Domain models (user.py, item.py, etc.)
│   │   ├── schemas/         # Additional Pydantic schemas if needed
│   │   ├── api/
│   │   │   ├── deps.py      # Dependency injection
│   │   │   └── routes/      # API route handlers
│   │   └── services/        # Business logic
│   ├── alembic/             # Database migrations
│   └── tests/
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts    # Type-safe API client
│   │   │   └── types.ts     # GENERATED - do not edit manually!
│   │   ├── components/ui/   # shadcn/ui components
│   │   ├── pages/           # Page components
│   │   └── lib/utils.ts     # Utilities
│   └── package.json         # Includes codegen script
│
├── mcp-server/
│   └── src/
│       ├── server.py        # MCP server entry point
│       └── integrations/    # Tool implementations
│           ├── postgres.py  # Database tools (db_*)
│           ├── fastapi.py   # API tools (api_*)
│           └── playwright.py # Browser tools (browser_*)
│
└── scripts/
    ├── start-dev.sh         # Start all services
    └── generate-mcp-config.py
```

## Development Workflow

### Adding a New Feature

1. **Define the model** in `backend/app/models/`
   ```python
   # backend/app/models/item.py
   from sqlmodel import SQLModel, Field
   from .base import BaseModel

   class Item(BaseModel, table=True):
       name: str = Field(index=True)
       description: str | None = None
       price: float = Field(ge=0)
   ```

2. **Export it** in `backend/app/models/__init__.py`
   ```python
   from .item import Item
   ```

3. **Create migration**
   ```bash
   cd backend && alembic revision --autogenerate -m "add item model"
   alembic upgrade head
   ```

4. **Add API routes** in `backend/app/api/routes/`

5. **Generate TypeScript types**
   ```bash
   cd frontend && npm run codegen
   ```

6. **Use types in frontend** - they're auto-imported from `@/api/types`

### Type Generation Workflow

The codegen flow ensures type safety across the stack:

```bash
# After changing backend models or API routes:
cd frontend && npm run codegen
```

This generates `frontend/src/api/types.ts` from the OpenAPI schema at `http://localhost:8000/openapi.json`.

**Important:** Never edit `types.ts` manually - it will be overwritten!

Example usage in frontend:
```typescript
import { api } from '@/api/client'
import type { ItemRead, ItemCreate } from '@/api/types'

// Type-safe API calls
const items: ItemRead[] = await api.items.list()
const newItem = await api.items.create({ name: 'Test', price: 9.99 })
```

### Running Services

Use the Makefile for all common operations:

```bash
make help      # Show all available commands
make install   # First-time setup
make start     # Start all services
make stop      # Stop all services
make logs      # View all logs
```

Or use docker compose directly:
```bash
docker compose up -d
docker compose logs -f [service]
docker compose down
```

### Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:5173 | React app |
| Backend | http://localhost:8000 | FastAPI |
| API Docs | http://localhost:8000/docs | Swagger UI |
| OpenAPI | http://localhost:8000/openapi.json | Schema for codegen |
| MCP Server | http://localhost:8080 | AI tools |
| Database | localhost:5432 | PostgreSQL |

## MCP Tools Reference

When connected via MCP, you have access to these tools:

### Database Tools (prefix: `db_`)
- `db_list_tables()` - List all tables
- `db_describe_table(table_name)` - Get table schema
- `db_execute_query(query)` - Run SELECT queries
- `db_get_schema()` - Get full database schema

### API Tools (prefix: `api_`)
- `api_list_endpoints()` - List all API endpoints
- `api_get_schema()` - Get OpenAPI schema
- `api_call(method, path, body?)` - Call any endpoint
- `api_test(test_name, method, path, expected_status)` - Test endpoints
- `api_health_check()` - Check backend health

### Browser Tools (prefix: `browser_`)
- `browser_navigate(url)` - Go to page
- `browser_screenshot()` - Capture screenshot
- `browser_click(selector)` - Click element
- `browser_fill(selector, value)` - Fill input
- `browser_get_content()` - Get page text/elements
- `browser_visual_test(test_name, url, assertions)` - Run visual tests
- `browser_generate_test(actions)` - Generate Playwright test code
- `browser_cleanup()` - Close browser

## Code Style

### Backend (Python)
- Use `SQLModel` for all database models
- Use `async/await` for database operations
- Use dependency injection via `Depends()`
- Follow FastAPI conventions for routes

### Frontend (TypeScript)
- Use generated types from `@/api/types`
- Use shadcn/ui components from `@/components/ui`
- Use `cn()` utility for conditional classes
- Follow React hooks patterns

### Naming Conventions
- **Models**: PascalCase, singular (`User`, `Item`, `Order`)
- **Tables**: auto-generated from model name (lowercase)
- **API routes**: kebab-case (`/api/items`, `/api/user-profiles`)
- **React components**: PascalCase (`UserProfile.tsx`)
- **TypeScript types**: PascalCase, matches backend models

## Make Commands Reference

All common operations are available via `make`:

### Setup & Running
| Command | Description |
|---------|-------------|
| `make install` | First-time setup (copy .env, build containers) |
| `make start` | Start all services |
| `make stop` | Stop all services |
| `make restart` | Restart all services |
| `make build` | Rebuild all containers |
| `make ps` | Show running containers |

### Logs
| Command | Description |
|---------|-------------|
| `make logs` | View all logs (Ctrl+C to exit) |
| `make logs-backend` | View backend logs only |
| `make logs-frontend` | View frontend logs only |
| `make logs-mcp` | View MCP server logs only |
| `make logs-db` | View database logs only |

### Database
| Command | Description |
|---------|-------------|
| `make db-migrate` | Run pending migrations |
| `make db-revision msg="description"` | Create new migration |
| `make db-shell` | Open psql shell |
| `make db-reset` | Reset database (WARNING: deletes data) |

### Development
| Command | Description |
|---------|-------------|
| `make codegen` | Generate TypeScript types from API |
| `make test` | Run backend tests |
| `make shell-backend` | Open bash shell in backend container |
| `make shell-frontend` | Open shell in frontend container |

### MCP
| Command | Description |
|---------|-------------|
| `make mcp-config` | Show MCP configuration |
| `make mcp-install` | Install MCP config to Claude |

### Cleanup
| Command | Description |
|---------|-------------|
| `make clean` | Stop and remove containers |
| `make clean-all` | Stop, remove containers AND volumes |

## Common Tasks

### Add a new API endpoint
1. Create route in `backend/app/api/routes/`
2. Register in `backend/app/main.py`
3. Run `make codegen` to generate TypeScript types

### Add a shadcn/ui component
```bash
cd frontend && npx shadcn@latest add [component-name]
```

### Create a database migration
```bash
make db-revision msg="add users table"
make db-migrate
```

### Run backend tests
```bash
make test
```

### Check what's in the database
Use MCP tools: `db_list_tables()`, then `db_describe_table("table_name")`

Or open a psql shell:
```bash
make db-shell
```

### Debug frontend issues
Use MCP tools: `browser_navigate("/")`, `browser_get_content()`, `browser_screenshot()`

## Environment Variables

Key variables in `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `VITE_API_URL` | Frontend API base URL |
| `MCP_PORT` | MCP server port (default: 8080) |

## Integrated Skills

This project includes skills from [anthropics/skills](https://github.com/anthropics/skills) to extend Claude's capabilities. Skills are located in `.claude/skills/`.

### Available Skills

| Skill | Command | Description |
|-------|---------|-------------|
| **frontend-design** | `/frontend-design` | Create distinctive, production-grade frontend interfaces with high design quality |
| **webapp-testing** | `/webapp-testing` | Test web applications using Playwright with Python scripts |
| **mcp-builder** | `/mcp-builder` | Guide for building high-quality MCP servers |
| **skill-creator** | `/skill-creator` | Create new skills that extend Claude's capabilities |
| **theme-factory** | `/theme-factory` | Apply professional themes with 10 presets (Ocean Depths, Sunset Boulevard, etc.) |
| **web-artifacts-builder** | `/web-artifacts-builder` | Build React + Tailwind + shadcn/ui artifacts bundled to single HTML |
| **brand-guidelines** | `/brand-guidelines` | Apply Anthropic's official brand colors and typography |

### Skill Structure

Each skill contains:
- `SKILL.md` - Main skill definition and instructions
- `LICENSE.txt` - License information
- `scripts/` - Executable helper scripts (optional)
- `references/` - Additional documentation (optional)
- `examples/` - Example implementations (optional)

### Using Skills

Invoke skills by name when relevant to your task:
- For UI design tasks, use the **frontend-design** skill guidelines
- For testing the webapp, use **webapp-testing** with the Playwright helpers
- For building MCP integrations, follow the **mcp-builder** patterns
- For theming, use **theme-factory** presets or create custom themes

## Troubleshooting

### Database connection issues
1. Check if db container is running: `docker compose ps`
2. Check logs: `docker compose logs db`
3. Verify DATABASE_URL in .env

### Frontend can't reach backend
1. Check CORS settings in `backend/app/main.py`
2. Verify VITE_API_URL in frontend
3. Check backend logs: `docker compose logs backend`

### MCP server not connecting
1. Verify MCP config: `python scripts/generate-mcp-config.py`
2. Check MCP server logs: `docker compose logs mcp-server`
3. Ensure port 8080 is not in use
