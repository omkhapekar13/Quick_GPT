import React from 'react'
import { Link } from 'react-router-dom'

const Notfound = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
      <h1 className="text-6xl font-black mb-4">404</h1>
      <p className="text-xl mb-6 text-gray-400">Oops! The page you are looking for does not exist.</p>
      <Link to="/" className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl transition duration-200">
        Go Home
      </Link>
    </div>
  )
}

export default Notfound
