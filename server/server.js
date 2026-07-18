import express from 'express'
import 'dotenv/config'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import connectDB from './configs/db.js'
import userRouter from './routes/userRoutes.js'
import chatRouter from './routes/chatRoutes.js'
import messageRouter from './routes/messageRoutes.js'
import creditRouter from './routes/creditRoutes.js'
import roomRouter from './routes/roomRoutes.js'
import { initSocket } from './socket/roomSocket.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
})

await connectDB()
//Middlewares
app.use(cors())
app.use(express.json())

app.use((req, res, next) => {
  req.io = io;
  next();
});

//Routes
app.get('/',(req,res)=>{
    res.send("Server is Live !")
})
app.use('/api/user',userRouter)
app.use('/api/chat',chatRouter)
app.use('/api/message',messageRouter)
app.use('/api/credit',creditRouter)
app.use('/api/room',roomRouter)

// Initialize Socket IO handlers
initSocket(io)

const PORT = process.env.PORT || 3000
httpServer.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`)
})