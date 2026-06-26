package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
	_ "github.com/mattn/go-sqlite3"
)


type DBConfig struct {
	Conn *sql.DB
}


func DBConnection() (*sql.DB, error) {

	// Load environment variables if a .env file is present.
	// The file is optional: a default SQLite path is used when DB_PATH is not set.
	_ = godotenv.Load()

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/app.db"
	}

	// Ensure the directory that will hold the database file exists.
	if dir := filepath.Dir(dbPath); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("could not create db directory: %w", err)
		}
	}

	dsn := fmt.Sprintf("%s?_fk=true&_journal_mode=WAL", dbPath)

	db, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open db: \n %w", err)
	}

	// Make sure the database is reachable before continuing.
	err = db.Ping()
	if err != nil {
		return nil, fmt.Errorf("unable to ping db: \n %w", err)
	}

	return db, nil

}

func NewDBConnection(dbConn * sql.DB) *DBConfig {
	return &DBConfig{
		Conn: dbConn,
	}
}