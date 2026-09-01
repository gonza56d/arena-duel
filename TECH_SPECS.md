# Tech requirements

## Frontend

Game client must run in the browser. All the code must be done in TypeScript.

Using canvas is suggested but the agent is free to suggest other tech specs here. Game UI can be basic HTML around the game's canvas.

Game's canvas is fixed to the game's map size. The UI must not cover any part of the canvas, it has to be around it instead.

Use a screen size that addapts to player's browser screen size. Block the frontend client if the size is less than anything that makes sense or if the player is using a phone. Only desktop is allowed for now.


## Backend

Backend is suggested to be in Go, so that the multiplayer flows consistently. You can use Gin framework.

The database can be a small MongoDB. No big relationships are needed so NoSQL is fine. We want to store player's name, victories, games played, and their configured stats. Also the preferred color is configurable.

#### Architecture

There has to be one backend for the game client (the backend that is running the game) and another backend dedicated to less demanding requests like logins, signups, player configuration, setting names, setting player color, etc.

We have to priorize the smooth running of the backend so it can quickly calculate everything in the game while the fight happens.

The backend is also responsible of validating frontend actions. If we detect that a player has teleported someway, or moved faster than the gamerules, the backend should respond with the actual real numbers under the rules, and the client must follow it. If the client is corrupted, rules in the backend must prevail (E.G: if I change the localscript so that my player has 10000 HP instead of 10, for the backend it is 10 and I will still lose if it reaches 0).
