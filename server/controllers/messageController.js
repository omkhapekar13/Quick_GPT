import axios from "axios"
import Chat from "../models/chat.js"
import User from "../models/user.js"
import imagekit from "../configs/imagekit.js"
import openai from "../configs/openai.js"
import { indexUserMessage, retrieveUserContext, buildUserRAGPrompt } from "../services/ragService.js"

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

        // Retrieve cross-session long-term memories for this user
        const retrievedDocs = await retrieveUserContext({
            query: prompt,
            userId,
            excludeChatId: chatId,
            topK: 4,
            minScore: 0.35,
        });

        // Assemble personalized RAG prompt (async — delegates to Python RAG service)
        const messagesPayload = await buildUserRAGPrompt({
            query: prompt,
            userName: req.user.name || "User",
            retrievedDocs,
            recentHistory,
        });

        const userMsgTimestamp = Date.now();
        chat.messages.push({ role: "user", content: prompt, timestamp: userMsgTimestamp, isImage: false })

        const { choices } = await openai.chat.completions.create({
            model: "gemini-2.5-flash",
            messages: messagesPayload,
        });

        const replyContent = choices[0].message.content;
        const reply = { role: "assistant", content: replyContent, timestamp: Date.now(), isImage: false }
        
        chat.messages.push(reply)
        await chat.save()

        // Deduct 1 credit
        await User.updateOne({ _id: userId }, { $inc: { credits: -1 } })

        res.json({ success: true, reply })

        // Asynchronously index user prompt and AI reply into user's personal long-term memory
        indexUserMessage({
            userId,
            chatId: chat._id,
            chatName: chat.name,
            role: "user",
            content: prompt,
            timestamp: userMsgTimestamp,
        }).catch((err) => console.error("Async user msg index error:", err.message));

        indexUserMessage({
            userId,
            chatId: chat._id,
            chatName: chat.name,
            role: "assistant",
            content: replyContent,
            timestamp: reply.timestamp,
        }).catch((err) => console.error("Async AI reply index error:", err.message));

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