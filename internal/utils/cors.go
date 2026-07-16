package utils

import (
	"fmt"
	"net/http"
	"os"
)


func EnableCORS(next http.Handler) http.Handler {
	corsOrigin := os.Getenv("CORS_ORIGIN")

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set CORS headers for the preflight request and Auth
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
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
