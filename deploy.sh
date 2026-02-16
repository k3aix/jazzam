#!/bin/bash

# Jazz Melody Finder - AWS Deployment Script
# Usage: ./deploy.sh <EC2_HOST> [SSH_KEY_PATH]

set -e

EC2_HOST=${1:-""}
SSH_KEY=${2:-"~/.ssh/jazz-ec2.pem"}
REMOTE_DIR="/home/ec2-user/jazz-app"

if [ -z "$EC2_HOST" ]; then
  echo ""
  echo "Jazz Melody Finder - Deployment"
  echo "================================"
  echo ""
  echo "Usage: ./deploy.sh <EC2_PUBLIC_IP> [SSH_KEY_PATH]"
  echo ""
  echo "Example:"
  echo "  ./deploy.sh 54.123.45.67"
  echo "  ./deploy.sh 54.123.45.67 ~/.ssh/my-key.pem"
  echo ""
  echo "Prerequisites:"
  echo "  1. Launch an EC2 t3.micro instance (Amazon Linux 2023)"
  echo "  2. Security group: allow ports 22 (SSH) and 80 (HTTP)"
  echo "  3. Download the SSH key pair (.pem file)"
  echo ""
  echo "First-time EC2 setup (run once):"
  echo "  ssh -i \$SSH_KEY ec2-user@\$EC2_HOST"
  echo "  sudo dnf update -y"
  echo "  sudo dnf install -y docker git"
  echo "  sudo systemctl start docker && sudo systemctl enable docker"
  echo "  sudo usermod -aG docker ec2-user"
  echo "  sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/bin/docker-compose"
  echo "  sudo chmod +x /usr/local/bin/docker-compose"
  echo "  exit  # Re-login for docker group to take effect"
  echo ""
  exit 0
fi

echo ""
echo "Deploying Jazz Melody Finder to $EC2_HOST"
echo "==========================================="
echo ""

# Files to deploy
echo "Syncing project files..."
rsync -avz --progress \
  -e "ssh -i $SSH_KEY" \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'dist' \
  --exclude 'bin' \
  --exclude 'obj' \
  --exclude '.DS_Store' \
  --exclude '.pids' \
  --exclude '.logs' \
  --exclude '.vscode' \
  --exclude '.claude' \
  --exclude 'frontend/node_modules' \
  --exclude 'backend/standards-service/node_modules' \
  --exclude 'backend/search-service/SearchService/bin' \
  --exclude 'backend/search-service/SearchService/obj' \
  --exclude '*.pem' \
  ./ ec2-user@$EC2_HOST:$REMOTE_DIR/

# Check .env.prod exists
if [ ! -f ".env.prod" ]; then
  echo "ERROR: .env.prod file not found!"
  echo "Create it with: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD"
  exit 1
fi

echo ""
echo "Building and starting services on EC2..."
ssh -i $SSH_KEY ec2-user@$EC2_HOST << 'REMOTE'
  cd /home/ec2-user/jazz-app

  # Build and start all services
  docker-compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

  echo ""
  echo "Waiting for services to start..."
  sleep 10

  # Check service health
  echo ""
  echo "Service Status:"
  docker-compose -f docker-compose.prod.yml --env-file .env.prod ps
REMOTE

echo ""
echo "Deployment complete!"
echo ""
echo "Your app is live at: http://$EC2_HOST"
echo ""
echo "Useful commands:"
echo "  # View logs:"
echo "  ssh -i $SSH_KEY ec2-user@$EC2_HOST 'cd $REMOTE_DIR && docker-compose -f docker-compose.prod.yml logs -f'"
echo ""
echo "  # Stop services:"
echo "  ssh -i $SSH_KEY ec2-user@$EC2_HOST 'cd $REMOTE_DIR && docker-compose -f docker-compose.prod.yml down'"
echo ""
echo "  # Import MIDI files into database:"
echo "  ssh -i $SSH_KEY ec2-user@$EC2_HOST 'cd $REMOTE_DIR && docker-compose -f docker-compose.prod.yml exec standards-service node dist/scripts/batchImportMidi.js /app/midi-files/standards'"
echo ""
