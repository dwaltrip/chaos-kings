#!/bin/bash

# Development script for Generals v2 - starts both frontend and backend
set -e

# Source fnm to ensure we're using the correct Node version
if command -v fnm &> /dev/null; then
    eval "$(fnm env --use-on-cd)"
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Get the project root (parent of tools directory)
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Starting Generals v2 development servers..."

# Function to cleanup background processes on script exit
cleanup() {
    echo ""
    echo "🛑 Shutting down development servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    exit
}

# Set up trap to cleanup on script termination
trap cleanup SIGINT SIGTERM EXIT

# Start backend development server
echo "📦 Starting backend server..."
cd "$PROJECT_ROOT/apps/backend"
fnm use 2>/dev/null || true
npm run start &
BACKEND_PID=$!

# Give the backend a moment to start up
sleep 2

# Start frontend development server
echo "⚛️  Starting frontend server..."
cd "$PROJECT_ROOT/apps/frontend"
fnm use 2>/dev/null || true
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers are starting up..."
echo "   📦 Backend: http://localhost:3001 (PID: $BACKEND_PID)"
echo "   ⚛️  Frontend: http://localhost:5173 (PID: $FRONTEND_PID)"
echo ""
echo "💡 Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes to complete (or be interrupted)
wait $BACKEND_PID $FRONTEND_PID
