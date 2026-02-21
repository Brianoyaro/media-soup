import { useState } from 'react'

function JoinScreen({ onJoin }) {
  const [username, setUsername] = useState('')
  const [roomId, setRoomId] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!username.trim() || !roomId.trim()) {
      alert('Please enter your name and room ID')
      return
    }

    setIsLoading(true)
    await onJoin(username.trim(), roomId.trim())
    setIsLoading(false)
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
        Join Room
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="username" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Your Name
          </label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            disabled={isLoading}
          />
        </div>

        <div>
          <label 
            htmlFor="roomId" 
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Room ID
          </label>
          <input
            type="text"
            id="roomId"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter room ID"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            disabled={isLoading}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Joining...
            </span>
          ) : (
            'Join'
          )}
        </button>
      </form>
    </div>
  )
}

export default JoinScreen
