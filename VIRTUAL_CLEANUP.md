# Virtual cleanup integration

The owner of a Virtual (document or web import) can select **Actions → Clean up**.
AI courses, collaborators, and public share views do not expose this destructive action.
The entire saved Markdown document is sent as one `content` string to Tangereen;
the browser never receives its API key. Cleanup does not preserve chapter boundaries.

## Configuration

Zapohteh environment:

- `TANJREEN_API_KEY`: the value of Tangereen's existing `API_KEY`.
- `TANJREEN_API_URL`: optional origin, default `https://tanjreen.shrood.app`.
- `BASE_URL`: this app's externally reachable origin, without a trailing slash.
- `VIRTUAL_CLEANUP_BACKUP_DIR`: optional private backup directory **outside** `CONTENT_DIR`.
  Defaults to `.virtual-cleanup-backups` beside the content directory. Docker Compose
  maps `/app/cleanup-backups` to `HOST_CLEANUP_BACKUP_PATH` (default `./.virtual-cleanup-backups`).

Tangereen environment:

- `API_KEY`: its existing programmatic API key.
- `ZAPOHTEH_BASE_URL`: must match Zapohteh's `BASE_URL`. Callback destinations are allowlisted to this exact origin/path.
- `API_REQUESTS_DIR`: existing persistent request directory; cleanup queue files live in its `cleanup-jobs` subdirectory.

The new SQLite migration runs through the existing migration mechanism on server startup.
Both apps must run the updated code for cleanup to work. No deployment is performed by these changes.

## Protocol and behavior

- `POST /api/virtual-cleanup?topic=…`: owner-authenticated start, returns a tracked job.
- `GET /api/virtual-cleanup?topic=…`: owner-authenticated latest status.
- Tangereen `POST /api/cleanup`: `X-API-Key` authentication; accepts `jobId`, `bookTitle`,
  `content`, `callbackUrl`, and a random per-job `callbackToken`. Returns HTTP 202 after persisting the job.
- `POST /api/virtual-cleanup/callback`: authenticates the per-job bearer token against its stored hash;
  accepts `jobId` and either a single cleaned `content` string or an `error`.

Tangereen reuses the existing sanitizer with a document-preserving prompt; it does not run
translation, speech, audio transfer, or the interactive audiobook pipeline. Tangereen uses
size-based AI chunks internally, not chapters, and joins them into one final document.
Headings are ordinary editable content, not protected chapter boundaries.
Empty output, invalid credentials, and changed source revisions never replace content.

The original document is backed up privately as `content.original.md`; the first cleanup also
backs up the old chapter index and files. The final document is staged on the same filesystem,
synced, and atomically renamed to `cleaned-content.md`. That file becomes authoritative for
reading, sharing, and future cleanups. The old chapter files stay inactive for recovery;
the reader receives an empty chapter list and does not infer new chapters from headings.
To restore the pre-cleanup document, atomically replace `cleaned-content.md` with its backup,
or remove it to reactivate the old chapter files (for the first cleanup only).
Backups are retained indefinitely for manual recovery and should be included in storage management.

Cover, title, subjects, bibliography, notes, highlights, and sharing settings are retained.
Highlights referencing removed text may no longer match. Reading checkpoints are invalidated/reset.
The reader monitors completion and refreshes its content without navigating away.

### Cleanup progress

Tangereen reports actual completed sanitizer chunks using the same authenticated callback,
with a `progress` object containing `phase`, `completedChunks`, `totalChunks`, and nullable
`remainingSeconds`. Progress events never replace document content. They are stored by the
Go backend and exposed by the existing owner-authenticated status endpoint.

Chunk processing fills 0–95%; the final 5% is reserved for saving/replacing content.
The expanded Actions button fills pale green left-to-right, and the collapsed brush icon
has a clockwise circular fill. Percentages describe completed work, so the unfilled part
represents work left. Time left is an estimate based on average completed-chunk duration,
not a guaranteed countdown; before a chunk finishes, the UI says it is estimating.
Queued jobs and final content replacement have separate labels. Progress is polled every
second while running and remains available after reloading. Normal audiobook uploads
continue using their existing sanitizer/chunking path without these callbacks.

Tangereen resumes persisted queue work on restart and retries callback delivery with backoff for
up to 24 hours; undelivered payloads remain on disk for recovery. Work interrupted before a result
was saved may repeat sanitization calls. Zapohteh marks a job timed out after two hours when its
status is next checked. If Zapohteh restarts before dispatching a newly created job, that job must
time out before retrying. Expired/finished callbacks are acknowledged without reapplying content.

HTTP is supported for loopback development; use HTTPS origins for production.

## Local development troubleshooting

For the default local servers, use `BASE_URL=http://localhost:8014` and
`TANJREEN_API_URL=http://localhost:8011` in Zapohteh, and
`ZAPOHTEH_BASE_URL=http://localhost:8014` in Tangereen.
Restart the Go backend after changing its environment. Tangereen's updated nodemon
configuration watches `.env`; an already running nodemon supervisor must be restarted
once to load that updated watcher configuration. `npm start` requires manual restarts.

If dispatch fails, the cleanup status includes the upstream HTTP status and recognized
configuration error. For example, HTTP 503 with `ZAPOHTEH_BASE_URL is not configured`
means the running Tangereen process has not loaded that setting, even if it is already
present in `.env`. Restart Tangereen and select **Clean up** again to create a new job.