import React, { useState } from 'react'
import Sidebar from './components/Sidebar'
import { Routes, Route, Outlet, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Credits from './pages/Credits'
import Login from './pages/Login'
import Notfound from './pages/Notfound'
import { assets } from './assets/assets'
import Community from './pages/Community'
import './assets/prism.css'
import Loading from './pages/Loading'
import { useAppContext } from './context/AppContext'
import {Toaster} from 'react-hot-toast'
import RoomList from './pages/RoomList'
import RoomPage from './pages/RoomPage'
import JoinRoom from './pages/JoinRoom'

// A layout wrapper that renders the Sidebar and top menu button
const AppLayout = ({ isMenuOpen, setIsMenuOpen }) => {
  const {user, loadingUser} = useAppContext()
  return (
    <>
      <Toaster/>
      {!isMenuOpen && (
        <img 
          src={assets.menu_icon} 
          className='absolute top-3 left-3 w-8 h-8 cursor-pointer md:hidden not-dark:invert' 
          onClick={() => setIsMenuOpen(true)} 
        />
      )}
      {user ? (
      <div className='dark:bg-gradient-to-b from-[#242124] to-[#000000] dark:text-white h-screen overflow-hidden'>
        <div className='flex h-full w-full overflow-hidden'>
          <Sidebar isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />
          <Outlet />
        </div>
      </div>
      ):(
        <div className='bg-gradient-to-b from-[#242124] to-[#000000] flex items-center justify-center h-screen w-screen'>
          <Login/>
        </div>
      )}
    </>
  )
}

const App = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const { loadingUser } = useAppContext()

  if(pathname === '/loading' || loadingUser) return <Loading/>
  return (
    <Routes>
      {/* Pages without Sidebar (Full Screen) */}
      <Route path='/loading' element={<Loading />} />
      <Route path='/login' element={<Login />} />

      {/* Pages with Sidebar */}
      <Route element={<AppLayout isMenuOpen={isMenuOpen} setIsMenuOpen={setIsMenuOpen} />}>
        <Route path='/community' element={<Community />} />
        <Route path='/' element={<Home />} />
        <Route path='/credits' element={<Credits />} />
        <Route path='/rooms' element={<RoomList />} />
        <Route path='/room/:roomId' element={<RoomPage />} />
        <Route path='/room/join/:inviteCode' element={<JoinRoom />} />
        <Route path='*' element={<Notfound />} />
      </Route>
    </Routes>
  )
}

export default App