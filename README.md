# Poche

A browser-based 3D CAD application for architectural modeling, inspired by SketchUp. Draw lines, create shapes, and build 3D structures with an intuitive interface and AI-powered assistance.

![Poche Demo](poche.gif)

## Features

- **3D Drawing Tools** - Line, rectangle, circle, and arc tools with grid snapping
- **Axis Inference** - SketchUp-style colored axis lines (red=X, green=Y, blue=Z)
- **Hold-to-Activate Tools** - Hold A for line, S for square, D for circle
- **Camera Controls** - Orbit (hold Shift + drag), pan (right-click drag), zoom (scroll)
- **Undo/Redo** - Cmd+Z to undo, Cmd+X to redo
- **AI Assistant** - Natural language commands to create geometry ("make a red box", "create terrain")
- **Architectural Scale** - Optimized for real-world dimensions (1 unit = 1 inch)

## Tech Stack

| Layer | Technology |
|-------|------------|
| 3D Rendering | React Three Fiber + Three.js |
| State Management | Zustand + Immer |
| Frontend | React + TypeScript + Vite + Tailwind |
| Backend | Python FastAPI + SQLModel |
| AI Integration | OpenAI GPT with function calling |
| Database | PostgreSQL 16 |

## Quick Start

1. **Clone and setup**
   ```bash
   cp .env.example .env
   ```

2. **Add your OpenAI API key** (for AI features)
   ```bash
   # In .env file
   OPENAI_API_KEY=your-key-here
   ```

3. **Start the development environment**
   ```bash
   docker compose up -d
   ```

4. **Open the editor**
   - http://localhost:5173

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `L` | Toggle line tool |
| `A` (hold) | Line tool while held |
| `S` (hold) | Rectangle tool while held |
| `D` (hold) | Circle tool while held |
| `Shift` (hold) | Enable orbit camera |
| `Cmd+Z` | Undo |
| `Cmd+X` | Redo |
| `/` | Focus AI command bar |
| `Escape` | Cancel current drawing / close AI panel |

## AI Commands

Press `/` to focus the AI command bar, then try:

- "Create a red box"
- "Make a 10x10 foot rectangle"
- "Create terrain with a hill"
- "Clear the scene"

## Project Structure

```
poche/
├── frontend/
│   └── src/
│       ├── cad/
│       │   ├── core/         # State management, types, utilities
│       │   ├── components/   # 3D rendering (Canvas, Scene, Faces, etc.)
│       │   ├── tools/        # Drawing tools
│       │   └── ui/           # Toolbar, StatusBar, ChatPanel
│       ├── pages/
│       │   └── Editor.tsx    # Main CAD editor page
│       └── api/              # API client
├── backend/
│   └── app/
│       ├── api/routes/       # API endpoints including chat
│       ├── services/         # Chat service with OpenAI integration
│       └── models/           # Database models
└── docker-compose.yml
```

## Development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
pip install uv
uv pip install -e ".[dev]"
uvicorn app.main:app --reload
```

### Docker

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Rebuild after changes
docker compose up -d --build

# Stop all services
docker compose down
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API key for AI assistant |
| `DATABASE_URL` | PostgreSQL connection string |
| `VITE_API_URL` | Frontend API URL (default: http://localhost:8000) |
