import React, { useState } from 'react'

const Login = () => {
  const [state, setState] = useState("login")

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
  }

  return (
    <div className='flex items-center justify-center min-h-screen w-screen bg-gradient-to-b from-purple-50 to-indigo-100 dark:bg-gradient-to-b dark:from-[#242124] dark:to-[#000000] p-4 relative overflow-hidden'>
      {/* Soft Backdrop */}
      <div className='absolute inset-0 z-0 pointer-events-none'>
        <div className='absolute left-1/2 top-20 -translate-x-1/2 w-[600px] sm:w-[980px] h-[300px] sm:h-[460px] bg-linear-to-tr from-purple-400/20 dark:from-indigo-800/35 to-transparent rounded-full blur-3xl' />
        <div className='absolute right-12 bottom-10 w-[300px] sm:w-[420px] h-[150px] sm:h-[220px] bg-linear-to-bl from-purple-300/25 dark:from-indigo-700/35 to-transparent rounded-full blur-2xl' />
      </div>

      <form
        onSubmit={handleSubmit}
        className="w-full sm:w-[350px] text-center bg-white/70 dark:bg-white/5 border border-purple-200/50 dark:border-white/10 rounded-2xl px-8 py-4 shadow-xl shadow-purple-900/5 dark:shadow-none backdrop-blur-md z-10"
      >
        <h1 className="text-purple-700 dark:text-white text-3xl mt-6 font-medium">
          {state === "login" ? "Login" : "Sign up"}
        </h1>

        <p className="text-purple-500 dark:text-purple-300 text-sm mt-2">
          Please {state === "login" ? "sign in" : "create an account"} to continue
        </p>

        {state !== "login" && (
          <div className="flex items-center mt-6 w-full bg-purple-50/50 dark:bg-white/5 ring-2 ring-purple-100/70 dark:ring-white/10 focus-within:ring-purple-500/50 dark:focus-within:ring-indigo-500/60 h-12 rounded-full overflow-hidden pl-6 gap-2 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-purple-600/70 dark:text-white/60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="5" />
              <path d="M20 21a8 8 0 0 0-16 0" />
            </svg>
            <input 
              type="text" 
              name="name" 
              placeholder="Name" 
              className="w-full bg-transparent text-purple-950 dark:text-white placeholder-purple-400/80 dark:placeholder-white/60 border-none outline-none" 
              value={formData.name} 
              onChange={handleChange} 
              required 
            />
          </div>
        )}

        <div className="flex items-center w-full mt-4 bg-purple-50/50 dark:bg-white/5 ring-2 ring-purple-100/70 dark:ring-white/10 focus-within:ring-purple-500/50 dark:focus-within:ring-indigo-500/60 h-12 rounded-full overflow-hidden pl-6 gap-2 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-purple-600/70 dark:text-white/75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
            <rect x="2" y="4" width="20" height="16" rx="2" />
          </svg>
          <input 
            type="email" 
            name="email" 
            placeholder="Email id" 
            className="w-full bg-transparent text-purple-950 dark:text-white placeholder-purple-400/80 dark:placeholder-white/60 border-none outline-none" 
            value={formData.email} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div className="flex items-center mt-4 w-full bg-purple-50/50 dark:bg-white/5 ring-2 ring-purple-100/70 dark:ring-white/10 focus-within:ring-purple-500/50 dark:focus-within:ring-indigo-500/60 h-12 rounded-full overflow-hidden pl-6 gap-2 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-purple-600/70 dark:text-white/75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <input 
            type="password" 
            name="password" 
            placeholder="Password" 
            className="w-full bg-transparent text-purple-950 dark:text-white placeholder-purple-400/80 dark:placeholder-white/60 border-none outline-none" 
            value={formData.password} 
            onChange={handleChange} 
            required 
          />
        </div>

        <div className="mt-4 text-left">
          <button className="text-sm text-purple-600 dark:text-indigo-400 hover:underline cursor-pointer">
            Forget password?
          </button>
        </div>

        <button 
          type="submit" 
          className="mt-6 w-full h-11 rounded-full text-white bg-purple-600 hover:bg-purple-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 transition cursor-pointer"
        >
          {state === "login" ? "Login" : "Sign up"}
        </button>

        <p 
          onClick={() => setState(prev => prev === "login" ? "register" : "login")} 
          className="text-gray-500 dark:text-gray-400 text-sm mt-4 mb-6 cursor-pointer"
        >
          {state === "login" ? "Don't have an account?" : "Already have an account?"}
          <span className="text-purple-600 dark:text-indigo-400 hover:underline ml-1">click here</span>
        </p>
      </form>
    </div>
  )
}

export default Login