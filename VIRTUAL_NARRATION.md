# Virtual narration

Owners can choose **Actions → Narrate** on document/web Virtuals. The whole saved
Markdown document is sent server-to-server to Tangereen, without chapter splitting.
Clicking Narrate opens a settings modal populated by Tangereen's authenticated API:
voice, optional translation language, and sanitization before narration. Defaults
remain Echo, original language (no translation), and no extra sanitization. Choosing
a translation language translates the audio text; it is not merely a voice/accent selector.
Settings from the latest narration are preselected when narrating again.
Selecting a voice automatically previews Tangereen's existing static voice sample.
Switching voices, closing the modal, or starting narration stops the previous sample.
The sample audio element is hidden. Selecting **None** stops the preview without
requesting another sample. Choosing translation or submitting with no valid voice
shows the inline red message `please choose a valid voice`; submission is blocked.
If the browser blocks autoplay, selecting the voice again retries the preview. Samples
are proxied through the authenticated Go backend; no API key reaches the browser
and previews do not generate new/billable TTS audio.

Tangereen reuses its existing text-to-speech chunking and FFmpeg concatenation
functions in a separate API-only worker. Only the finished concatenated MP3 is
downloadable, never a partial chunk or an archive. Normal uploads, cleanup, and
production library transfer remain separate and unchanged. Optional sanitization
and translation reuse Tangereen's existing functions, in that order, before TTS.
These settings affect only audio generation, never the Virtual's saved Markdown.

The Go backend downloads the full final file, verifies its size and MP3 header,
checks the Virtual's source revision, and atomically installs it at:

```text
<CONTENT_DIR>/user_<owner ID>/<lesson folder>/sounds/narration.mp3
```

`sounds` is a sibling of the existing `images` folder. Existing audio is preserved
if generation/download fails or content changes during narration. A successful
**Narrate again** replaces the previous MP3; old audio is not versioned. The source
Markdown is never modified. The player supports seeking, downloading, and reloading.
Virtual cards with a nonempty saved MP3 show **Play narration** directly above Delete
(or Leave for collaborator cards), in both All and Shared tabs. Playback opens a modal
without navigating into the lesson; closing it unmounts/stops the audio. Library APIs
include `narrationUrl` only for Virtuals whose saved audio file exists and is nonempty.
Collaborators can listen, but only the owner can start/restart narration. Public
share pages do not expose this feature. Audio uses the same `/data/` serving and
access model as existing lesson assets; asset URLs are not private bearer links.

## Configuration

Reuse the existing server-side `TANJREEN_API_URL` and `TANJREEN_API_KEY`; no new keys
or callback origins are needed. Local development uses `http://localhost:8011` for
Tangereen and `http://localhost:8014` for Zapohteh. FFmpeg must be installed in Tangereen
as it already must be for normal audiobook concatenation. Both backends need the new code.

## API

- Zapohteh `POST /api/virtual-narration?topic=…`: owner authentication, starts one job
  per Virtual, accepting `{voice, language, sanitize}`; duplicate requests return its
  existing status. Settings are validated against Tangereen before a job is created.
- Zapohteh `GET /api/narration-settings`: authenticated proxy of Tangereen's supported
  voices, languages, and defaults. API credentials never reach the browser.
- Zapohteh `GET /api/narration-voices/{voice}/sample`: authenticated proxy of an
  existing Tangereen `voices/sample-<voice>.mp3`, limited to supported voices.
- Zapohteh `GET /api/virtual-narration?topic=…`: owner/collaborator authentication,
  returns `id`, `status`, `phase`, `progress`, `remainingSeconds`, `error`, `audioUrl`, `settings`.
- Tangereen `GET /api/narrations/settings`: API-key-authenticated supported settings.
- Tangereen `POST /api/narrations`: `X-API-Key` auth, JSON
  `{jobId, content, voice, language, sanitize}`. Job ID is 32 lowercase hexadecimal characters.
- Tangereen `GET /api/narrations/:id`: API-key-authenticated progress/status.
- Tangereen `GET /api/narrations/:id/audio`: API-key-authenticated, completed MP3 only.

Jobs persist in SQLite and Tangereen's separate `API_REQUESTS_DIR/narrations` directory.
Go resumes polling persisted running jobs on restart without generating a duplicate job.
If Tangereen itself restarts during generation, the interrupted job is marked failed;
start a new narration. Finished Tangereen output/status is retained for recovery and
requires manual retention management. Temporary working audio is removed after completion
or failure. Source text copies in SQLite are cleared on completion/failure.

Progress uses completed audio chunks, reserves time for concatenation/download, and
appears as the same pale-green horizontal Actions-button fill in expanded/collapsed
panels. ETA is approximate and unknown before the first chunk completes. Narration
and cleanup buttons disable each other in the UI to avoid narrating content as it changes;
backend revision validation still protects API callers and other browser tabs.
The narration action is disabled until its initial status check succeeds, immediately
on submission, and throughout the running job. Synchronous guards prevent rapid duplicate
submissions; stale polls cannot reset a newly accepted running job. Settings stay intact
while the modal is open, even as background status polling continues. Generation controls
are disabled during submission, and failures allow retrying without losing selections.

TTS API usage is billable and shares Tangereen's account limits with normal uploads.
The backend permits up to 12 hours of generation polling and MP3s up to 2 GiB.