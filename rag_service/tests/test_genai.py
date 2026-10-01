import google.generativeai as genai
from rag_service.configs.settings import GEMINI_API_KEY

genai.configure(api_key=GEMINI_API_KEY)

print("Listing models with genai...")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(f"Supported model: {m.name}")

model = genai.GenerativeModel("models/gemini-2.5-flash")
resp = model.generate_content("Hello! Say 'Gemini ready'")
print(f"Response: {resp.text.strip()}")
