package models

import (
	"zapohteh/repo"
)

var ModelsRepo *repo.AppRepo

func SetModelsConfig(ar *repo.AppRepo) {
	ModelsRepo = ar
}