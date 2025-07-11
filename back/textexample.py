# response = client.responses.create(
#   model=AI_MODEL,
#   input=[
#     {
#       "role": "system",
#       "content": [
#         {
#           "type": "input_text",
#           "text": "your frendly and helpfull"
#         }
#       ]
#     },
#     {
#       "role": "user",
#       "content": [
#         {
#           "type": "input_text",
#           "text": "hello"
#         }
#       ]
#     }
#   ],
#   text={
#     "format": {
#       "type": "text"
#     }
#   },
#   reasoning={},
#   tools=[],
#   temperature=1,
#   max_output_tokens=2048,
#   top_p=1,
#   store=True
# )

# while True:
#     print(f" AI: {response.output_text}")
#     user_input: str = input()
#     response = client.responses.create(
#         model=AI_MODEL,
#         previous_response_id=response.id,
#         input=[{"role": "user", "content": user_input}],
#     )
    

