package utils

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/joho/godotenv"
)


func EnableCORS(next http.Handler) http.Handler{
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		err := godotenv.Load(".env")

		if err != nil {
			log.Fatalf("Error loading .env file")
		}

		corsOrigin := os.Getenv("CORS_ORIGIN")

		// Set CORS headers for the preflight request and Auth
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true") // Set this if you're using credentials (cookies, HTTP authentication)
		w.Header().Set("Access-Control-Allow-Origin", corsOrigin)

		fmt.Printf("CORS set \n\n")

		if r.Method == "OPTIONS" {
			// Preflight request, respond with 200 OK
			w.WriteHeader(http.StatusOK)
			return
		}

		// Call the original handler
		next.ServeHTTP(w, r)
	})
}
