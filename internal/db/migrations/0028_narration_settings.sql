ALTER TABLE virtual_narrations ADD COLUMN voice TEXT NOT NULL DEFAULT 'echo';
ALTER TABLE virtual_narrations ADD COLUMN language TEXT NOT NULL DEFAULT '';
ALTER TABLE virtual_narrations ADD COLUMN sanitize INTEGER NOT NULL DEFAULT 0;