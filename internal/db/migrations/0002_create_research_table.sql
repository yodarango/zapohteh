-- Research table stores metadata about generated courses, including the cover image prompt and path.
CREATE TABLE IF NOT EXISTS research (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(255) NOT NULL UNIQUE,
    cover_image_description TEXT,
    cover_image_path VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to keep updated_at current on every row update for the research table.
DROP TRIGGER IF EXISTS trigger_research_updated_at;
CREATE TRIGGER trigger_research_updated_at
AFTER UPDATE ON research
FOR EACH ROW
BEGIN
    UPDATE research SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
