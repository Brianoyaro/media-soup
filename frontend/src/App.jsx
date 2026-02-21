import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import JoinScreen from './components/JoinScreen'
import Controls from './components/Controls'
import ParticipantView from './components/ParticipantView'

const SOCKET_SERVER = 'http://localhost:3001'

function App() {
  const [isJoined, setIsJoined] = useState(false)
  const [username, setUsername] = useState('')
  const [roomId, setRoomId] = useState('')
  const [participants, setParticipants] = useState([])
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [error, setError] = useState(null)
  
  const socketRef = useRef(null)
  const localStreamRef = useRef(null)

  const handleJoin = useCallback(async (name, room) => {
    setUsername(name)
    setRoomId(room)
    setError(null)

    try {
      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      })
      localStreamRef.current = stream

      // Connect to socket
      socketRef.current = io(SOCKET_SERVER)

      socketRef.current.on('connect', () => {
        console.log('Connected to server')
        socketRef.current.emit('joinRoom', { username: name, roomId: room })
      })

      socketRef.current.on('roomJoined', (data) => {
        console.log(`Joined room ${data.roomId} as ${data.username}`)
        
        // Add local participant
        setParticipants([{ 
          id: 'local', 
          username: name, 
          stream, 
          isLocal: true 
        }])
        
        // Add existing peers (they would have their own streams in a full implementation)
        if (data.existingPeers) {
          data.existingPeers.forEach(peer => {
            setParticipants(prev => [...prev, { 
              id: peer.id, 
              username: peer.username, 
              stream: null, 
              isLocal: false 
            }])
          })
        }
        
        setIsJoined(true)
      })

      socketRef.current.on('newParticipant', ({ id, username: peerUsername }) => {
        console.log(`New participant: ${peerUsername}`)
        setParticipants(prev => {
          if (prev.find(p => p.id === id)) return prev
          return [...prev, { 
            id, 
            username: peerUsername, 
            stream: null, 
            isLocal: false 
          }]
        })
      })

      socketRef.current.on('participantLeft', ({ id, username: peerUsername }) => {
        console.log(`Participant left: ${peerUsername}`)
        setParticipants(prev => prev.filter(p => p.id !== id))
      })

      socketRef.current.on('transportCreated', (data) => {
        console.log('Transport created:', data)
      })

      socketRef.current.on('connect_error', (err) => {
        console.error('Connection error:', err)
        setError('Connection failed. Please try again.')
      })

    } catch (err) {
      console.error('Error accessing media devices:', err)
      setError('Could not access your camera and microphone. Please check your permissions.')
    }
  }, [])

  const handleToggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled
        setAudioEnabled(!audioEnabled)
      }
    }
  }, [audioEnabled])

  const handleToggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled
        setVideoEnabled(!videoEnabled)
      }
    }
  }, [videoEnabled])

  const handleLeave = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('leaveRoom', { username, roomId })
      socketRef.current.disconnect()
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }

    setIsJoined(false)
    setParticipants([])
    setAudioEnabled(true)
    setVideoEnabled(true)
    setUsername('')
    setRoomId('')
  }, [username, roomId])

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center">
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-4 text-white hover:text-gray-200"
          >
            ×
          </button>
        </div>
      )}
      
      {!isJoined ? (
        <JoinScreen onJoin={handleJoin} />
      ) : (
        <>
          <div className="w-full max-w-6xl px-4 py-8">
            <div className="mb-4 text-center">
              <h2 className="text-2xl font-bold text-gray-800">
                Room: {roomId}
              </h2>
              <p className="text-gray-600">
                Joined as {username}
              </p>
            </div>
            
            <ParticipantView participants={participants} />
          </div>
          
          <Controls
            audioEnabled={audioEnabled}
            videoEnabled={videoEnabled}
            onToggleAudio={handleToggleAudio}
            onToggleVideo={handleToggleVideo}
            onLeave={handleLeave}
          />
        </>
      )}
    </div>
  )
}

export default App
