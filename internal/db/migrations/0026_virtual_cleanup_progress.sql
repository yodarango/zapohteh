ALTER TABLE virtual_cleanups ADD COLUMN progress INTEGER NOT NULL DEFAULT 0;
ALTER TABLE virtual_cleanups ADD COLUMN phase TEXT NOT NULL DEFAULT 'queued';
ALTER TABLE virtual_cleanups ADD COLUMN remaining_seconds INTEGER;