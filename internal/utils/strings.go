package utils

import (
	"math/rand"
)

/**************************************************************************************
* GenerateRandomString generates a random string of specified length
****************************************************************************************/
func GenerateRandomString(length int) string {
	var letters = []rune("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")

	s := make([]rune, length)
	for i := range s {
		s[i] = letters[rand.Intn(len(letters))]
	}
	return string(s)
}