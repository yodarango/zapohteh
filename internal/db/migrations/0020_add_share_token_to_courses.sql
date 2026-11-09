-- Add a share token to courses so a single lesson can be published through a
-- public link without exposing anything else in the user's account.

ALTER TABLE courses ADD COLUMN share_token VARCHAR(64) DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_share_token ON courses(share_token);
