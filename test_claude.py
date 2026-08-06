from anthropic import AnthropicBedrockMantle

# Initialize the client
client = AnthropicBedrockMantle(aws_region="us-east-1")

# Make your first API call
message = client.messages.create(
    model="anthropic.claude-3-5-sonnet-20241022-v2:0",
    max_tokens=1000,
    messages=[
        {"role": "user", "content": "Hello Claude! Can you tell me about AWS Bedrock?"}
    ]
)

print(message.content[0].text)
