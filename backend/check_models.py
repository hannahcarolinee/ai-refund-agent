import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()
api_key = os.getenv("GROQ_API_KEY")

print("--------------------------------------------------")
print(f"API Key loaded: {api_key[:8]}... (Total length: {len(api_key) if api_key else 0})")
print("--------------------------------------------------")

if not api_key or "your_" in api_key:
    print("❌ ERROR: You have not pasted your real Groq API key into backend/.env yet!")
    exit(1)

client = Groq(api_key=api_key)
try:
    models = client.models.list()
    print("✅ Successfully connected! Here are your available models:\n")
    for m in models.data:
        if "llama" in m.id or "mixtral" in m.id:
            print(f"  • {m.id}")
except Exception as e:
    print("❌ Failed to connect to Groq:", e)