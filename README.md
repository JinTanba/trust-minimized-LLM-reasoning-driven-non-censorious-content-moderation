

![IMG_2440](https://github.com/user-attachments/assets/7779ffb2-67a6-4142-9fd1-bc379bd6bb7d)


# LLM and blockchain-based trust-minimized reasoning, and content moderation that avoids censorship (信用最小化推論)

When making important decisions based on LLM reasoning, the instructions given to the LLM become extremely crucial. Therefore, these instructions may need to go through a democratic process or require consensus. For example, if LLM reasoning is used for court decisions, bank loan assessments, or content moderation, the instructions guiding the LLM's judgment might require agreement between parties or even elections. One of the problems that can arise in such situations is the inability to prove the connection between the reasoning results and the given instructions. In the case of AI-driven content moderation, when a user is told "Your post has been banned due to violating the terms of service," there's no way to prove that this decision was truly based on instructions agreed upon by the user. The moderation might actually be happening for different reasons. In these cases, the ideal solution would be for the LLM to generate and always be able to submit some form of mathematically provable proof linking the instructions to the output. However, such a method doesn't exist (as far as I know!). Therefore, the best available method currently might be to execute the LLM using an Oracle (like Chainlink) with blockchain and smart contracts. This method allows for preparing instructions through DAO governance on-chain and executing LLM reasoning while proving on-chain that these exact instructions are being used. The TrustMinimizedLLMReasoning provided here enables LLM reasoning execution via on-chain methods using Chainlink. NonCensoriousContentModeration presents a use case of decentralized and transparent content moderation for X (Twitter).



https://www.reuters.com/technology/durov-says-telegram-will-take-new-approach-towards-moderation-2024-09-06/
