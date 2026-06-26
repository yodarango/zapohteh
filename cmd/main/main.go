package main

import (
	"goilerplate/api"
	"goilerplate/config"
	"goilerplate/internal/db"
	"goilerplate/internal/models"
	"goilerplate/repo"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)


func main (){


	// set up the db
	conn, err:= db.DBConnection()

	// there is no point to continue after this if the db fails
	if err != nil {
		panic(err)
	}

	dbConfig := db.NewDBConnection(conn)
	defer dbConfig.Conn.Close()
	
	// set up the app
	err = godotenv.Load()
	if err != nil {
		log.Fatal(err)
	}
	env := os.Getenv("ENV")
	appConfig := config.NewAppConfig(env)

	appRepo := repo.NewAppRepo(appConfig, dbConfig)

	// pass repo to all necessary components
	api.SetRouterConfig(appRepo)
	models.SetModelsConfig(appRepo)

	// inizialize the server
	server := &http.Server{
		Addr: ":8008",
		Handler: api.Router(),
		MaxHeaderBytes: 5 << 20 ,

	}

	err = server.ListenAndServe()
	if err != nil {
		log.Fatalf("Error starting server: %v", err)
		os.Exit(1) 
	}
}