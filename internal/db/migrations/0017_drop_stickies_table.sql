-- Remove the stickies feature and its table from the live server.
DROP TABLE IF EXISTS stickies;
DROP TRIGGER IF EXISTS trigger_stickies_updated_at;
