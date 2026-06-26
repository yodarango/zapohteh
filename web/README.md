# Goilerplate

A clean boilerplate for full-stack applications built with Go and React.

## What's included

- Go backend with sample auth routes and JWT authentication
- MySQL database setup with migrations
- React frontend with Vite, React Router, and a custom design system
- Docker and Docker Compose configuration
- Email templates for verification, welcome, and password reset

## NAMING CONVENTIONS

- All dates prefixed with at are in `time.Time` format
- All dates suffixed with `Date` are in `string` format
- Function that return Date structs must return the date `2000-01-01 00:00:00` if there is no date to return. This is to avoid returning a `&reference` of date to allow for `nil`
