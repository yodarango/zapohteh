# Build stage for React frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/web

COPY web/package*.json ./
RUN npm install

COPY web/ ./
RUN npm run build

# Build stage for Go backend
FROM golang:1.24-alpine AS backend-build

# Install build tools required for CGO (SQLite driver)
RUN apk add --no-cache build-base

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ ./cmd/
COPY api/ ./api/
COPY internal/ ./internal/
COPY config/ ./config/
COPY constants/ ./constants/
COPY repo/ ./repo/
COPY templates/ ./templates/
COPY .env .

RUN go build -o server ./cmd/main

# Final stage
FROM alpine:latest

RUN apk --no-cache add ca-certificates libgcc

WORKDIR /root/

COPY --from=backend-build /app/server .
COPY --from=backend-build /app/.env .
COPY --from=backend-build /app/templates ./templates
COPY --from=frontend-build /app/web/dist ./web/dist

EXPOSE 8008

CMD ["./server"]