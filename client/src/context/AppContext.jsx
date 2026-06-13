import { createContext, useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { dummyChats, dummyUserData } from "../assets/assets";

const AppContext = createContext();

export const AppContextProvider=({children})=>{
    const navigate = useNavigate();
    const [user,setUser] = useState(null);
    const [chats, setChats] = useState([]);
    const [selectedChat, setSelectedChat] = useState(null);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3000"

    const fetchUser= async()=>{
        const token = localStorage.getItem('token')
        if(!token) {
            setUser(null)
            return
        }
        try {
            const response = await fetch(`${backendUrl}/api/user/data`, {
                headers: {
                    Authorization: token
                }
            })
            const data = await response.json()
            if(data.success) {
                setUser(data.user)
            } else {
                localStorage.removeItem('token')
                setUser(null)
            }
        } catch (error) {
            console.error("Error fetching user:", error)
            setUser(null)
        }
    }
    
    const fetchUsersChats=async()=>{
        setChats(dummyChats)
        setSelectedChat()
    }

    useEffect(()=>{
        if(theme==='dark')
        {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme","dark");
        }
        else{
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme","light");
        }
    },[theme])

    useEffect(()=>{
        if(user)
        {
            fetchUsersChats()
        }else{
            setChats([])
            setSelectedChat(null)
        }
    },[user])
    
    useEffect(()=>{
        fetchUser()
    },[])
    const value = {
        navigate,user,setUser,fetchUser,chats,setChats,selectedChat,setSelectedChat,theme,setTheme,backendUrl
    }
    return(
        <AppContext.Provider value={value}>
            {children}
        </AppContext.Provider>
    )
}

export const useAppContext=()=>useContext(AppContext);