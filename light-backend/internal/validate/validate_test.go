package validate

import "testing"

func TestEmail(t *testing.T) {
	valid := map[string]string{
		"user@example.com":       "user@example.com",
		"  User@Example.COM  ":   "user@example.com",
		"a.b+tag@sub.domain.org": "a.b+tag@sub.domain.org",
	}
	for in, want := range valid {
		got, err := Email(in)
		if err != nil {
			t.Errorf("Email(%q) unexpected error: %v", in, err)
			continue
		}
		if got != want {
			t.Errorf("Email(%q) = %q, want %q", in, got, want)
		}
	}

	invalid := []string{
		"", "notanemail", "no@domain", "@example.com", "user@", "Bob <b@x.com>", "a b@x.com",
	}
	for _, in := range invalid {
		if _, err := Email(in); err == nil {
			t.Errorf("Email(%q) expected error, got nil", in)
		}
	}
}

func TestPassword(t *testing.T) {
	valid := []string{"passw0rd", "aBcdefg1", "1234567a", "longpassword9"}
	for _, pw := range valid {
		if err := Password(pw); err != nil {
			t.Errorf("Password(%q) unexpected error: %v", pw, err)
		}
	}

	invalid := []string{
		"",         // empty
		"short1",   // too short
		"password", // no digit
		"12345678", // no letter
		"abcdefgh", // no digit
	}
	for _, pw := range invalid {
		if err := Password(pw); err == nil {
			t.Errorf("Password(%q) expected error, got nil", pw)
		}
	}
}
