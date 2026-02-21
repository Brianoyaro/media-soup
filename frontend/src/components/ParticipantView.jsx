import { useEffect, useRef } from 'react'

function VideoTile({ participant }) {
  const videoRef = useRef(null)

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream
    }
  }, [participant.stream])

  return (
    <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-lg">
      {participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={participant.isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-white">
              {participant.username?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
        <span className="bg-black/60 text-white text-sm px-3 py-1 rounded-full">
          {participant.username} {participant.isLocal && '(You)'}
        </span>
      </div>
    </div>
  )
}

function ParticipantView({ participants }) {
  const getGridClass = () => {
    const count = participants.length
    if (count === 1) return 'grid-cols-1 max-w-2xl'
    if (count === 2) return 'grid-cols-2 max-w-4xl'
    if (count <= 4) return 'grid-cols-2 max-w-4xl'
    if (count <= 6) return 'grid-cols-3 max-w-6xl'
    return 'grid-cols-4 max-w-7xl'
  }

  const getAspectClass = () => {
    const count = participants.length
    if (count === 1) return 'aspect-video'
    return 'aspect-video'
  }

  return (
    <div className={`grid ${getGridClass()} gap-4 mx-auto mb-24`}>
      {participants.map((participant) => (
        <div key={participant.id} className={getAspectClass()}>
          <VideoTile participant={participant} />
        </div>
      ))}
      
      {participants.length === 0 && (
        <div className="col-span-full text-center py-20">
          <p className="text-gray-500 text-lg">
            Waiting for participants to join...
          </p>
        </div>
      )}
    </div>
  )
}

export default ParticipantView
