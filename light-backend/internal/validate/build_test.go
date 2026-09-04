package validate

import (
	"strings"
	"testing"
)

// validBuild spends exactly BuildPoints: the 10-stat level-1 floor costs 10,
// and the 6 spare points go to stats with room above level 1.
func validBuild() map[string]int {
	return map[string]int{
		"dash.cooldownMs":   2,
		"dash.distance":     1,
		"slash.cooldownMs":  3,
		"slash.range":       1,
		"slash.areaDeg":     1,
		"slash.damage":      3,
		"shot.cooldownMs":   1,
		"shot.range":        1,
		"shot.damage":       2,
		"shield.cooldownMs": 1,
	}
}

func TestConfiguredStatsValid(t *testing.T) {
	if errs := ConfiguredStats(validBuild()); len(errs) != 0 {
		t.Fatalf("valid build rejected: %v", errs)
	}
}

func hasErrContaining(errs []string, want string) bool {
	for _, e := range errs {
		if strings.Contains(e, want) {
			return true
		}
	}
	return false
}

func TestConfiguredStatsBudget(t *testing.T) {
	over := validBuild()
	over["dash.distance"] = 2 // 17 points
	errs := ConfiguredStats(over)
	if !hasErrContaining(errs, "spends 17 of 16 points (over by 1)") {
		t.Errorf("over-spend not reported: %v", errs)
	}

	under := validBuild()
	under["slash.damage"] = 1 // 14 points
	errs = ConfiguredStats(under)
	if !hasErrContaining(errs, "spends 14 of 16 points (under by 2)") {
		t.Errorf("under-spend not reported: %v", errs)
	}
}

func TestConfiguredStatsUnknownStat(t *testing.T) {
	b := validBuild()
	b["bash.damage"] = 1 // Bash has no leveled stats
	errs := ConfiguredStats(b)
	if !hasErrContaining(errs, "bash.damage is not a leveled stat") {
		t.Errorf("unknown stat not named: %v", errs)
	}
}

func TestConfiguredStatsLevelBounds(t *testing.T) {
	high := validBuild()
	high["slash.damage"] = 4 // max is 3
	errs := ConfiguredStats(high)
	if !hasErrContaining(errs, "slash.damage level 4 exceeds its max level 3") {
		t.Errorf("over-max level not named: %v", errs)
	}

	low := validBuild()
	low["dash.cooldownMs"] = 0
	errs = ConfiguredStats(low)
	if !hasErrContaining(errs, "dash.cooldownMs level 0 is below the level-1 minimum") {
		t.Errorf("below-minimum level not named: %v", errs)
	}
}

func TestConfiguredStatsMissingStat(t *testing.T) {
	b := validBuild()
	delete(b, "shield.cooldownMs")
	errs := ConfiguredStats(b)
	if !hasErrContaining(errs, "shield.cooldownMs is missing (level 1 is the minimum)") {
		t.Errorf("missing stat not named: %v", errs)
	}
}

// An invalid build reports every violation, not just the first (the v2
// builder UI shows them all), and an empty build names each missing stat plus
// the budget rule.
func TestConfiguredStatsReportsAllViolations(t *testing.T) {
	b := validBuild()
	b["slash.damage"] = 5 // exceeds max AND breaks the budget
	b["made.up"] = 1      // unknown
	errs := ConfiguredStats(b)
	for _, want := range []string{"slash.damage level 5", "made.up is not a leveled stat", "of 16 points"} {
		if !hasErrContaining(errs, want) {
			t.Errorf("missing violation %q in %v", want, errs)
		}
	}

	if errs := ConfiguredStats(map[string]int{}); len(errs) != len(statMaxLevels)+1 {
		t.Errorf("empty build: want %d violations (10 missing + budget), got %v", len(statMaxLevels)+1, errs)
	}
}
