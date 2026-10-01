import "dotenv/config";
import {OpenAI} from "openai";

const openai = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY || "missing_gemini_api_key",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

export default openai;