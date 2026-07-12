package api

import "zapohteh/repo"

var RouterConfig *repo.AppRepo

func SetRouterConfig(ar * repo.AppRepo){
	RouterConfig = ar
}