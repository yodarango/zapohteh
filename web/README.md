# Zapohteh

## Background course creation

Course creation is queued in SQLite and processed by the application server. Once
the Create page confirms that a job is queued, the browser can be closed; returning
to Create shows the saved status. A single application instance must run the
worker: starting a second instance against the same database would incorrectly
mark another instance's running jobs as interrupted. After a server restart,
queued jobs continue and jobs that were running are marked interrupted; partial
course content is retained and a new title is needed to start again.

PDF imports are staged until processing finishes. Set `JOB_UPLOAD_DIR` to a private,
persistent directory outside `CONTENT_DIR` and outside any static-file root. The
included Compose configuration mounts `./job-uploads` separately; customize it
with `HOST_JOB_UPLOAD_PATH`. Without `JOB_UPLOAD_DIR`, uploads are stored in a
`.course-job-uploads` sibling of `CONTENT_DIR`. A browser must remain open until
its upload and job submission have been confirmed. Temporary files can contain
private documents and are deleted after processing or interruption; orphaned
files are cleaned up after 24 hours.

Optional course-ready emails use the existing `SMTP_HOST`, `SMTP_PORT`,
`SMTP_USERNAME`, `SMTP_PASSWORD`, and `FROM_EMAIL` settings. Set `BASE_URL` to
the public absolute application URL. Email is attempted independently of course
creation and retried up to three times; a failed email does not fail the course.

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
