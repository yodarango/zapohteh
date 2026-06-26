package api

import "goilerplate/repo"

var RouterConfig *repo.AppRepo

func SetRouterConfig(ar * repo.AppRepo){
	RouterConfig = ar
}