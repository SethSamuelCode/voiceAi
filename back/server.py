from openai import OpenAI
from dotenv import load_dotenv
load_dotenv() 

client = OpenAI()

response = client.chat.completions.create(
  model="gpt-4.1",
  messages=[
    {
      "role": "system",
      "content": [
        {
          "type": "text",
          "text": "your frendly and helpfull "
        }
      ]
    }
  ],
  response_format={
    "type": "text"
  },
  temperature=1,
  max_completion_tokens=2048,
  top_p=1,
  frequency_penalty=0,
  presence_penalty=0
)