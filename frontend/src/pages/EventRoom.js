import { EventGenMap } from "../components/eventMap";
import { CurrentEvent, EventWaiting } from "../components/CurrentEvent";

export default function EventRoom({ lobby_state }) {


    var used_state = lobby_state
    if (used_state == null) used_state = dummylobbyState
    dummylobbyState.current_event = EventGenMap("GagOrder", {
        nickname: "LoremIpsum",
        icon: "Figure this out",
        original: "Enemy",
        allegiance: "Enemy"
    }, getPlayerArray())

    if (used_state.state == 4) {
        if (used_state.inEvent) {
            return (
                <div className="bg-event_room h-screen bg-cover bg-bottom">
                    <CurrentEvent current_event={used_state.current_event} />
                </div>
            )
        } else {
            return (
                <EventWaiting current_event={used_state.current_event} />
            )
        }
    }
}
const dummylobbyState = {
    "id": "",
    "players": {
        "DummyID": {
            nickname: "LoremIpsum",
            icon: "Figure this out",
            original: "Enemy",
            allegiance: "Enemy"
        },
        "Lorem": {
            nickname: "Sean Connery",
            icon: "Figure this out",
            original: "Enemy",
            allegiance: "Ally"
        },
        "Ipsum": {
            "nickname": "Travolta",
            "icon": "Figure this out",
            original: "Ally",
            allegiance: "Enemy",
            "target": "",
        },
        "Delta": {
            nickname: "Geronimo",
            original: "Ally",
            allegiance: "Ally"
        },
        "Beta": {
            nickname: "Jester",
            original: "Enemy",
            allegiance: "Enemy"
        }
    },
    "remaining_players": ["Lorem", "Snorlax"],
    "invited": [],
    "host": "",
    "code": "",
    "events": [],
    "state": 4,
    "event_history": [],
    "current_event": {}
}
function getPlayerArray() {
    let playerArray = new Array();
    Object.keys(dummylobbyState.players).forEach(player => {
        playerArray.push(dummylobbyState.players[player]);
    })
    return playerArray;
}