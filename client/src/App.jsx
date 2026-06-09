import React from 'react'
import Sidebar from './components/Sidebar'
import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Credits from './pages/Credits'
import Login from './pages/Login'
import Notfound from './pages/Notfound'

const App = () => {
  return (
    <>
    <div className='dark:bg-gradient-to-b from-[#242124] to-[#000000] dark:text-white'>
      <div className='flex h-screen w-screen'>
        <Sidebar/>
        <Routes>
          <Route path='/' element={<Home/>}></Route>
          <Route path='/credits' element={<Credits/>}></Route>
          <Route path='/login' element={<Login/>}></Route>
          <Route path='*' element={<Notfound/>}></Route>
        </Routes>
      </div>
    </div>
    </>
  )
}

export default App