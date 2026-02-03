#!/bin/bash

# Jazz Melody Finder - Development Startup Script
# Starts all services needed for the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# PID files for cleanup
PID_DIR="$PROJECT_ROOT/.pids"
mkdir -p "$PID_DIR"

# Log files
LOG_DIR="$PROJECT_ROOT/.logs"
mkdir -p "$LOG_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Jazz Melody Finder - Dev Startup    ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check and kill processes on required ports
check_and_kill_port() {
    local port=$1
    local pid=$(lsof -ti:$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo -e "${YELLOW}  Port $port is in use (PID $pid), stopping...${NC}"
        kill $pid 2>/dev/null || true
        sleep 1
    fi
}

echo -e "${YELLOW}Checking for port conflicts...${NC}"
check_and_kill_port 3000
check_and_kill_port 3001
check_and_kill_port 5001
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down services...${NC}"

    # Kill background processes
    if [ -f "$PID_DIR/frontend.pid" ]; then
        kill $(cat "$PID_DIR/frontend.pid") 2>/dev/null || true
        rm "$PID_DIR/frontend.pid"
    fi

    if [ -f "$PID_DIR/standards-service.pid" ]; then
        kill $(cat "$PID_DIR/standards-service.pid") 2>/dev/null || true
        rm "$PID_DIR/standards-service.pid"
    fi

    if [ -f "$PID_DIR/search-service.pid" ]; then
        kill $(cat "$PID_DIR/search-service.pid") 2>/dev/null || true
        rm "$PID_DIR/search-service.pid"
    fi

    # Stop Docker containers
    echo -e "${YELLOW}Stopping Docker containers...${NC}"
    docker-compose -f "$PROJECT_ROOT/docker-compose.yml" down 2>/dev/null || true

    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

# Trap SIGINT and SIGTERM
trap cleanup SIGINT SIGTERM

# Function to wait for a port to be available
wait_for_port() {
    local port=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    echo -n "  Waiting for $name (port $port)"
    while ! nc -z localhost $port 2>/dev/null; do
        if [ $attempt -ge $max_attempts ]; then
            echo -e " ${RED}FAILED${NC}"
            return 1
        fi
        echo -n "."
        sleep 1
        ((attempt++))
    done
    echo -e " ${GREEN}OK${NC}"
    return 0
}

# Step 1: Start Docker containers
echo -e "${BLUE}[1/4] Starting Docker containers...${NC}"
docker-compose -f "$PROJECT_ROOT/docker-compose.yml" up -d

# Wait for PostgreSQL
wait_for_port 5432 "PostgreSQL"

# Wait for Redis
wait_for_port 6379 "Redis"

echo ""

# Step 2: Start Standards Service (Node.js)
echo -e "${BLUE}[2/4] Starting Standards Service (Node.js)...${NC}"
cd "$PROJECT_ROOT/backend/standards-service"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install > "$LOG_DIR/standards-service-install.log" 2>&1
fi

# Start the service
npm run dev > "$LOG_DIR/standards-service.log" 2>&1 &
echo $! > "$PID_DIR/standards-service.pid"

wait_for_port 3001 "Standards Service"
echo ""

# Step 3: Start Search Service (C# .NET)
echo -e "${BLUE}[3/4] Starting Search Service (C# .NET)...${NC}"
cd "$PROJECT_ROOT/backend/search-service/SearchService"

# Start the service
dotnet run > "$LOG_DIR/search-service.log" 2>&1 &
echo $! > "$PID_DIR/search-service.pid"

wait_for_port 5001 "Search Service"
echo ""

# Step 4: Start Frontend (React/Vite)
echo -e "${BLUE}[4/4] Starting Frontend (React/Vite)...${NC}"
cd "$PROJECT_ROOT/frontend"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    npm install > "$LOG_DIR/frontend-install.log" 2>&1
fi

# Start the frontend
npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
echo $! > "$PID_DIR/frontend.pid"

wait_for_port 3000 "Frontend (Vite)"
echo ""

# All services started
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   All services are running!           ${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "  ${BLUE}Frontend:${NC}          http://localhost:3000"
echo -e "  ${BLUE}Search Service:${NC}    http://localhost:5001"
echo -e "  ${BLUE}Standards Service:${NC} http://localhost:3001"
echo -e "  ${BLUE}PostgreSQL:${NC}        localhost:5432"
echo -e "  ${BLUE}Redis:${NC}             localhost:6379"
echo -e "  ${BLUE}pgAdmin:${NC}           http://localhost:5050"
echo ""
echo -e "  ${YELLOW}Logs:${NC} $LOG_DIR/"
echo ""
echo -e "  Press ${RED}Ctrl+C${NC} to stop all services"
echo ""

# Keep the script running
while true; do
    sleep 1
done
