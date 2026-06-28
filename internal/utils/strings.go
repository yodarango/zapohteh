package utils

import (
	"math/rand"
	"strings"
	"unicode"
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

/**************************************************************************************
* ToCamelCase converts an arbitrary string into camelCase, splitting on any
* non-alphanumeric character (e.g. "Introduction to Go" -> "introductionToGo").
****************************************************************************************/
func ToCamelCase(s string) string {
	words := strings.FieldsFunc(s, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})

	var b strings.Builder
	for i, word := range words {
		runes := []rune(word)
		if i == 0 {
			b.WriteString(strings.ToLower(word))
			continue
		}
		b.WriteString(strings.ToUpper(string(runes[0])))
		b.WriteString(strings.ToLower(string(runes[1:])))
	}
	return b.String()
}

/**************************************************************************************
* ToSlug converts an arbitrary string into a lowercase, dash separated slug suitable
* for file names (e.g. "The Story of Anna" -> "the-story-of-anna").
****************************************************************************************/
func ToSlug(s string) string {
	words := strings.FieldsFunc(s, func(r rune) bool {
		return !unicode.IsLetter(r) && !unicode.IsNumber(r)
	})
	for i, word := range words {
		words[i] = strings.ToLower(word)
	}
	return strings.Join(words, "-")
}

/**************************************************************************************
* ToTitleCase converts a string into Title Case, capitalizing the first letter of
* every whitespace separated word and lowering the rest (e.g. "the crusades" ->
* "The Crusades").
****************************************************************************************/
func ToTitleCase(s string) string {
	words := strings.Fields(s)
	for i, word := range words {
		runes := []rune(word)
		runes[0] = unicode.ToUpper(runes[0])
		for j := 1; j < len(runes); j++ {
			runes[j] = unicode.ToLower(runes[j])
		}
		words[i] = string(runes)
	}
	return strings.Join(words, " ")
}

/**************************************************************************************
* SanitizeFilename strips characters that are unsafe for file and folder names,
* keeping letters, numbers, spaces, dashes and underscores. The result is trimmed
* and capped to a reasonable length.
****************************************************************************************/
func SanitizeFilename(s string) string {
	cleaned := strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsNumber(r) || r == ' ' || r == '-' || r == '_' {
			return r
		}
		return -1
	}, s)

	cleaned = strings.TrimSpace(cleaned)
	if len(cleaned) > 100 {
		cleaned = strings.TrimSpace(cleaned[:100])
	}
	return cleaned
}