function Controls({ 
  audioEnabled, 
  videoEnabled, 
  onToggleAudio, 
  onToggleVideo, 
  onLeave 
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-sm py-4">
      <div className="flex justify-center items-center gap-4">
        <button
          onClick={onToggleAudio}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-colors ${
            audioEnabled 
              ? 'bg-gray-700 text-white hover:bg-gray-600' 
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          {audioEnabled ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
            </svg>
          )}
          {audioEnabled ? 'Mute' : 'Unmute'}
        </button>

        <button
          onClick={onToggleVideo}
          className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-colors ${
            videoEnabled 
              ? 'bg-gray-700 text-white hover:bg-gray-600' 
              : 'bg-red-500 text-white hover:bg-red-600'
          }`}
        >
          {videoEnabled ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
            </svg>
          )}
          {videoEnabled ? 'Stop Video' : 'Start Video'}
        </button>

        <button
          onClick={onLeave}
          className="flex items-center gap-2 px-6 py-3 rounded-full font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
          </svg>
          Leave Room
        </button>
      </div>
    </div>
  )
}

export default Controls
