package models

import (
	"goilerplate/repo"
)

var ModelsRepo *repo.AppRepo

func SetModelsConfig(ar *repo.AppRepo) {
	ModelsRepo = ar
}