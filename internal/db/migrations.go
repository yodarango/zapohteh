package db

import (
	"database/sql"
	"embed"
	"fmt"
	"path/filepath"
	"sort"
	"strings"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

/**************************************************************************************
* RunMigrations executes every SQL migration file in the migrations directory that has
* not yet been recorded in the schema_migrations table. Files are applied in lexical
* order, so new migrations should be named with an increasing numeric prefix.
**************************************************************************************/
func RunMigrations(conn *sql.DB) error {
	if err := ensureMigrationsTable(conn); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	files, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var migrations []string
	for _, file := range files {
		if file.IsDir() || !strings.HasSuffix(file.Name(), ".sql") {
			continue
		}
		migrations = append(migrations, file.Name())
	}
	sort.Strings(migrations)

	for _, name := range migrations {
		applied, err := isMigrationApplied(conn, name)
		if err != nil {
			return fmt.Errorf("failed to check migration %s: %w", name, err)
		}
		if applied {
			continue
		}

		path := filepath.Join("migrations", name)
		sqlBytes, err := migrationsFS.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", name, err)
		}

		tx, err := conn.Begin()
		if err != nil {
			return fmt.Errorf("failed to begin transaction for %s: %w", name, err)
		}

		if _, err := tx.Exec(string(sqlBytes)); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to apply migration %s: %w", name, err)
		}

		if _, err := tx.Exec("INSERT INTO schema_migrations (name) VALUES (?)", name); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to record migration %s: %w", name, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", name, err)
		}
	}

	return nil
}

func ensureMigrationsTable(conn *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name VARCHAR(255) PRIMARY KEY,
			applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`
	_, err := conn.Exec(query)
	return err
}

func isMigrationApplied(conn *sql.DB, name string) (bool, error) {
	var exists int
	err := conn.QueryRow("SELECT 1 FROM schema_migrations WHERE name = ?", name).Scan(&exists)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}
