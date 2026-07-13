-- Merge the research table into the courses table so all course metadata lives in one place.
-- The resulting courses table has exactly these fields: id, user_id, title, description,
-- cover_image_description, cover_image_path, created_at, updated_at, completed_at.

PRAGMA foreign_keys = OFF;

-- 1. Recreate the courses table with the full course metadata schema.
CREATE TABLE courses_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image_description TEXT,
    cover_image_path VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    UNIQUE(user_id, title)
);

-- 2. Migrate all existing courses, joining research metadata when available, and also
-- migrate any research rows that never had a matching courses row.
INSERT INTO courses_new (
    id,
    user_id,
    title,
    description,
    cover_image_description,
    cover_image_path,
    created_at,
    updated_at,
    completed_at
)
SELECT
    id,
    user_id,
    title,
    description,
    cover_image_description,
    cover_image_path,
    created_at,
    updated_at,
    completed_at
FROM (
    SELECT
        c.id AS id,
        c.user_id AS user_id,
        c.title AS title,
        NULL AS description,
        r.cover_image_description AS cover_image_description,
        r.cover_image_path AS cover_image_path,
        COALESCE(r.created_at, c.created_at) AS created_at,
        COALESCE(r.updated_at, c.updated_at) AS updated_at,
        r.completed_at AS completed_at
    FROM courses c
    LEFT JOIN research r ON r.user_id = c.user_id AND r.title = c.title

    UNION ALL

    SELECT
        NULL AS id,
        r.user_id AS user_id,
        r.title AS title,
        NULL AS description,
        r.cover_image_description AS cover_image_description,
        r.cover_image_path AS cover_image_path,
        r.created_at AS created_at,
        r.updated_at AS updated_at,
        r.completed_at AS completed_at
    FROM research r
    WHERE NOT EXISTS (
        SELECT 1 FROM courses c WHERE c.user_id = r.user_id AND c.title = r.title
    )
);

-- 3. Keep the AUTOINCREMENT sequence aligned with the highest explicit id that was copied over.
DELETE FROM sqlite_sequence WHERE name = 'courses_new';
INSERT INTO sqlite_sequence (name, seq) SELECT 'courses_new', COALESCE(MAX(id), 0) FROM courses_new;

-- 4. Replace the old courses table with the new one and recreate the updated_at trigger.
DROP TABLE courses;
ALTER TABLE courses_new RENAME TO courses;

DROP TRIGGER IF EXISTS trigger_courses_updated_at;
CREATE TRIGGER trigger_courses_updated_at
AFTER UPDATE ON courses
FOR EACH ROW
BEGIN
    UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 5. Drop the now-redundant research table and its trigger.
DROP TABLE IF EXISTS research;
DROP TRIGGER IF EXISTS trigger_research_updated_at;

PRAGMA foreign_keys = ON;
