package validate

import (
	"fmt"
	"sort"
)

// BuildPoints is the stat-point budget every build must spend exactly. It
// mirrors `build.points` in src/config.ts (the game's single tuning source);
// the two must be changed together.
const BuildPoints = 16

// statMaxLevels is the catalog of leveled skill stats and each one's highest
// level (= its level-table length). It mirrors the `Levels` tables in
// src/config.ts: a skill field is a spendable stat exactly when it is a table
// there, so Bash (all fixed values) contributes nothing. Any table change in
// src/config.ts must be reflected here.
var statMaxLevels = map[string]int{
	"dash.cooldownMs":   4,
	"dash.distance":     4,
	"slash.cooldownMs":  4,
	"slash.range":       4,
	"slash.areaDeg":     4,
	"slash.damage":      3,
	"shot.cooldownMs":   4,
	"shot.range":        4,
	"shot.damage":       3,
	"shield.cooldownMs": 4,
}

// statIDs returns every known stat id in sorted order so validation messages
// come out deterministically.
func statIDs() []string {
	ids := make([]string, 0, len(statMaxLevels))
	for id := range statMaxLevels {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

// ConfiguredStats checks a player's build — the Go mirror of validateLoadout
// in src/sim/loadout.ts: every leveled stat present with a 1-based level in
// [1, its max], no unknown stats, and exactly BuildPoints spent, where spend
// is the sum of all levels (level 1 of each stat is mandatory and counts as
// 1). It reports every violation, not just the first, so the client can show
// them all; an empty result means the build is valid.
func ConfiguredStats(stats map[string]int) []string {
	var errs []string

	var unknown []string
	for key := range stats {
		if _, ok := statMaxLevels[key]; !ok {
			unknown = append(unknown, key)
		}
	}
	sort.Strings(unknown)
	for _, key := range unknown {
		errs = append(errs, fmt.Sprintf("%s is not a leveled stat", key))
	}

	spend := 0
	for _, id := range statIDs() {
		level, ok := stats[id]
		if !ok {
			errs = append(errs, fmt.Sprintf("%s is missing (level 1 is the minimum)", id))
			continue
		}
		spend += level
		if level < 1 {
			errs = append(errs, fmt.Sprintf("%s level %d is below the level-1 minimum", id, level))
		} else if max := statMaxLevels[id]; level > max {
			errs = append(errs, fmt.Sprintf("%s level %d exceeds its max level %d", id, level, max))
		}
	}

	if spend != BuildPoints {
		over := "under"
		diff := BuildPoints - spend
		if spend > BuildPoints {
			over = "over"
			diff = spend - BuildPoints
		}
		errs = append(errs, fmt.Sprintf("spends %d of %d points (%s by %d)", spend, BuildPoints, over, diff))
	}

	return errs
}
