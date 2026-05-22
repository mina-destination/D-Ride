#!/bin/bash
set -e

# Configuration variables
PROJECT_ID=${GCP_PROJECT_ID:-"your-gcp-project-id"}
REGION=${GCP_REGION:-"us-central1"}
REPO_NAME="d-ride-repo"

# Service Names
API_SERVICE="dride-api"
CLIENT_SERVICE="dride-client"
ADMIN_SERVICE="dride-admin"
DRIVER_SERVICE="dride-driver"

echo "============================================="
echo " Deploying D-Ride Platform to Google Cloud Run"
echo " Project: $PROJECT_ID | Region: $REGION"
echo "============================================="

# Ensure Artifact Registry exists (Uncomment if needed)
# gcloud artifacts repositories create $REPO_NAME \
#     --repository-format=docker \
#     --location=$REGION \
#     --description="Docker repository for D-Ride Platform" \
#     --project=$PROJECT_ID || true

# 1. Build and Deploy API
echo ">> Building API..."
gcloud builds submit --tag $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$API_SERVICE:latest . --config apps/api/cloudbuild.yaml || \
docker build -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$API_SERVICE:latest -f apps/api/Dockerfile .

echo ">> Pushing API..."
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$API_SERVICE:latest

echo ">> Deploying API to Cloud Run..."
gcloud run deploy $API_SERVICE \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$API_SERVICE:latest \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --port 3000

# Extract API URL to inject into frontends
API_URL=$(gcloud run services describe $API_SERVICE --platform managed --region $REGION --project $PROJECT_ID --format 'value(status.url)')
echo "API deployed at: $API_URL"

# 2. Build and Deploy Client App
echo ">> Building Client App..."
docker build --build-arg VITE_API_URL=$API_URL/api -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$CLIENT_SERVICE:latest -f apps/client-app/Dockerfile .

echo ">> Pushing Client App..."
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$CLIENT_SERVICE:latest

echo ">> Deploying Client App to Cloud Run..."
gcloud run deploy $CLIENT_SERVICE \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$CLIENT_SERVICE:latest \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --port 80

# 3. Build and Deploy Admin Dashboard
echo ">> Building Admin Dashboard..."
docker build --build-arg VITE_API_URL=$API_URL/api -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$ADMIN_SERVICE:latest -f apps/admin-dashboard/Dockerfile .

echo ">> Pushing Admin Dashboard..."
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$ADMIN_SERVICE:latest

echo ">> Deploying Admin Dashboard to Cloud Run..."
gcloud run deploy $ADMIN_SERVICE \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$ADMIN_SERVICE:latest \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --port 80

# 4. Build and Deploy Driver Portal
echo ">> Building Driver Portal..."
docker build --build-arg VITE_API_URL=$API_URL/api -t $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$DRIVER_SERVICE:latest -f apps/driver-portal/Dockerfile .

echo ">> Pushing Driver Portal..."
docker push $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$DRIVER_SERVICE:latest

echo ">> Deploying Driver Portal to Cloud Run..."
gcloud run deploy $DRIVER_SERVICE \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/$DRIVER_SERVICE:latest \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --port 80

echo "============================================="
echo " Deployment Complete! 🎉"
echo "============================================="
