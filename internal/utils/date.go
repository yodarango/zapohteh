package utils

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

func FormatDateAndTime(t time.Time, format ...string) string {
	now := time.Now()
	
	// Controlla se è stato specificato un formato
	formatType := ""
	if len(format) > 0 {
		formatType = format[0]
	}
	
	// Se è richiesto solo il tempo, restituisci subito
	if formatType == "time" {
		return formatTime(t)
	}
	
	// Determina il formato in base all'anno
	var dateFormat string
	if t.Year() == now.Year() {
		dateFormat = "January 2, 3:04 PM" // Stesso anno, non mostrare l'anno
	} else {
		dateFormat = "January 2, 2006 3:04 PM" // Anno diverso, mostra l'anno
	}
	
	// Se è richiesta solo la data, usa un formato senza ora
	if formatType == "date" {
		if t.Year() == now.Year() {
			dateFormat = "January 2" // Stesso anno, non mostrare l'anno
		} else {
			dateFormat = "January 2, 2006" // Anno diverso, mostra l'anno
		}
	}
	
	dateStr := t.Format(dateFormat)
	
	day := t.Day()
	tomorrow := now.Add(time.Duration(24) * time.Hour).Day()
	yesterday := now.Add(time.Duration(-24) * time.Hour).Day()

	isYesterday := day == yesterday && t.Month() == now.Month() && t.Year() == now.Year()
	isTomorrow := day == tomorrow && t.Month() == now.Month() && t.Year() == now.Year()
	isToday := day == now.Day() && t.Month() == now.Month() && t.Year() == now.Year()

	isItWihinOneDayDif := isYesterday || isTomorrow || isToday

	if isItWihinOneDayDif {
		if isYesterday {
			if formatType == "date" {
				return "Yesterday"
			}
			return fmt.Sprintf("Yesterday @ %s", formatTime(t))
		} else if isToday {
			if formatType == "date" {
				return "Today"
			}
			return fmt.Sprintf("Today @ %s", formatTime(t))
		} else {
			if formatType == "date" {
				return "Tomorrow"
			}
			return fmt.Sprintf("Tomorrow @ %s", formatTime(t))
		}
	}
	
	var suffix string
	switch day {
	case 1, 21, 31:
		suffix = "st"
	case 2, 22:
		suffix = "nd"
	case 3, 23:
		suffix = "rd"
	default:
		suffix = "th"
	}
	
	dayStr := strconv.Itoa(day)
	return strings.Replace(dateStr, dayStr, dayStr+suffix, 1)
}

func formatTime(t time.Time) string {

	dateStr := t.Format("3:04 PM")
	
	return dateStr
}

