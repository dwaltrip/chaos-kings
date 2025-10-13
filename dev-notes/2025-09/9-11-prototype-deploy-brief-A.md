# DigitalOcean Deployment Implementation Brief

## Objective
Implement a simple, maintainable deployment setup for a React + Node.js/Fastify + PostgreSQL + Redis stack on a single DigitalOcean droplet.

## Architecture Decisions (Final)

### **Infrastructure**
- **Platform**: Single DigitalOcean droplet ($12/month, 2GB RAM)
- **Orchestration**: Docker Compose
- **Reverse Proxy**: Caddy (automatic SSL, WebSocket support)
- **Domain Strategy**: Single domain with `/api/*` routing
- **SSL**: Automatic via Caddy + Let's Encrypt

### **Routing Strategy**
- `yourdomain.com/api/*` → Fastify backend
- `yourdomain.com/*` → React SPA (with SPA fallback routing)
- WebSocket connections → Backend with proper upgrade handling

### **Deployment**
- **Trigger**: Auto-deploy on push to `prod` branch
- **Build Location**: On server (not in CI)
- **Process**: Git pull → Build React → Copy to static → Restart containers

### **Data Persistence**
- **Database**: Docker named volumes (survives container restarts)
- **Backups**: None initially (can add later)
- **Cache**: Redis with persistence

### **Security**
- **Database**: Internal Docker network only
- **Environment Variables**: `.env` file approach
- **Firewall**: Only ports 22, 80, 443 open

## Implementation Tasks

### 1. Analyze Current Project Structure
Examine the repository and determine:
- Frontend location and build process (`package.json` scripts)
- Backend entry point and structure
- Current environment variables used
- WebSocket implementation details

### 2. Create Docker Configuration

**Required files to create:**
- `docker-compose.yml` - Main orchestration (use provided template, but verify service names match your app)
- `Dockerfile.backend` - Backend container (adapt to your actual file structure)
- `Caddyfile` - Reverse proxy config with `/api/*` routing
- `.env.example` - Template for environment variables

**Key Docker Compose requirements:**
- PostgreSQL with named volume
- Redis with password auth
- Backend service with proper environment variables
- Caddy with volume mounts for static files

### 3. Update Routing Configuration

**Backend changes needed:**
- Ensure all API routes are prefixed with `/api`
- Verify Fastify server binds to `process.env.PORT || 3000`
- Confirm WebSocket endpoints work with proxy headers
- Update CORS settings if needed for single-domain setup

**Frontend changes needed:**
- Verify build output goes to expected directory (`dist` or `build`)
- Update API calls to use `/api/*` prefix
- Ensure React Router is configured for client-side routing

### 4. Create Deployment Scripts

**Files to create:**
- `deploy.sh` - Server deployment script
- `.github/workflows/deploy.yml` - GitHub Actions (trigger on `prod` branch)

**Deployment process:**
1. Git pull latest changes
2. Build React frontend on server
3. Copy built files to `static/` directory
4. Restart Docker services
5. Verify services are running

### 5. Environment Configuration

**Environment variables to set up:**
- Database connection (PostgreSQL)
- Redis connection with password
- Any app-specific secrets (JWT, API keys, etc.)
- Production environment flags

### 6. Create Project Structure

**Required directories:**
```
/
├── static/          # Built React files served by Caddy
├── logs/           # Application logs
├── .env            # Secrets (not committed)
├── .env.example    # Template (committed)
└── [your existing code structure]
```

## Technical Specifications

### **Server Requirements**
- Ubuntu 22.04 LTS droplet
- Docker and Docker Compose installed
- Firewall configured (ufw)
- Git for deployment

### **Resource Allocation**
- **Expected Load**: Few dozen concurrent users
- **Database**: PostgreSQL with reasonable connection limits
- **Cache**: Redis with basic persistence
- **Web Server**: Caddy handling static files + proxy

### **Networking**
- **Container Network**: Internal Docker bridge network
- **External Ports**: 80 (HTTP), 443 (HTTPS), 22 (SSH)
- **Internal Ports**: PostgreSQL (5432), Redis (6379), Backend (3000)

## Configuration Templates

Reference the provided artifacts for complete configuration templates:
- `docker-compose.yml` - Complete multi-service setup
- `Dockerfile.backend` - Optimized Node.js container
- `Caddyfile` - Reverse proxy with automatic SSL
- `deploy.sh` - Deployment automation
- `.github/workflows/deploy.yml` - CI/CD pipeline

## Validation Checklist

After implementation, verify:
- [ ] All services start with `docker-compose up -d`
- [ ] React app loads at `https://yourdomain.com`
- [ ] API calls work at `https://yourdomain.com/api/*`
- [ ] WebSocket connections establish properly
- [ ] Database persists data through container restarts
- [ ] SSL certificate auto-generates
- [ ] GitHub Actions deploy successfully
- [ ] All environment variables load correctly

## Notes for Implementation

1. **Adapt to your structure**: The templates assume standard locations - adjust paths and names to match your actual project structure

2. **Environment variables**: Replace placeholder values in `.env.example` with your actual required variables

3. **Domain placeholder**: Replace `yourdomain.com` in all configs with the actual domain

4. **Service names**: Ensure Docker service names in compose file match any internal references in your app

5. **Port configuration**: Verify your Fastify app listens on the correct port and accepts proxy headers

6. **WebSocket compatibility**: Test that your WebSocket implementation works through Caddy proxy

This brief provides all the architectural decisions and requirements. The coding agent should now implement the specific configurations based on the actual project structure and requirements found in the repository.