# Build stage for React frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app/web

COPY web/package*.json ./
# Use npm ci for faster, more reliable installs in CI/CD
RUN npm ci --prefer-offline --no-audit

COPY web/ ./
RUN npm run build

# Build stage for Go backend
FROM golang:1.24-alpine AS backend-build

# Install build dependencies for CGO and SQLite
RUN apk add --no-cache gcc musl-dev sqlite-dev

WORKDIR /app

COPY go.mod go.sum ./
# Cache Go modules
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY cmd/ ./cmd/
COPY api/ ./api/
COPY internal/ ./internal/
COPY config/ ./config/
COPY constants/ ./constants/
COPY repo/ ./repo/
COPY templates/ ./templates/
COPY .env .

# Build with CGO enabled (required for go-sqlite3)
# Use build cache and compile optimizations
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=1 GOOS=linux go build -v -p 4 -ldflags="-s -w" -o server ./cmd/main

# Final stage
FROM alpine:latest

# Install runtime dependencies for SQLite
RUN apk --no-cache add ca-certificates sqlite-libs

WORKDIR /root/

COPY --from=backend-build /app/server .
COPY --from=backend-build /app/.env .
COPY --from=backend-build /app/templates ./templates
COPY --from=frontend-build /app/web/dist ./web/dist

EXPOSE 8014

CMD ["./server"]