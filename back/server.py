from openai import OpenAI
from dotenv import load_dotenv
from typing import Final
load_dotenv()

client = OpenAI()
AI_MODEL: Final[str] = "gpt-4.1"

response = client.responses.create(
  model=AI_MODEL,
  input=[
    {
      "role": "system",
      "content": [
        {
          "type": "input_text",
          "text": "your frendly and helpfull"
        }
      ]
    },
    {
      "role": "user",
      "content": [
        {
          "type": "input_text",
          "text": "hello"
        }
      ]
    }
  ],
  text={
    "format": {
      "type": "text"
    }
  },
  reasoning={},
  tools=[],
  temperature=1,
  max_output_tokens=2048,
  top_p=1,
  store=True
)

while True:
    print(f" AI: {response.output_text}")
    user_input: str = input()
    response = client.responses.create(
        model=AI_MODEL,
        previous_response_id=response.id,
        input=[{"role": "user", "content": user_input}],
    )
    