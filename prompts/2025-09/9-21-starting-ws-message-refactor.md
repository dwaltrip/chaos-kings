
# Cleaning up Websocket message types and architecture

### Basic info

We are starting to fix a big issue with the typing / structure of how websocket messages are defined and used in our app (both backend and frontend).

The core thing is properly distinguishing between messages from the client and messages from the server.

The type `WsMessage` needs to be split into `WsClientMessage` and `WsServerMessage`.
In our definitions of the message types and payloads for each "domain" (e.g. `game-chat`, `gameplay`, `game-matchmaking`, and so on), we need to split out each message type into either a client or server list.

### Example

Let's look at the websocket messages for matchmaking.

* Key files:
    - common/types/game-matchmaking.ts
    - backend/src/game-matchmaking/game-matchmaking-ws-api.ts
    - frontend/src/pages/join-game/game-matchmaking-ws-handler.ts
* The type `GameMatchmakingMessageType` should be split into 2 different types, one for client-to-server, and one for server-to-client.
* All of the interfaces created in common/types/game-matchmaking.ts that extend from `WsMessage` should extend from either `WsServerMessage` or `WsClientMessage`.
* I'm thinking the backend "ws-api" should only specifcy handlers for the "client-to-server" message types.
* Likewise, I'm thinking the frontend "ws-handler" should only specify handlers for "server-to-client" message types.
* I also think the actions / handler methods themselves on the BE and FE wil have

### Additional Notes

#### De-couple app logic from websocket plumbing

Long term, I'd like all "application logic" to be moved out of handlers and into dedicated action files (1 action per file), and have a clean de-coupling, where actions are mostly unaware of the websocket handler context they are being called from. They should receive the needed args in a plain fashion, and NOT have to deal with raw `WsMessage` types... 

* Message handlers will be very thin, taking care of just the plumbing.
* Handlers (both BE and FE) will extract what's needed from the incoming data, and then calling the appropriate action method
* I've started going this direction with some of the `DomainAPI` instances in the backend, for example. But we do NOT have the desired "thin handler" methods with clean de-coupling. The action methods get called directly, and have to deal with the "raw" `WsMessage`. Need to fix this.
* There is one example on the frontend where I think I've decently implemented the pattern I want. In frontend/src/game-ui/store/gameplay-ws-handler.ts, we have thin handlers that extra the data from the payload, and then delegate to action methods that are fairly angostic about the calling context.

#### Helpful tips

* You can run the builds with `bash tools/build-all.sh` to see some of the current Type errors from my changes so far (in the first commit on this branch)

### Next Steps

I have a new branch for this work, ws-message-refactor. There's 1 small commmit so far, just getting started.

My current thought is to start w/ one domain and get that fully refactored and working, and then we take what was learned and apply that to the remaining domains.

The above is a rough sketch of what I have in mind, but there is very likely aspects of it that are incorrect / poorly thought out / not ideal.

Can you help me:
* Carefully analyze the codebase to determine what's missing, incorrect, or could be improved in my above description. There are almost certainly additional changes that we want to make at the same time as the above stuff that I haven't thought of.
* Create a more comprehensive, accurate picture of the situation and several (at least 3) high-level sketches of the most sensible paths forward we could take to improve things?
* Identify any critical assumptions / ambiguities / decisions / questions that need to be resolved before we can decide exactly how we want to proceed?

After you finish your analysis, please carefully compose everything into a Markdown doc located at `dev-notes/2025-09/9-21-ws-message-refactor-initial-analysis.md`.

DO NOT make any code changes at this stage.

Ultrathink :)
