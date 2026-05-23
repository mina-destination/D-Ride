#!/bin/bash
set -e

echo "Downloading Docker Desktop DMG for Apple Silicon..."
curl -L -o Docker.dmg https://desktop.docker.com/mac/main/arm64/Docker.dmg

echo "Mounting DMG..."
hdiutil attach Docker.dmg -mountpoint /Volumes/Docker

echo "Copying Docker.app to /Applications..."
cp -R /Volumes/Docker/Docker.app /Applications/

echo "Detaching DMG..."
hdiutil detach /Volumes/Docker

echo "Cleaning up DMG..."
rm Docker.dmg

echo "Creating symlinks in /opt/homebrew/bin..."
ln -sf /Applications/Docker.app/Contents/Resources/bin/docker /opt/homebrew/bin/docker
ln -sf /Applications/Docker.app/Contents/Resources/bin/docker-compose /opt/homebrew/bin/docker-compose
ln -sf /Applications/Docker.app/Contents/Resources/bin/docker-index /opt/homebrew/bin/docker-index
ln -sf /Applications/Docker.app/Contents/Resources/bin/com.docker.cli /opt/homebrew/bin/com.docker.cli

echo "Docker Desktop installed successfully!"
