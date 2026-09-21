import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

client = genai.Client(api_key=api_key)
print("Available Gemini models:")
for m in client.models.list():
    if "gemini" in m.name and "flash" in m.name:
        # Strip the 'models/' prefix for display
        print("  •", m.name.replace("models/", ""))