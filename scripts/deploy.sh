#!/bin/zsh

source ~/.zshrc

set -e

# Check if a commit message was provided
if [ "$#" -ne 1 ]; then
    echo "Please provide a commit message"
    exit 1
fi

# The commit message is the first argument to the script
COMMIT_MESSAGE="$1"

# Add changes to the staging area
git add .

# Commit only if there are staged changes; otherwise continue with the deployment
if ! git diff --cached --quiet; then
    git commit -m "$COMMIT_MESSAGE"
else
    echo "No local changes to commit, continuing with deployment"
fi

# Push changes to the Git repository (no-op if everything is up to date)
git push

echo "🐈 Done pushing changes to git. Now pulling changes to VPS."

# Deploy to the VPS
ssh_main "\
cd /var/www/repos/zapohteh/app && \
git fetch origin && \
git reset --hard origin/main && \
git pull && \
echo '👍 pulled changes from git and reset to origin' && \
echo 'Current directory: ' && pwd && \
echo '🏗️ Building docker now...' && \
docker compose down && \
docker compose up -d --build && \
echo '🚀🚀🚀 Deployment successful'"


echo "⭐️🚀✅ Deployment successful"
