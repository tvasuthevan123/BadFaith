import React from 'react'
import { useState } from 'react'
import JoinLobbyCard from '../assets/svg/JoinLobbyComponent.svg'
import CreateLobbyCard from '../assets/svg/CreateLobbyComponent.svg'
import CreateLobbySettingsComponent from '../assets/svg/CreateLobbySettingsComponent.svg'
import EnterCodeComponent from '../assets/svg/EnterCodeComponent.svg'



function Lobby()
{
    const [openCard, setOpenCard] = useState(false)
    const [whichCard, setWhichCard] = useState('')
    const [joinCode, setJoinCode] = useState('')
    const [numberOfPlayers, setNumberOfPlayers] = useState(0)
    const [timeLimit, setTimeLimit] = useState(0)
    const [privateLobby, setPrivateLobby] = useState(false)
    const [codeCreated, setCodeCreated] = useState('')


    return (
        <div className='bg-lobby bg-cover h-screen bg-center grid place-items-center'>
            {
                openCard ?
                    <div >
                        {
                            whichCard === "join" ?
                                <div className='h-[400px] w-[800px] rounded-2xl border-2 border-black  bg-white text-center justify-between flex flex-col'>
                                    <p className='text-4xl mt-10'>ENTER CODE:</p>
                                    <input type="text" className='bg-gray-300 mx-36 text-center text-2xl font-another h-10 border-2 border-black' value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
                                    <button className='bg-black mb-10 h-14 text-4xl hover:text-5xl text-white active:text-4xl focus:outline-none' onClick={() => { setOpenCard(false); setWhichCard('') }}>Join</button>
                                </div>
                                :
                                <div>
                                    {
                                        codeCreated === ''
                                            ?
                                            <div className='flex flex-col text-center place-items-center h-[600px] w-[500px] bg-blue-500 border-4 border-black justify-between'>
                                                <p className='text-4xl text-white mt-10'>CREATE LOBBY</p>
                                                <div className='flex flex-col h-3/5 w-2/3 justify-around'>
                                                    <div className='flex flex-row justify-between'>
                                                        <p className='text-2xl text-white'>Number of Players:</p>
                                                        <input type="number" className=' text-center text-2xl w-[50px] font-another h-10 border-2 border-black' value={numberOfPlayers} onChange={(e) => setNumberOfPlayers(e.target.value)} />
                                                    </div>
                                                    <div className='flex flex-row justify-between'>
                                                        <p className='text-2xl text-white'>Time Limit:</p>
                                                        <input type="number" className=' text-center text-2xl w-[50px] font-another h-10 border-2 border-black' value={timeLimit} onChange={(e) => setTimeLimit(e.target.value)} />
                                                    </div>
                                                    <div className='flex flex-row justify-between'>
                                                        <p className='text-2xl text-white'>Private Lobby:</p>
                                                        <input type="checkbox" className='w-6 focus:outline-none' value={privateLobby} onChange={(e) => setPrivateLobby(e.target.value)} />
                                                    </div>
                                                </div>
                                                <button className='bg-white mb-10 h-14 text-4xl hover:text-5xl text-black active:text-4xl w-full focus:outline-none' onClick={() => { setCodeCreated('random code') }}>Create Code</button>
                                            </div> :
                                            <div className='flex flex-col text-center place-items-center h-[600px] w-[500px] bg-blue-500 border-4 border-black justify-evenly'>
                                                <p className='text-4xl text-white mt-10'>LOBBY CODE</p>
                                                <p className='text-4xl'>{codeCreated}</p>

                                            </div>
                                    }
                                </div>
                        }
                    </div>
                    :
                    <div>
                        <img src={JoinLobbyCard} alt="" className='absolute h-[40%] top-[10%] left-[10%] hover:h-[45%] hover:cursor-pointer' onClick={() => { setOpenCard(true); setWhichCard('join') }} />
                        <img src={CreateLobbyCard} alt="" className='absolute h-[70%] top-[10%] right-[10%] hover:h-[75%] hover:cursor-pointer' onClick={() => { setOpenCard(true); setWhichCard('create') }} />
                    </div>
            }
            <button className='active:text-4xl focus:outline-none absolute bottom-20 left-20 text-3xl text-white' onClick={() => { setOpenCard(false); setWhichCard(''); setCodeCreated('') }}>Back</button>
        </div>
    );

}

export default Lobby