package models

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"zapohteh/constants"
)

type AuthUser struct {
	FirstName      string `json:"first_name"`
	LastName       string `json:"last_name"`
	Username       string `json:"username"`
	Email          string `json:"email"`
	Avatar         string `json:"avatar"`
	Status         Status `json:"status"`
	Id            uint   `json:"ID"`
}

/**************************************************************************************
* generates a JWT token. Used primarily during the login and sign up process
*
* status: ✅
***************************************************************************************/
func (user *AuthUser) GenerateJWT() (string, error) {

	secretEnv := os.Getenv("JWT_SECRET")
	secret := []byte(secretEnv)
	token := jwt.NewWithClaims(jwt.SigningMethodHS256,
		jwt.MapClaims{
			// "exp":       time.Now().Add(time.Hour * 24).Unix() //no exp date
			"first_name":     user.FirstName,
			"last_name":      user.LastName,
			"avatar":         user.Avatar,
			"email":          user.Email,
			"username":       user.Username,
			"id":             user.Id,
			"status":         user.Status,
		})

	tokenString, err := token.SignedString(secret)
	if err != nil {
		return "", fmt.Errorf("Error signing JWT: %w", err)
	}

	tokenString = "Bearer " + tokenString
	return tokenString, nil
}

/**************************************************************************************
* verifies that the token in the request is valid
*
* status: ✅
**************************************************************************************/
func VerifyToken(tokenString string) (*AuthUser, error) {
	var tokenVerificationFailed = errors.New("failed to verify the token")
	secretEnv := os.Getenv("JWT_SECRET")
	secret := []byte(secretEnv)
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		return secret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, tokenVerificationFailed
	}

	// Extract claims from the token
	claims, ok := token.Claims.(jwt.MapClaims)

	if ok && token.Valid {
		// Access the claim values and construct AuthUser object
		authUser := &AuthUser{
			FirstName:      claims["first_name"].(string),
			LastName:       claims["last_name"].(string),
			Email:          claims["email"].(string),
			Avatar:         claims["avatar"].(string),
			Status:         Status(claims["status"].(string)),
			Username:       claims["username"].(string),
			Id:             uint(claims["id"].(float64)),
		}
		return authUser, nil
	} else {
		return nil, errors.New("failed to parse claims")
	}
}


/**************************************************************************************
* I Will either return an error if not authenticated or continue with the request
* if it is. If the authentication is successful it will append the
* decoded user to the request context.
*
* Status: ✅
**************************************************************************************/
func Authenticate(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenString := r.Header.Get("Authorization")

		var response HttpResponse

		if tokenString != "" {
			tokenString = tokenString[len("Bearer "):]
			tokenString = strings.ReplaceAll(strings.TrimSpace(tokenString), "\"", "")
		}

		// ask chat gpt how to return the user in the context
		user, verificationErr := VerifyToken(tokenString)

		// this user is not authenticated
		if tokenString == "" || verificationErr != nil {
			fmt.Println("Failed to verify token: ", verificationErr)

			response.Error = "You need to authenticate before accessing this resource"
			response.Data = nil
			response.Success = false

			response.Send(w)
			return
		}

		// add the user to the context
		ctx := context.WithValue(r.Context(), constants.USER_CONTEXT_AUTH_KEY, user)
		next(w, r.WithContext(ctx))

	}
}

/**************************************************************************************
* AuthenticateAPIKey validates the API key provided either in the X-API-Key header or
* the apiKey query parameter against the API_KEY environment variable. On success it
* stores the key in the request context and calls the next handler.
**************************************************************************************/
func AuthenticateAPIKey(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		expectedKey := os.Getenv("API_KEY")
		if expectedKey == "" {
			http.Error(w, "API key is not configured on the server", http.StatusInternalServerError)
			return
		}

		providedKey := strings.TrimSpace(r.Header.Get("X-API-Key"))
		if providedKey == "" {
			providedKey = strings.TrimSpace(r.URL.Query().Get("apiKey"))
		}

		if providedKey == "" || providedKey != expectedKey {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"success":false,"error":"Invalid or missing API key"}`))
			return
		}

		ctx := context.WithValue(r.Context(), constants.API_KEY_CONTEXT_KEY, providedKey)
		next(w, r.WithContext(ctx))
	}
}
