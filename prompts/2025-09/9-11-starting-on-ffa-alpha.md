Hi, I want to start implementing support for multiple players (free-for-all) for my game. Right now it's hard-coded to 2 players (1v1). We need make changes to the matchmaking process. And possibly some other places.

So far, for the alpha / play-testing phase, I'm thinking this:
* Free-for-all, w/ up to N players (let's use N=8 for now)
* A "start early" button that will trigger the game start w/ less than a full game (of N players). All waiting players have to press it.
* A function that determines the map settings (size, etc) depending on how many players. I've already created a version of this in the prev commit: `calcMapSizeForPlayers`, this might be good enough.

Code that we will definitely need to look at:
* Matchmaking code on frontend and backend (join-game-page.tsx and friends, matchmaking-service.ts, etc)
* code for player colors. I think there might be already be some issues w/ this, but need to make sure it works for up to 8 players

Other notes:
* the frontend stores are quite messy, we will be refactoring those at a later date. we should talk through any changes we make to frontend state or new stores that we add, to make sure we moving towards cleaner state mgmt in general
* There are a bunch of other rough spots in the code. DO NOT assume that existing code is "idiomatic" and that we should copy the style of it blindly.

---

Iniital Goal:
* Plan out / think through what the minimal version of supporting 4-8 players could look like, given our existing feature set. Work with me to refine the fucntionality we need to implement or change.
* Search the codebase to see if there is anything I missed that we need to consider for this.
* Once we have a good mutual understanding, we will write up a doc with our notes and plans.

In the next phase, we can work on implementation. For now, we are ONLY doing planning. NO code changes for now.

Please begin carefully exploring this. Once you have enough context, ask me 1-2 questions at a time to refine the plan. Then we can write the doc
