const { createClient } = require('redis')
const { createAdapter } = require('@socket.io/redis-adapter');
const { getUnpackedSettings } = require('http2');
const HotStorageClient = require('./redisClient').HotStorageClient;

const gameStoreClient = new HotStorageClient()
const server = require('http').Server();
const io = require('socket.io')({
    cors: {
        "Access-Control-Allow-Origin": "*",
        methods: ["GET", "POST"]
    }
});

const redisHost = process.env.REDIS_HOST || 'localhost'
const redisPort = process.env.REDIS_PORT || '6379'
const pubClient = createClient({ url: `redis://${redisHost}:${redisPort}` })
const subClient = pubClient.duplicate()

const PORT = process.env.PORT || 9000;
io.attach(server);

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
});

// Schema in lobbySchema.json

async function generateLobbyCode() {
    let codeLength = 5
    let lobbyCode = generateRandomString(codeLength)
    let retryCount = 0
    while (await gameStoreClient.doesLobbyExist(lobbyCode)) {
        if (retryCount == 5) {
            codeLength++
            retryCount = 0
        }
        lobbyCode = await generateLobbyCode(codeLength)
    }

    return lobbyCode
}

function generateRandomString(length) {
    const validCharacters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    let output = '';
    for (let i = 0; i < length; i++) {
        output += validCharacters.charAt(Math.floor(Math.random() * validCharacters.length));
    }
    return output;
}

async function createLobby(lobbyCode, hostDetails) {
    const createResult = await gameStoreClient.createLobby(lobbyCode)
    return await gameStoreClient.joinLobby(lobbyCode, hostDetails)
}

async function joinLobby(lobbyCode, playerDetails) {
    return await gameStoreClient.joinLobby(lobbyCode, playerDetails)
}

async function readyUp(lobbyCode, socket) {
    // console.log('Debug: Socket', socket.id)
    const result = await gameStoreClient.toggleReady(lobbyCode, socket.id)
    return result
}

async function addVote(lobbyCode, target) {
    await gameStoreClient.addVote(lobbyCode, target)
}

async function emitGameState(lobbyCode, socket) {
    io.to(socket).emit('state', await gameStoreClient.getUserState(lobbyCode, socket.id))
}


async function emitUserState(lobbyCode, socket) {
    console.log('Sending Socket', socket)
    const userState = await gameStoreClient.getPlayer(lobbyCode, socket)
    if (userState.ok) io.to(socket).emit('userState', userState.player)
}

async function updateAll(lobbyCode) {
    const sockets = await gameStoreClient.getSockets(lobbyCode)
    console.log('Sockets', sockets)
    for (let i = 0; i < sockets.length; i++) {
        await emitGameState(lobbyCode, sockets[i])
    }
    for (let i = 0; i < sockets.length; i++) {

        await emitUserState(lobbyCode, sockets[i])
    }

}

async function updatePlayerGoal(lobbyCode, playerDetails) {
    console.log('UpdatePlayerGoal',playerDetails)
    const result = await gameStoreClient.updatePlayer(lobbyCode, playerDetails)
}

async function getPlayer(lobbyCode, socket) {
    io.to(socket).emit('player', await gameStoreClient.getPlayer(lobbyCode, socket))
    return result
}

io.on('connection', async (socket) => {

    console.log(`Socket ${socket.id} connected.`)

    socket.on('createLobby', async (hostDetails, acknowledgement) => {
        const lobbyCode = await generateLobbyCode()
        hostDetails.socketID = socket.id
        const result = await createLobby(lobbyCode, hostDetails)
        socket.join(lobbyCode)
        const callbackObj = result.ok ? { ...result, lobbyCode } : { ...result }
        updateAll(lobbyCode)
        acknowledgement(callbackObj)
    })

    socket.on('joinLobby', async (lobbyCode, playerDetails, acknowledgement) => {
        playerDetails.socketID = socket.id
        const result = await joinLobby(lobbyCode, playerDetails)
        socket.join(lobbyCode)
        updateAll(lobbyCode)
        const callbackObj = result.ok ? { ...result, lobbyCode } : { ...result }
        acknowledgement(callbackObj)
    })

    socket.on('readyUp', async (lobbyCode, acknowledgement) => {
        const isReady = await readyUp(lobbyCode, socket)
        if (isReady.progressState) {
            updateAll(lobbyCode)
            acknowledgement(isReady)
        }
        else {
            acknowledgement(isReady)
        }
    })

    socket.on('action', async (lobbyCode, type, actionDetails, acknowledgement) => {
        let result;
        console.log('Action',lobbyCode)
        switch (type) {
            case 'vote':
                result = await addVote(lobbyCode, actionDetails)
                break;
            case 'update':
                /*
                actionDetails: {
                    "socketID": "",
                    "role": "",
                    "target": "",
                    "nickname": "",
                    "allegiance": "",
                    "ready": ,
                }
                */
                console.log('UpdateDetails',actionDetails)
                result = await updatePlayerGoal(lobbyCode, actionDetails)
                break;
            case 'progress':
                result = await gameStoreClient.progressGameState(lobbyCode)
            default:
                break;
        }
        acknowledgement(result)
        await updateAll(lobbyCode)
    })

    socket.on('vote', async (lobbyCode, target, acknowledgement) => {
        acknowledgement(await addVote(lobbyCode, target))
    })

    socket.on('chat', async message => {
        console.log('Chat event')
        const lobbyCode = Array.from(socket.rooms.keys())[1]
        const player = (await gameStoreClient.getNickname(lobbyCode, socket.id)).nickname
        socket.to(lobbyCode).emit('chat', { player, message });
    })

    socket.on('disconnect', () => {
        console.log(`Socket ${socket.id} disconnected.`);
        //TODO
    });
});


// TODO Function
async function verifyUniqueConn(socket) {
    // Acquire redis lock to make sure multiple connections from same user
}

async function startServer() {
    await gameStoreClient.connect()
    console.log('Redis connect')
    server.listen(PORT, () => {
        console.log(`Server listening on port ${PORT}`)
    });
}

if (module === require.main) {
    startServer();
}

module.exports = server;