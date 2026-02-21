import { useState, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { Device } from 'mediasoup-client'
import JoinScreen from './components/JoinScreen'
import Controls from './components/Controls'
import ParticipantView from './components/ParticipantView'

const SOCKET_SERVER = import.meta.env.VITE_SOCKET_SERVER || (
  import.meta.env.PROD 
    ? 'https://media-soup-oceq.onrender.com' 
    : 'http://localhost:3001'
)

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
  const deviceRef = useRef(null)
  const producerTransportRef = useRef(null)
  const consumerTransportRef = useRef(null)
  const producersRef = useRef(new Map())
  const consumersRef = useRef(new Map())
  const remoteStreamsRef = useRef(new Map())

  // Consume a remote producer
  const consumeProducer = useCallback(async (producerId, producerSocketId, kind, producerUsername) => {
    if (!deviceRef.current || !consumerTransportRef.current || !socketRef.current) {
      console.error('Not ready to consume')
      return
    }

    try {
      const response = await new Promise((resolve) => {
        socketRef.current.emit('consume', {
          producerId,
          rtpCapabilities: deviceRef.current.rtpCapabilities,
          transportId: consumerTransportRef.current.id
        }, resolve)
      })

      if (response.error) {
        console.error('Error consuming:', response.error)
        return
      }

      const consumer = await consumerTransportRef.current.consume({
        id: response.id,
        producerId: response.producerId,
        kind: response.kind,
        rtpParameters: response.rtpParameters
      })

      consumersRef.current.set(consumer.id, { consumer, producerSocketId })

      // Get or create remote stream for this peer
      let remoteStream = remoteStreamsRef.current.get(producerSocketId)
      if (!remoteStream) {
        remoteStream = new MediaStream()
        remoteStreamsRef.current.set(producerSocketId, remoteStream)
      }

      // Add track to stream
      remoteStream.addTrack(consumer.track)

      // Update participant with stream
      setParticipants(prev => prev.map(p => 
        p.id === producerSocketId 
          ? { ...p, stream: remoteStream }
          : p
      ))

      // Resume the consumer
      await new Promise((resolve) => {
        socketRef.current.emit('resumeConsumer', { consumerId: consumer.id }, resolve)
      })

      console.log(`Consuming ${kind} from ${producerUsername}`)
    } catch (err) {
      console.error('Error in consumeProducer:', err)
    }
  }, [])

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

      socketRef.current.on('connect', async () => {
        console.log('Connected to server')

        try {
          // Get router RTP capabilities and load device
          const rtpCapabilities = await new Promise((resolve) => {
            socketRef.current.emit('getRouterRtpCapabilities', resolve)
          })

          if (rtpCapabilities.error) {
            throw new Error(rtpCapabilities.error)
          }

          // Create and load mediasoup device
          deviceRef.current = new Device()
          await deviceRef.current.load({ routerRtpCapabilities: rtpCapabilities })
          console.log('Device loaded')

          // Join the room
          socketRef.current.emit('joinRoom', { username: name, roomId: room })
        } catch (err) {
          console.error('Error setting up device:', err)
          setError('Failed to initialize media device')
        }
      })

      socketRef.current.on('roomJoined', async (data) => {
        console.log(`Joined room ${data.roomId} as ${data.username}`)
        
        // Add local participant
        setParticipants([{ 
          id: 'local', 
          username: name, 
          stream, 
          isLocal: true 
        }])
        
        // Add existing peers
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

        // Create producer transport
        const producerTransportParams = await new Promise((resolve) => {
          socketRef.current.emit('createProducerTransport', resolve)
        })

        if (producerTransportParams.error) {
          console.error('Error creating producer transport:', producerTransportParams.error)
          return
        }

        producerTransportRef.current = deviceRef.current.createSendTransport(producerTransportParams)

        producerTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await new Promise((resolve) => {
              socketRef.current.emit('connectTransport', {
                transportId: producerTransportRef.current.id,
                dtlsParameters
              }, resolve)
            })
            callback()
          } catch (err) {
            errback(err)
          }
        })

        producerTransportRef.current.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
          try {
            const response = await new Promise((resolve) => {
              socketRef.current.emit('produce', {
                transportId: producerTransportRef.current.id,
                kind,
                rtpParameters
              }, resolve)
            })
            if (response.error) {
              errback(new Error(response.error))
            } else {
              callback({ id: response.id })
            }
          } catch (err) {
            errback(err)
          }
        })

        // Create consumer transport
        const consumerTransportParams = await new Promise((resolve) => {
          socketRef.current.emit('createConsumerTransport', resolve)
        })

        if (consumerTransportParams.error) {
          console.error('Error creating consumer transport:', consumerTransportParams.error)
          return
        }

        consumerTransportRef.current = deviceRef.current.createRecvTransport(consumerTransportParams)

        consumerTransportRef.current.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            await new Promise((resolve) => {
              socketRef.current.emit('connectTransport', {
                transportId: consumerTransportRef.current.id,
                dtlsParameters
              }, resolve)
            })
            callback()
          } catch (err) {
            errback(err)
          }
        })

        // Produce local tracks
        const audioTrack = stream.getAudioTracks()[0]
        const videoTrack = stream.getVideoTracks()[0]

        if (audioTrack) {
          const audioProducer = await producerTransportRef.current.produce({ track: audioTrack })
          producersRef.current.set('audio', audioProducer)
          console.log('Audio producer created')
        }

        if (videoTrack) {
          const videoProducer = await producerTransportRef.current.produce({ track: videoTrack })
          producersRef.current.set('video', videoProducer)
          console.log('Video producer created')
        }

        // Consume existing producers
        if (data.existingPeers) {
          for (const peer of data.existingPeers) {
            for (const { producerId, kind } of peer.producers) {
              await consumeProducer(producerId, peer.id, kind, peer.username)
            }
          }
        }
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

      socketRef.current.on('newProducer', async ({ producerId, producerSocketId, kind, username: producerUsername }) => {
        console.log(`New producer from ${producerUsername}: ${kind}`)
        await consumeProducer(producerId, producerSocketId, kind, producerUsername)
      })

      socketRef.current.on('producerClosed', ({ consumerId, producerId }) => {
        const consumerData = consumersRef.current.get(consumerId)
        if (consumerData) {
          consumerData.consumer.close()
          consumersRef.current.delete(consumerId)
        }
      })

      socketRef.current.on('participantLeft', ({ id, username: peerUsername }) => {
        console.log(`Participant left: ${peerUsername}`)
        
        // Clean up remote stream
        remoteStreamsRef.current.delete(id)
        
        // Clean up consumers for this peer
        consumersRef.current.forEach((value, key) => {
          if (value.producerSocketId === id) {
            value.consumer.close()
            consumersRef.current.delete(key)
          }
        })
        
        setParticipants(prev => prev.filter(p => p.id !== id))
      })

      socketRef.current.on('connect_error', (err) => {
        console.error('Connection error:', err)
        setError('Connection failed. Please try again.')
      })

    } catch (err) {
      console.error('Error accessing media devices:', err)
      setError('Could not access your camera and microphone. Please check your permissions.')
    }
  }, [consumeProducer])

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
    // Close producers
    producersRef.current.forEach((producer) => {
      producer.close()
    })
    producersRef.current.clear()

    // Close consumers
    consumersRef.current.forEach(({ consumer }) => {
      consumer.close()
    })
    consumersRef.current.clear()

    // Close transports
    if (producerTransportRef.current) {
      producerTransportRef.current.close()
      producerTransportRef.current = null
    }
    if (consumerTransportRef.current) {
      consumerTransportRef.current.close()
      consumerTransportRef.current = null
    }

    // Clear remote streams
    remoteStreamsRef.current.clear()

    if (socketRef.current) {
      socketRef.current.emit('leaveRoom', { username, roomId })
      socketRef.current.disconnect()
    }
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
    }

    deviceRef.current = null

    setIsJoined(false)
    setParticipants([])
    setAudioEnabled(true)
    setVideoEnabled(true)
    setUsername('')
    setRoomId('')
  }, [username, roomId])

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      producersRef.current.forEach((producer) => {
        producer.close()
      })
      consumersRef.current.forEach(({ consumer }) => {
        consumer.close()
      })
      if (producerTransportRef.current) {
        producerTransportRef.current.close()
      }
      if (consumerTransportRef.current) {
        consumerTransportRef.current.close()
      }
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
