import google.generativeai as genai
from rag_service.configs.settings import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

system_instruction = "You are an AI assistant in a room called 'Test Room'. Answer concisely."
model = genai.GenerativeModel(
    model_name="models/gemini-2.5-flash",
    system_instruction=system_instruction
)

chat_history = [
    {"role": "user", "parts": ["[Alice]: When is the team demo?"]},
    {"role": "model", "parts": ["The team demo is at 4 PM."]},
]

chat = model.start_chat(history=chat_history)
response = chat.send_message("What time did you say the demo was?")
print("AI Response:", response.text.strip())
