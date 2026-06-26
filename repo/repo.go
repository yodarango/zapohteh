package repo

import (
	"goilerplate/config"
	"goilerplate/internal/db"
)


type AppRepo struct {
	AppConfig *config.AppConfig
	DB *db.DBConfig
}


func NewAppRepo(ac *config.AppConfig, db *db.DBConfig) *AppRepo {
	return &AppRepo{
		AppConfig: ac,
		DB: db,
	}
}