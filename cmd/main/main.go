package main

import (
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
	"zapohteh/api"
	"zapohteh/config"
	"zapohteh/internal/db"
	"zapohteh/internal/models"
	"zapohteh/repo"
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
	// Load environment variables from a .env file if present, but do not fail
	// if the file is missing (e.g. when running in Docker with env vars injected).
	_ = godotenv.Load()
	env := os.Getenv("ENV")
	appConfig := config.NewAppConfig(env)

	appRepo := repo.NewAppRepo(appConfig, dbConfig)

	// pass repo to all necessary components
	api.SetRouterConfig(appRepo)
	models.SetModelsConfig(appRepo)

	// inizialize the server
	server := &http.Server{
		Addr: ":8014",
		Handler: api.Router(),
		MaxHeaderBytes: 5 << 20 ,

	}

	err = server.ListenAndServe()
	if err != nil {
		log.Fatalf("Error starting server: %v", err)
		os.Exit(1) 
	}
}