package validate

import "testing"

func TestPlayerName(t *testing.T) {
	valid := map[string]string{
		"Ab":                       "Ab",
		"  Zed  ":                  "Zed",
		"Player One":               "Player One",
		"ñandú_42":                 "ñandú_42",
		"123456789012345678901234": "123456789012345678901234", // 24 runes
	}
	for in, want := range valid {
		got, err := PlayerName(in)
		if err != nil {
			t.Errorf("PlayerName(%q) unexpected error: %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("PlayerName(%q) = %q, want %q", in, got, want)
		}
	}

	invalid := []string{
		"",                          // empty
		"a",                         // too short
		"   ",                       // only spaces
		"1234567890123456789012345", // 25 runes
		"bad\x00name",               // control char
		"tab\tname",                 // control char
	}
	for _, in := range invalid {
		if _, err := PlayerName(in); err == nil {
			t.Errorf("PlayerName(%q) expected error, got nil", in)
		}
	}
}

func TestColor(t *testing.T) {
	valid := map[string]string{
		"#FFAA00":  "#ffaa00",
		"#ffaa00":  "#ffaa00",
		" #123abc": "#123abc",
		"red":      "#e53935",
		"BLUE":     "#1e88e5",
		"white":    "#ffffff",
	}
	for in, want := range valid {
		got, err := Color(in)
		if err != nil {
			t.Errorf("Color(%q) unexpected error: %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("Color(%q) = %q, want %q", in, got, want)
		}
	}

	invalid := []string{"", "#fff", "ffaa00", "#ggaa00", "#ffaa000", "rgb(1,2,3)", "teal"}
	for _, in := range invalid {
		if _, err := Color(in); err == nil {
			t.Errorf("Color(%q) expected error, got nil", in)
		}
	}
}
