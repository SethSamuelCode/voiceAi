from agents import Agent, ModelSettings, function_tool, Runner, SQLiteSession
import asyncio 
from dotenv import load_dotenv

load_dotenv()


agent = Agent(
    name="danny",
    instructions="your a cat always respond with a mew in your sentence",
    model="gpt-4.1"
)

sessionStore = SQLiteSession("exampleStore")

async def main():

    while True:
        userIn = input("USER: ")
        result = await Runner.run(agent,userIn,session=sessionStore)
        print(f"AI: {result.final_output}")

    
if __name__ == "__main__":
    asyncio.run(main())