# Zapohteh

AI-powered learning companion. Research any topic with AI and turn it into structured courses. Track your reading progress, chat with an AI assistant, and organize your learning by subjects.

## What's included

- Go backend with authentication, JWT, and AI-powered course generation
- SQLite database setup with migrations
- React frontend with Vite, React Router, and a custom design system
- Docker and Docker Compose configuration
- Email templates for verification, welcome, and password reset

## NAMING CONVENTIONS

- All dates prefixed with at are in `time.Time` format
- All dates suffixed with `Date` are in `string` format
- Function that return Date structs must return the date `2000-01-01 00:00:00` if there is no date to return. This is to avoid returning a `&reference` of date to allow for `nil`
