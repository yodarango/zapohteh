-- Add a language column to the courses table so we can store the language
-- selected by the user when the lesson was created.

ALTER TABLE courses ADD COLUMN language VARCHAR(255) DEFAULT NULL;
