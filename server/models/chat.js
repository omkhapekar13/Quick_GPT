import mongoose, { mongo } from "mongoose";

const ChatSchema = new mongoose.Schema({
    userId : {type: String,ref: 'User',required: true},
    userName : {type: String, required: true},
    name : {type:String, required: true},
    messages: [
        {
            isImage : {type: Boolean, required: true},
            isPublished : {type:Boolean, default: false},
            role : {type: String, required: true},
            content : {type: String, required: true},
            timestamp : {type: Number, required: true},
            isVectorIndexed: {type: Boolean, default: false},
        }
    ]
},{timestamps: true})

const Chat = mongoose.model('Chat',ChatSchema)

export default Chat;