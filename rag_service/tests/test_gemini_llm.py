import os
import sys
from openai import OpenAI
from rag_service.configs.settings import GEMINI_API_KEY

print("Testing Gemini LLM chat completion via OpenAI-compatible endpoint...")
client = OpenAI(
    api_key=GEMINI_API_KEY,
    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
)

for model_name in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
    try:
        print(f"Trying model: {model_name}...")
        resp = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": "Hello, respond with 'RAG ready'."},
            ],
            max_tokens=20,
        )
        print(f"SUCCESS with {model_name}! Response: {resp.choices[0].message.content.strip()}")
        break
    except Exception as e:
        print(f"Failed with {model_name}: {e}")
