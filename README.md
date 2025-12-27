# Chaos Kings

A real-time strategy game inspired by generals.io.

## Prerequisites

- **[fnm](https://github.com/Schniz/fnm)** (Fast Node Manager) for Node.js version management
- **PostgreSQL** and **Redis** for backend services

## Setup

1. **Install fnm** (if not already installed):
   ```bash
   curl -fsSL https://fnm.vercel.app/install | bash
   ```

2. **Install the project's Node version:**
   ```bash
   fnm install v22.17.0
   ```

3. **Clone and install dependencies:**
   ```bash
   git clone <repo-url>
   cd generals-v2
   fnm use
   npm install
   ```

4. **Set up the database:**
   ```bash
   cd apps/backend
   npm run migrate:latest
   ```

## Running the Project

**Backend:**
```bash
cd apps/backend
npm run start
```

**Frontend:**
```bash
cd apps/frontend
npm run dev
```

## Development

- `bash tools/build-all.sh` - Build backend + frontend (check for TS errors)
- `bash tools/test-all.sh` - Run all tests
- `bash tools/dev-all.sh` - Start both frontend and backend

## Documentation

- **AGENTS.md** - Coding conventions and patterns (for AI agents, but useful for humans too)
- **docs/architecture.md** - System architecture overview
