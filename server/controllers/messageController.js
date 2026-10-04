import axios from "axios"
import Chat from "../models/chat.js"
import User from "../models/user.js"
import imagekit from "../configs/imagekit.js"
import openai from "../configs/openai.js"
import {
  indexUserMessage,
  retrieveUserContext,
  buildUserRAGPrompt,
  generateUserRAGResponse,
} from "../services/ragService.js"

//Text-based AI Chat message controller
export const textMessageController = async (req, res) => {
    try {
        const userId = req.user._id

        //check credits
        if (req.user.credits < 1) {
            return res.json({ success: false, message: "You don't have enough credits to use this feature" })
        }

        const { chatId, prompt } = req.body

        const chat = await Chat.findOne({ userId, _id: chatId })
        if (!chat) {
            return res.json({ success: false, message: "Chat not found" })
        }

        // Get immediate recent history buffer from current chat (last 6 messages)
        const recentHistory = chat.messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
            isImage: m.isImage,
        }));

        const userMsgTimestamp = Date.now();
        chat.messages.push({ role: "user", content: prompt, timestamp: userMsgTimestamp, isImage: false })

        // Phase 5: Delegate 1-on-1 RAG, Memory Recall & Response Synthesis to Python RAG Microservice
        const ragResult = await generateUserRAGResponse({
            userId,
            query: prompt,
            userName: req.user.name || "User",
            chatId: chat._id,
            chatName: chat.name,
            recentHistory,
            topK: 4,
            minScore: 0.35,
            autoIndex: true, // Auto-indexes both user turn and AI response in Python
        });

        const replyContent = ragResult?.aiResponse || "I am here to help.";
        const reply = { role: "assistant", content: replyContent, timestamp: Date.now(), isImage: false }
        
        chat.messages.push(reply)
        await chat.save()

        // Deduct 1 credit
        await User.updateOne({ _id: userId }, { $inc: { credits: -1 } })

        res.json({ success: true, reply })

    } catch (error) {
        console.error("Error in textMessageController:", error);
        res.json({ success: false, message: error.message })
    }
}

// Image Generation message controller
export const imageMessageController = async (req, res) => {
    try {
        const userId = req.user._id;
        //check credits
        if (req.user.credits < 2) {
            return res.json({ success: false, message: "You don't have enough credits to use this feature" })
        }
        const { prompt, chatId, isPublished } = req.body
        //find chat
        const chat = await Chat.findOne({ userId, _id: chatId })

        //push user message
        chat.messages.push({ role: "user", content: prompt, timestamp: Date.now(), isImage: false })

        //encode the prompt
        const encodedPrompt = encodeURIComponent(prompt)

        //construct imagekit AI generation URL
        const generatedImageUrl = `${process.env.IMAGEKIT_URL_ENDPOINT}/ik-genimg-prompt-${encodedPrompt}/mygpt/${Date.now()}.png?tr=w-800,h-800`;

        const aiImageResponse = await axios.get(generatedImageUrl, { responseType: "arraybuffer" })


        //convert to Base64
        const base64Image = `data:image/png;base64,${Buffer.from(aiImageResponse.data, "binary").toString('base64')}`;

        //upload to ImageKit Media Library
        const uploadResponse = await imagekit.files.upload({
            file: base64Image,
            fileName: `${Date.now()}.png`,
            folder: "mygpt"
        })
        const reply = { role: 'assistant', content: uploadResponse.url, timestamp: Date.now(), isImage: true, isPublished }

        res.json({ success: true, reply })
        chat.messages.push(reply)
        await chat.save()

        await User.updateOne({ _id: userId }, { $inc: { credits: -2 } })
    } catch (error) {
        console.error("Error in imageMessageController:", error);
        res.json({ success: false, message: error.message })
    }
}