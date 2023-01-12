const bluebird = require('bluebird');
const redis = require('redis');
const schema = require('./schema.json')

bluebird.promisifyAll(redis);

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = process.env.REDIS_PORT || '6379'
DEFAULT_EXPIRATIION = 3600

class HotStorageClient {
    constructor() {
        this.client = redis.createClient({ url: `redis://${redisHost}:${redisPort}` })
    }

    async connect() {
        await this.client.connect()
        await this.client.set("players", "{}")
    }

    async createLobby(lobbyCode) {
        const lobbyDoc = schema.lobby
        lobbyDoc.state = 1
        const lobbyExists = await this.getLobby(lobbyCode)
        if (lobbyExists == null) {
            this.client.SETEX(lobbyCode, DEFAULT_EXPIRATIION, JSON.stringify(lobbyDoc))
            return {
                ok: true,
                msg: "Lobby created: " + lobbyCode
            }
        }
        return {
            ok: false,
            msg: "Lobby with code already exists"
        };
    }

    //Attempts to add player to lobby
    async joinLobby(lobbyCode, hostDetails) {
        const lobbyDoc = await this.getLobby(lobbyCode)
        if (lobbyDoc == null) {
            return {
                ok: false,
                msg: "Lobby does not exist"
            }
        }
        await this.setActivePlayer(hostDetails.playerID, hostDetails.socketID, lobbyCode)
        if (!lobbyDoc.players[hostDetails.playerID]) { //if player is not in the game already
            lobbyDoc.players[hostDetails.playerID] = schema.player
            lobbyDoc.players[hostDetails.playerID].nickname = hostDetails.nickname
            lobbyDoc.voteLimit++;
        }

        lobbyDoc.players[hostDetails.playerID].socketID = hostDetails.socketID
        lobbyDoc.socketToPlayers[hostDetails.socketID] = hostDetails.playerID
        lobbyDoc.playerToSockets[hostDetails.playerID] = hostDetails.socketID
        console.log("Lobby " + lobbyCode + ": adding " + hostDetails.playerID + " with " + hostDetails.socketID)
        return this.updateLobby(lobbyCode, lobbyDoc)
    }

    //Check that the lobby exists 
    async doesLobbyExist(lobbyCode) {
        var lobbyDoc = await this.getLobby(lobbyCode)
        return (lobbyDoc != null)
    }

    async toggleReady(lobbyCode, socket) {
        var lobbyDoc = await this.getLobby(lobbyCode)
        const playerID = lobbyDoc.socketToPlayers[socket]
        if (lobbyDoc.players[playerID].ready) {
            lobbyDoc.readyUp--
        }
        else {
            lobbyDoc.readyUp++
        }
        lobbyDoc.players[playerID].ready = !lobbyDoc.players[playerID].ready
        const readyResult = await this.updateLobby(lobbyCode, lobbyDoc)
        const progressResult = await this.progressGameState(lobbyCode)
        if (progressResult?.ok)
            return {
                progressState: true
            }
        if (readyResult.ok)
            return {
                isReady: lobbyDoc.players[playerID].ready
            }
    }

    async getReadyCounter(lobbyCode) {
        const lobby = await this.getLobby(lobbyCode)
        if (lobby == null) return {
            ok: false,
            msg: "Lobby does not exist"
        };
        return {
            ok: true,
            ready: lobbyDoc.readyUp
        }
    }

    async getActivePlayerNumber(lobbyCode) {
        const lobby = await this.getLobby(lobbyCode)
        if (lobby == null) return {
            ok: false,
            msg: "Lobby does not exist"
        };
        const activePlayers = lobbyDoc.currentEvent.extra_players.length + 1
        return {
            ok: true,
            players: activePlayers
        }
    }

    // TODO Remove inbetweeen state -> add seamless event to event progression
    async progressGameState(lobbyCode) {
        const lobby = await this.getLobby(lobbyCode)
        if (lobby == null) return {
            ok: false,
            msg: "Lobby does not exist"
        };
        switch (lobby.state) {
            case 1: // Joining to Starting
                // check that number of 'readys' is equal to number of 
                if (lobby.readyUp != Object.keys(lobby.players).length) {
                    return {
                        ok: false,
                        msg: "Not enough players ready"
                    }
                }
                console.log("Lobby " + lobbyCode + ": progressing to start game phase")
                lobby.state = 2
                await this.updateLobby(lobbyCode, lobby)
                return { ok: true, msg: "Progressed to starting game" }
            case 2: // Starting to between events
                lobby.events = this.GenerateEvents(lobby)
                if (lobby.events.length != Object.keys(lobby.players).length) {
                    // the wrong number of events has been generated
                    return {
                        ok: false,
                        msg: "Incorrect number of events to progress: " + lobby.events.length
                    }
                }
                for (const [player, data] in lobby.players) {
                    console.log(player + ": " + data.allegiance)
                    if (data.allegiance == "") {
                        //Player has not been allocated a team
                        return {
                            ok: false,
                            msg: "Player: " + player + " has not been allocated a team"
                        }
                    }
                }
                console.log("Lobby " + lobbyCode + ": progressing to in between events")
                lobby.state = 3
                await this.updateLobby(lobbyCode, lobby)
                return {
                    ok: true,
                    msg: "Lobby events and players initialised, progressing to between events"
                }
            case 3: // Between events
                if (lobby.events.length == 0) { // no more events, progress to discussion
                    console.log("Lobby " + lobbyCode + ": progressing to discussion phase")
                    lobby.state = 5
                    await this.updateLobby(lobbyCode, lobby)
                    return {
                        ok: true,
                        msg: "Progressed to discussion"
                    }
                } else { // moving to next event
                    console.log("Lobby " + lobbyCode + ": progressing to next event")
                    if (lobby.currentEvent != null) lobby.eventHistory.add(lobby.currentEvent);
                    lobby.currentEvent = lobby.events.shift()
                    lobby.state = 4
                    await this.updateLobby(lobbyCode, lobby)
                    return {
                        ok: true,
                        msg: "Progressed to next event"
                    }
                }
            case 4: // In event to inbetween
                //conditions needed
                console.log("Lobby " + lobbyCode + ": progressing to in between events")
                lobby.state = 3
                this.updateLobby(lobbyCode, lobby)
                return {
                    ok: true,
                    msg: "Current event completed, progressing to between events"
                }
            case 5: // Discussion to voting
                console.log("Lobby " + lobbyCode + ": progressing to voting phase")
                lobby.state = 6
                this.updateLobby(lobbyCode, lobby)
                return {
                    ok: true,
                    msg: "Discussion phase complete, progressing to voting phase"
                }
            case 6: // Voting to results
                if (lobby.voteLimit != Object.keys(lobby.votes).length) {
                    return {
                        ok: false,
                        msg: "Not enough players voted"
                    }
                }
                console.log("Lobby " + lobbyCode + ": progressing to results phase")
                lobby.state = 7
                this.updateLobby(lobbyCode, lobby)
                return {
                    ok: true,
                    msg: "Voting phase complete, progressing to results phase"
                }
            case 7: // Results to Ending Game
                console.log("Lobby " + lobbyCode + ": progressing to end phase")
                lobby.state = 8
                this.updateLobby(lobbyCode, lobby)
                return {
                    ok: true,
                    msg: "Results phase complete, progressing to end phase"
                }
            case 8: // Starting to Starting
                break;
        }
    }

    async getUserState(lobbyCode, socket) {
        const lobby = await this.getLobby(lobbyCode)
        const playerID = lobby.socketToPlayers[socket]
        delete lobby.events
        delete lobby.votes
        delete lobby.voteLimit
        if (lobby.currentEvent.player == playerID) {
            return lobby
        } else {
            delete lobby.currentEvent.details
            delete lobby.currentEvent.extra_players
            delete lobby.currentEvent.event_function
            delete lobby.currentEvent.event_name

            Object.keys(lobby.players).foreach(player => { //Players should not know the details more than what is needed outside the event
                delete lobby.players[player].socketID
                delete lobby.players[player].allegiance
                delete lobby.players[player].role
                delete lobby.players[player].target
                delete lobby.players[player].ready
            })
            return lobby
        }
    }

    async getSockets(lobbyCode) {
        const lobby = await this.getLobby(lobbyCode)
        return Object.keys(lobby.socketToPlayers);
    }

    async getPlayer(lobbyCode, socket) {
        const lobbyDoc = await this.getLobby(lobbyCode)
        const playerID = lobbyDoc.socketToPlayers[socket]
        return {
            ok: true,
            player: lobbyDoc.players[playerID]
        }
    }

    async updatePlayer(lobbyCode, playerDetails) {
        const lobby = this.getLobby(lobbyCode)
        const playerID = lobby.socketToPlayers[playerDetails.socketID]
        lobby.players[playerID] = playerDetails
        this.updateLobby(lobbyCode, lobby)
    }

    async getUsername(lobbyCode, socket) {
        var lobbyDoc = await this.getLobby(lobbyCode)
        var playerID = lobbyDoc.socketToPlayers[socket]
        return {
            ok: true,
            username: playerID
        }
    }

    async getNickname(lobbyCode, socket) {
        var lobbyDoc = await this.getLobby(lobbyCode)
        var playerID = lobbyDoc.socketToPlayers[socket]
        const nickname = lobbyDoc.players[playerID]
        return {
            ok: true,
            nickname: nickname
        }
    }

    //fetch individual lobby json
    async getLobby(lobbyCode) {
        const lobby = await this.client.get(lobbyCode)
        return JSON.parse(lobby)
    }

    async setLobbyEvents(lobbyCode, eventArray) {
        const lobby = await this.client.get(lobbyCode)
        if (lobby.state != 2) {
            return {
                ok: false,
                msg: "Game State is incorrect for storing events"
            }
        }
        lobby.events = eventArray
        const updateResult = await this.updateLobby(lobbyCode, lobby)
        if (updateResult.ok) {
            return {
                ok: true,
                msg: "Events stored successfully"
            }
        }
    }

    async getActivePlayers() {
        const active = await this.client.get("players")
        return JSON.parse(active)
    }

    async setActivePlayer(playerID, socket, lobbyCode) {
        const players = await this.getActivePlayers()
        players[playerID] = {
            lobbyCode: lobbyCode,
            socket: socket
        }
        await this.client.set("players", JSON.stringify(players))
    }

    async getActivePlayer(playerID) {
        const players = await this.getActivePlayers()
        const player = players[playerID]
        return player
    }

    async removeActivePlayer(playerID) {
        const players = this.getActivePlayers()
        delete players[playerID]
        await this.client.set("players", JSON.stringify(players))
    }

    async addVote(lobbyCode, target) {
        const lobby = await this.client.get(lobbyCode)
        if (!lobby.players[target]) {
            return {
                ok: false,
                msg: "Player does not exist"
            }
        }
        if (lobby.votes[target]) {
            lobby.votes[target]++
        } else {
            lobby.votes[target] = 1
        }
        await this.updateLobby(lobbyCode, lobby)
        return {
            ok: true,
            msg: "Vote added"
        }

    }

    //fetch lobbies redis object UNUSED
    // async getLobbies() {
    //     const lobbies = await this.client.get('lobbies')
    //     if (lobbies !== null) {
    //         return JSON.parse(lobbies)
    //     }
    //     else return null;
    // }

    // update the entry for lobby code
    // if lobby does not exist, do nothing and return false
    // if lobby exists, update and return true
    async updateLobby(lobbyCode, lobbyDoc) {
        const lobby = await this.getLobby(lobbyCode)
        if (lobby == null) return { ok: false, msg: "Lobby does not exist" };
        this.client.SETEX(lobbyCode, DEFAULT_EXPIRATIION, JSON.stringify(lobbyDoc))
        return {
            ok: true,
            msg: "Lobby updated"
        };
    }

    PrivateCall = ["There is a private phone call for this player.", <br />, "They will be with back shortly."];

    Events = {
        OldAllies: {
            BlindName: "Old Allies",
            EventTitle: "Old Allies",
            BlindInfo: "Two players are revelead to have appeared as the same team at the start",
            Details: "Two players are revelead to have appeared as the same team at the start"
        },
        OldEnemies: {
            BlindName: "Old Enemies",
            EventTitle: "Old Enemies",
            BlindInfo: "Two players are revelead to have appeared on opposite teams at the start",
            Details: "Two players are revelead to have appeared on opposite teams at the start",
        },
        DeepState: {
            BlindName: "Private Call",
            EventTitle: "Deep State",
            BlindInfo: PrivateCall,
            Details: "Deep State",
        },
        SplinterCell: {
            BlindName: "Private Call",
            EventTitle: "Splinter Cell",
            BlindInfo: PrivateCall,
            Details: "Splinter Cell"
        },
        BackroomDeal: {
            BlindName: "Backroom Deal",
            EventTitle: "Backroom Deal",
            BlindInfo: ["Their loyalty is being put to the test.", <br />, "Is it strong enough?"],
            Details: ["You have the option to switch teams, but if you do so you cannot vote.", <br />, "Do you accept?"]
        },
        Martyr: {
            BlindName: "Private Call",
            EventTitle: "Martyr",
            BlindInfo: PrivateCall,
            Details: "You have been chosen as a Martyr, get yourself voted and you will be rewarded."
        },
        BackgroundCheck: {
            BlindName: "Background Check",
            EventTitle: "Background Check",
            BlindInfo: "We have done a little digging. Here is what we know..."
        },
        PickPocket: {
            BlindName: "Pick Pocket",
            EventTitle: "Pick Pocket",
            BlindInfo: "Select a player to swap roles with",
            Details: "Select a player to swap roles with"
        },
        GagOrder: {
            BlindName: "Gag Order",
            EventTitle: "Gag Order",
            BlindInfo: "Someone is being a little too loud. Use this opportunity to prevent them from voting.",
            Details: "Someone is being a little too loud. Use this opportunity to prevent them from voting."
        },
        BlackMark: {
            BlindName: "Black Mark",
            EventTitle: "Black Mark",
            BlindInfo: "Choose a player to add an extra vote against",
            Details: "Choose a player to add an extra vote against"
        },
        Coup: {
            BlindName: "Private Call",
            BlindInfo: PrivateCall,
            EventTitle: "Coup d'etat",
            Details: "Coup d'etat"

        },
        Blackmailed: {
            BlindName: "Blackmailed",
            EventTitle: "Blackmailed",
            BlindInfo: ["Another player has some dirt on you that cannot come to light.", <br />, "You will only win if they do."],
            Details: ["Another player has some dirt on you that cannot come to light.", <br />, "You will only win if they do."],
        },
        BodyGuard: {
            BlindName: "Bodyguard",
            EventTitle: "Bodyguard",
            BlindInfo: ["You have been employed to protect another.", <br />, "They cannot be voted out."]
        }
    };

    GenerateEvents({ lobby_state }) {
        let events = [];
        lobby_state.players.forEach(player => {
            const eventName = RandomUniqueEvent(events);
            const event = EventGenMap(eventName, player, lobby_state.players);
            events.push(event);
        });
        return events
    }

    EventGenMap(eventName, player, players) {
        const event = Events[eventName];//fetch event strings
        const valid = players.filter(excludePlayer(player));
        let extra_players;
        switch (eventName) {
            case "OldAllies": //Started game on the same team
                extra_players = getSameStartTeam(valid);
                break;
            case "OldEnemies": //Started the game as enemies
                extra_players = getOppStartTeams(valid);
                break;
            case "DeepState": // Swap team- Hidden event
                break;
            case "SplinterCell": // Turns player to standalone - Hidden event
                break;
            case "BackroomDeal": // Can choose to betray team, cannot vote if so
                break;
            case "Martyr": //Will die for the cause - Hidden event
                break;
            case "BackgroundCheck": // Current appeared allegience
                extra_players = SinglePlayer(valid);
                break;
            case "PickPocket": // Swap allegiences with player of choice, if possible
                extra_players = valid;
                break;
            case "GagOrder": //Prevent a player of choice from voting
                extra_players = valid;
                break;
            case "BlackMark": //Give an extra vote to player of choice
                extra_players = valid;
                break;
            case "Coup": //Given player must be elminated to win - Hidden event
                extra_players = SinglePlayer(valid);
                break;
            case "Blackmailed": //Given player must win in order to win
                extra_players = SinglePlayer(valid);
                break;
            case "BodyGuard": //Given player cannot be voted out in order to win
                extra_players = SinglePlayer(valid);
                break;
        }
        let eventObject = { //arrange data into expected format for events
            player: player,
            extra_players: extra_players,
            blind_name: event.BlindName,
            event_name: event.EventTitle,
            blind_info: event.BlindInfo,
            details: event.Details,
            event_function: eventName
        };
        return eventObject;
    }
    getSameStartTeam(players) {
        console.log(players);
        const p1 = players[Math.floor((Math.random() * players.length))]; //select valid players
        console.log(p1);
        const valid = players.filter(excludePlayer(p1));
        console.log(valid);
        const validSecond = valid.filter(OriginalAllies(p1));
        console.log(validSecond);
        const p2 = validSecond[Math.floor((Math.random() * validSecond.length))];
        return [p1, p2];
    }

    getOppStartTeams(players) {
        const p1 = players[Math.floor((Math.random() * players.length))]; //select valid players
        const validSecond = players.filter(p => {
            return p.original != p1.original;
        });
        const p2 = validSecond[Math.floor((Math.random() * validSecond.length))];
        return [p1, p2];
    }

    SinglePlayer(players) {
        return [players[Math.floor((Math.random() * players.length))]]; //select valid players
    }
    
    RandomUniqueEvent(events) {
        let keys = Object.keys(Events);
        let event = Events[keys[Math.floor((Math.random() * keys.length))]];
        while (events.includes(event)) {
            event = Events[keys[Math.floor((Math.random() * keys.length))]];
        }
        return event;
    }
}

module.exports.HotStorageClient = HotStorageClient;
