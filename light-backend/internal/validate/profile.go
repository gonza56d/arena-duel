package validate

import (
	"errors"
	"regexp"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	minPlayerNameLen = 2
	maxPlayerNameLen = 24
)

// DefaultColor is assigned at signup so every profile is renderable before the
// player picks a color.
const DefaultColor = "#ffffff"

// ErrInvalidPlayerName is returned when a player name fails validation.
var ErrInvalidPlayerName = errors.New("player name must be 2–24 printable characters")

// ErrInvalidColor is returned when a color is neither a preset nor #RRGGBB.
var ErrInvalidColor = errors.New("color must be #RRGGBB or one of: " + strings.Join(presetNames(), ", "))

// presetColors maps the accepted preset names to their canonical hex value.
// The stored value is always the hex so the client can paint with it directly.
var presetColors = map[string]string{
	"red":    "#e53935",
	"blue":   "#1e88e5",
	"green":  "#43a047",
	"yellow": "#fdd835",
	"orange": "#fb8c00",
	"purple": "#8e24aa",
	"cyan":   "#00acc1",
	"pink":   "#ec407a",
	"white":  "#ffffff",
	"black":  "#000000",
}

var hexColorRe = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func presetNames() []string {
	names := make([]string, 0, len(presetColors))
	for n := range presetColors {
		names = append(names, n)
	}
	sort.Strings(names) // stable order for the error message
	return names
}

// PlayerName trims the input and enforces 2–24 runes of printable, non-control
// characters. Names are not unique in v1. The trimmed name is returned.
func PlayerName(raw string) (string, error) {
	name := strings.TrimSpace(raw)
	n := utf8.RuneCountInString(name)
	if n < minPlayerNameLen || n > maxPlayerNameLen {
		return "", ErrInvalidPlayerName
	}
	for _, r := range name {
		if !unicode.IsPrint(r) || unicode.IsControl(r) {
			return "", ErrInvalidPlayerName
		}
	}
	return name, nil
}

// Color accepts either a preset name (case-insensitive) or a #RRGGBB hex value
// and returns the normalized lowercase "#rrggbb" form for storage.
func Color(raw string) (string, error) {
	c := strings.ToLower(strings.TrimSpace(raw))
	if hex, ok := presetColors[c]; ok {
		return hex, nil
	}
	if hexColorRe.MatchString(c) {
		return c, nil
	}
	return "", ErrInvalidColor
}
