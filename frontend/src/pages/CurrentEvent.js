import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import EventMap, { OutsideEvent } from "../components/eventMap";
import profilepic from "../assets/images/PlacholderIcon.png";
import { EventGenMap } from "../components/eventMap";



export default function CurrentEvent() {
    // const lobby = useState([]);

    return (
        <div>
            

            <div id="Event-Info">
                <div>
                    {EventMap(dummylobbyState.current_event)}
                </div>
            </div>

        </div>
    );
}

export function EventWaiting() {
    return (
        <div>
            <OutsideEvent event_data={dummylobbyState.current_event} />
        </div>
    );
}



function getPlayerArray() {
    let playerArray = new Array();
    Object.keys(lobbyPlayers).forEach(player => {
        playerArray.push(lobbyPlayers[player]);
    })
    return playerArray;
}

var lobbyPlayers = {
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
}
function getPlayerNickname(id) {

    return id.nickname;
}

const dummylobbyState = {
    "id": "",
    "players": [
        "DummyID",
        "Lorem",
        "Ipsum"


    ],
    "remaining_players": ["Lorem", "Snorlax"],
    "invited": [],
    "host": "",
    "code": "",
    "events": [],

    "event_history": [],
    "current_event": EventGenMap("PrivateDiscussion", lobbyPlayers.DummyID, getPlayerArray())
}
