# Arena Duel

Arena duel is a 2D very addictive combat game on which you have to use your skills and reflex to beat your rivals.


## The Map

The map is a square with random obstacles on which you have to take advantage to beat your rival. Fog of war will not let you see your rival if they're hidden using the obstacles.


## Reaction

Your reaction time plays a big role along with using the right skill in the right moment.


## Skills

There are only a few skills, and they're very minimalist, but you have to use and combine in the right moment.

- Dash: Quick move. Use it to dodge your oponent's attacks or to take them in surprise.
- Slash: Melee attack using your sword. You blend your sword in a cone shape in front of you.
- Bash: Hit the enemy with your shield. Doing small damage and slowing them.
- Shot: Range attack using your gun. You shoot right in the direction of your mouse pointer.
- Shield: Protect yourself using your shield against slashes and shots.


## Skill Stats

Each skill has their own stats. There is one stat that every skill has, which is the cooldown, and the all the others are special for each of them.

#### Dash

- Cooldown: How much time the skill takes to refresh. *Levels [10, 9, 8, 7]*.
- Distance: Allows the player to dash from 100 to 125 units. *Levels [100, 108, 116, 125]*.
* Dash cannot cross obstacles.
* Dash speed is set to take 100ms, regardless of the distance stat.
* The hability is used with left shift key and the dash is done in the direction that the player is moving. If the player is not moving, the dash will be executed towards the last direction the player has move. If there is any obstacle or edge of the map in the way, the dash will move the player until they collide against the obstacle. Dash can go over other players, putting the player that did the dash after the enemy player if when calculated the dash the unit was greater than the distance between the two players, or in front of them otherwise. If there's any obstacle or map edge behind the enemy player when dashing through him, the player that dashes travels to the front of the player instead of going over them.

#### Slash

- Cooldown: How much time the skill takes to refresh. *Levels [4, 3.5, 3, 2.5]*.
- Range: It sets how long the player sword is and how big the impact range will be. It starts from 50 units and max is 75. *Levels* [50, 59, 68, 75].
- Area: It sets how big the cone area on which the player blends the sword will be and it's measured by degrees. This attribute sets where the hit starts and where it ends, while the cone is also affected by the *Range* attribute.(Think like "area is the width" and "range is the depth" of the hit, drawing a cone shape). *Levels [45, 60, 75, 90]*.
- Damage: It sets how much HP the enemy player loses when hit. *Levels [2, 3, 4]*.
* The speed of the sword swing is always set to last 100ms, regardless of the area of the swing.
* The animation of the swing is always set to take 75ms before attacking.
* The swing takes 50ms once the animation is finished.
* It goes from right to left (player facing pointer perspective) with primary click and left to right with secondary click.
* The sword does damage when it reaches the enemy player. (It has to "travel" during the swing).
* The sword width is fixed to be 0,1 of the player's width/area, while the length is set by the `range` stat.

#### Shot

- Cooldown: How much time the skill takes to refresh. *Levels [10, 9, 8, 7]*.
- Range: It sets how long the shot is. 
- Damage: It sets how much HP the enemy player loses when hit. *Levels [2, 3, 4]*.
* The speed of the bullet should be fixed and set to take 1 second to travel all the edge `y` vertically or `x` horizontally of the map. (Not calculated from diagonal travel).
* The animation of the shot is always set to take 50ms before shooting.
* The width/area of the bullet is set to be 0,5 of the players' width/area. The shape is round.
* The hability is used with alt/command key and the bullet is shot to the pointer direction.

#### Shield

- Cooldown: How much time the skill takes to refresh. *Levels [8, 7, 6, 5]*.
* The shield blocks 100% of the damage.
* It has no animation time.
* It blocks in a 90 degrees cone facing the player's mouse pointer.
* The hability is used with spacebar in the direction if the mouse pointer.

#### Bash

* Cooldown is always set to 5 seconds.
* Damage is always set to 1.
* Slow is always set to last 1 second.
* Slow is always set to reduce your enemy speed by 50%.
* Range/distance is always set to 63.
* Animation is always set to take 10ms.
* The width is always set to be a 35 degree cone.
* Contrary to the slash skill, it instantly hits the enemy if they're in the range and area once the animation is complete, meaning the hit doesn't have to "travel".

#### More about game mechanics.

* Any skill can be used during movement.
* Movement speed is set to 30 units per 100ms.
* Movement is 2d in any direction.
* Players' collision will be calculated as circles, even though we could end up working on sprites later, so it's fine if they start as colored circles. The circle of each player is set to 25 units radius.
* Players' health is set to 10. The health is always an integer, and any ability that does damage must always be set to an integer number so it does x/10 damage without resulting on a decimal number.
* The only way that players can heal is by time. Players heal by 1 per every 15 seconds.
* Players die when they health is 0 or less.
* Player that doesn't die is the winner.
* Game is played in best of three, five, seven, or ten rounds.
* Map is 2100 units width and height.
* Each player has 16 stats to spend (there are 26 possible stats to spend but player has 16 so they have to decide how they wanna configure their own gameplay style). Level 1 of any stat is blocked and it already counts as 1 stat spent, players cannot go lower than that. Hability stats that are fixed do not count as stats spent.
