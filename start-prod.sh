#!/bin/bash

# Jazz Melody Finder - Production Startup Script
# Runs the full stack via Docker using docker-compose.prod.yml
# Usage: ./start-prod.sh [--build] [--down]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"
ENV_FILE="$PROJECT_ROOT/.env.prod"
COMPOSE_CMD="docker compose"

# Parse arguments
BUILD_FLAG=""
for arg in "$@"; do
  case $arg in
    --build) BUILD_FLAG="--build" ;;
    --down)
      echo -e "${YELLOW}Stopping production services...${NC}"
      $COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
      echo -e "${GREEN}Stopped.${NC}"
      exit 0
      ;;
  esac
done

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   Jazz Melody Finder - Production         ${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check prerequisites
if ! command -v docker &> /dev/null; then
  echo -e "${RED}ERROR: Docker is not installed or not running.${NC}"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}ERROR: .env.prod not found at $ENV_FILE${NC}"
  echo "Create it with:"
  echo "  POSTGRES_DB=jazz_standards"
  echo "  POSTGRES_USER=jazzuser"
  echo "  POSTGRES_PASSWORD=<your-password>"
  exit 1
fi

# Stop any existing containers
echo -e "${YELLOW}Stopping any existing containers...${NC}"
$COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down 2>/dev/null || true
echo ""

# Build and start
echo -e "${BLUE}Building and starting services...${NC}"
$COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build $BUILD_FLAG
echo ""

# Wait for a container to be running/healthy
wait_for_container() {
  local container=$1
  local name=$2
  local max=30
  local i=1
  echo -n "  Waiting for $name"
  while true; do
    status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "missing")
    health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo "none")
    if [ "$status" = "running" ] && ([ "$health" = "none" ] || [ "$health" = "healthy" ]); then
      echo -e " ${GREEN}OK${NC}"
      return 0
    fi
    if [ $i -ge $max ]; then
      echo -e " ${RED}FAILED${NC}"
      docker logs "$container" --tail 20 2>/dev/null
      return 1
    fi
    echo -n "."
    sleep 2
    ((i++))
  done
}

wait_for_container jazz-postgres  "PostgreSQL"
wait_for_container jazz-standards  "Standards Service"
wait_for_container jazz-search     "Search Service"
wait_for_container jazz-frontend   "Frontend (nginx)"

# Also wait for port 80 to be reachable on the host
echo -n "  Waiting for port 80"
for i in $(seq 1 15); do
  if nc -z localhost 80 2>/dev/null; then
    echo -e " ${GREEN}OK${NC}"
    break
  fi
  echo -n "."
  sleep 1
done
echo ""

# Check if this is first run (no data imported yet)
STANDARDS_COUNT=$($COMPOSE_CMD -f "$COMPOSE_FILE" --env-file "$ENV_FILE" \
  exec -T postgres psql -U jazzuser -d jazz_standards -tAc \
  "SELECT COUNT(*) FROM standards;" 2>/dev/null || echo "0")

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   All services are running!               ${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "  ${BLUE}App:${NC}               http://localhost"
echo -e "  ${BLUE}Standards in DB:${NC}   $STANDARDS_COUNT"
echo ""

if [ "$STANDARDS_COUNT" = "0" ] || [ "$STANDARDS_COUNT" = "" ]; then
  echo -e "${YELLOW}No standards in database yet. Import MIDI files with:${NC}"
  echo "  $COMPOSE_CMD -f docker-compose.prod.yml --env-file .env.prod exec standards-service node dist/scripts/batchImportMidi.js /app/midi-files/standards"
  echo ""
fi

echo "Useful commands:"
echo "  # View logs:"
echo "  docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "  # Stop services:"
echo "  ./start-prod.sh --down"
echo ""
echo "  # Rebuild after code changes:"
echo "  ./start-prod.sh --build"
echo ""
