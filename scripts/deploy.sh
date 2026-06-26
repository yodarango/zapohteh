#!/bin/zsh

source ~/.zshrc

# Delete this line
echo "Please set up deployment file before proceeding."
exit 1

# Check if a commit message was provided
if [ "$#" -ne 1 ]; then
    echo "Please provide a commit message"
    exit 1
fi

# The commit message is the first argument to the script
COMMIT_MESSAGE="$1"

# Add changes to the staging area
# You can adjust this to add specific files or use other git add options
git add .

# Commit the changes with the provided commit message
git commit -m "$COMMIT_MESSAGE"

# Push changes to the Git repository
git push

# Check if the push was successful
if [ $? -eq 0 ]; then
    echo "🐈 Done pushing changes to git. Now pulling changes to VPS."
else
    echo "Git push failed"
    exit 1
fi

# Copy the files to the VPS
ssh_main "\
cd /var/www/repos/where?; \
git reset --hard origin/main; \
git pull; \
echo '👍 pulled changes from git and reset to origin'; \
echo 'Current directory: '; pwd; \
echo '🏗️ Building docker now...';\
docker compose down
docker compose up -d --build; \
echo '🚀🚀🚀 Deployment successful'"


echo "⭐️🚀✅ Deployment successful"
