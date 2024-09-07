// SPDX-License-Identifier: MIT
pragma solidity 0.8.22;
import "./TrustMinimizedLLMReasoning.sol";

/**
 * @title NonCensoriousContentModaration - Decentralized Content Moderation System
 * @dev This contract implements a fair and transparent content moderation system.
 * 
 * please emphasize the following points:
 * 
 * 1. This contract was created to combat the proliferation of censorship 
 *    disguised as content moderation that is prevalent today.
 * 
 * 2. The mechanism involves registering scripts and actions with a Reasoning Hub, 
 *    which executes them via Chainlink Functions.
 *
 * 3. If you are a content moderation manager at platforms like X (formerly Twitter) 
 *    or Facebook, you should seriously consider implementing this system.
 * 4. you need to be flexible in writing code according to the situation of your application!!!!
 */

contract NonCensoriousContentModaration is IReasoning {
    address immutable hub;
    address immutable gov;
    uint256 public aiActionId;
    uint8 constant REQUEST_SLOT = 1;
    mapping(string => bool) public blockedPosts;
    uint256[] public lastResult;

    struct NonCensoriousContentModarationRequest {
        bytes encodedContentIds;
        uint256 actionId;
        address sender;
    }

    event PostObjected(uint256 indexed objectionId, address indexed author, string content);
    event PostsReviewed(uint256 fromObjectionId, uint256 toObjectionId, uint256[] blockedPostIds);

    address link = 0xE4aB69C077896252FAFBD49EFD26B5D171A32410;

    constructor(address _hub, address _gov) {
        hub = _hub;
        gov = _gov;

        string memory prompt = 
            "You are an AI that determines whether or not a social networking post violates the stated policy. "
            "1. First review the public policy guidelines. "
            "<policy>"
            "1. Hate speech and discrimination: Discriminatory statements or offensive content based on race, ethnicity, nationality, religion, gender, sexual orientation, age, disability, or other protected characteristics are forbidden."
            "2. Sharing personal information: Sharing others' personal information (address, phone number, email, etc.) without permission is prohibited."
            "3. Spreading misinformation: Intentionally spreading false information or fake news is not allowed."
            "4. Copyright infringement: Unauthorized use or distribution of copyrighted content is prohibited."
            "5. Promotion of illegal activities: Advertising or encouraging illegal activities or products is forbidden."
            "Posts that violate this policy may be removed, and users who repeatedly violate these guidelines may be subject to account suspension or permanent banning."
            "</policy>"
            "2. Please review the list of submissions below and consider whether each submission violates the policy guidelines."
            "<posts>"
            "{{POSTS}}"
            "</posts>"
            "3. Output the results according to the following output format."
            "<violating_posts>"
            "[List of IDs of posts that violate the policy]"
            "</violating_posts>"
            "4. Ensure that the violating_posts section contains a valid array of post IDs, even if the array is empty. For example:"
            "- If there are violating posts: [1, 3, 5]"
            "- If there are no violating posts: []";

        string memory code = "const ethers = await import('npm:ethers@5.7.0');const Anthropic = await import('npm:@anthropic-ai/sdk');console.log('Running Chainlink function');const decoder = new ethers.utils.AbiCoder();console.log('Arguments:', bytesArgs[0]);const contentIds = decoder.decode(['string[]'],bytesArgs[0])[0];console.log('Content IDs:', contentIds);const contents =await fetchTweets(contentIds);console.log('Contents:', contents);let postsDescription = contents.map((post, index) => `${index}:\\n${post}\\n`).join('\\n');console.log('Posts:', postsDescription);const prompt = args[0];const anthropic = new Anthropic.Anthropic({apiKey: secrets.apiKey});let response;try {response = await anthropic.messages.create({model: 'claude-3-sonnet-20240229',max_tokens: 1000,temperature: 0,messages: [{role: 'user',content: [{type: 'text',text: prompt.replace('{{POSTS}}', postsDescription)}]}]});} catch(e) {response = { content: [{ text: 'Error calling Anthropic API' }] };}function extractTagContent(xml, tagName) {const startTag = `<${tagName}>`;const endTag = `</${tagName}>`;const startIndex = xml.indexOf(startTag);const endIndex = xml.indexOf(endTag, startIndex + startTag.length);if (startIndex === -1 || endIndex === -1) {return '';}return xml.slice(startIndex + startTag.length, endIndex);}async function fetchTweets(tweetIds) {const bearerToken = secrets.xBearerToken;try {const response = await Functions.makeHttpRequest({url: 'https://api.twitter.com/2/tweets',method: 'GET',params: {ids: tweetIds.join(',')},headers: {'Authorization': `Bearer ${bearerToken}`}});if (response.error) {throw new Error(`API request failed: ${response.message}`);}console.log('\\n^^^^^^Response:', response.data.data.map((tweet) => tweet.text));return response.data.data.map((tweet) => tweet.text);} catch (error) {console.error('Error fetching tweets:', error);throw error;}}const result = response.content[0].text;const resultString = extractTagContent(result, 'violating_posts');console.log('Result:', resultString);return Functions.encodeString(resultString);";

        aiActionId = TrustMinimizedLLMReasoning(_hub).uploadAction(prompt, code);
    }

    function setAction(string memory prompt, string memory code) external {
        require(msg.sender == gov, "only gov");
        Types.Action memory action = TrustMinimizedLLMReasoning(hub).getAction(aiActionId);
        string memory newcode = bytes(code).length > 0 ? code : action.code;
        string memory newPrompt = bytes(prompt).length > 0 ? prompt : action.prompt;
        aiActionId = TrustMinimizedLLMReasoning(hub).uploadAction(newPrompt, newcode);
    }

    function execureReasoning(bytes memory secretUrl, uint256 linkAmount, string[] memory contentIds) external returns(bytes32) {
       Types.FunctionArgs memory functionArgs = getArgs(contentIds);
       bytes32 requestId = TrustMinimizedLLMReasoning(hub).executeAction(secretUrl, aiActionId,functionArgs , linkAmount, msg.sender);
       getRequest(requestId).encodedContentIds = functionArgs.bytesArgs[0];
       getRequest(requestId).sender = msg.sender;
       getRequest(requestId).actionId = aiActionId;
       return requestId;
    }

    function reasoningCallback(bytes32 requestId ,bytes memory result, address sender) external override {
        require(msg.sender == hub, "Only hub can call this function");
        string[] memory contentIds = abi.decode(getRequest(requestId).encodedContentIds, (string[]));
        string memory resultString = string(result);
        uint256[] memory blockedPostIds = _stringToUintArray(resultString);
        lastResult = blockedPostIds;
        if(blockedPostIds.length > 0) {
            for (uint256 i = 0; i < blockedPostIds.length; i++) {
                blockedPosts[contentIds[blockedPostIds[i]]] = true;
            }
        }
    }

    function getArgs(string[] memory contentIds) public pure returns(Types.FunctionArgs memory) {
        bytes[] memory bytesArgs = new bytes[](1);
        bytesArgs[0] = abi.encode(contentIds);

        return Types.FunctionArgs({
            args: new string[](0),
            bytesArgs: bytesArgs
        });
    }

 function _stringToUintArray(string memory str) public pure returns (uint[] memory) {
        bytes memory strBytes = bytes(str);
        uint count = 0;
        uint[] memory tempArray = new uint[](strBytes.length);  // 一時的に大きな配列を作成
        
        uint currentNumber = 0;
        bool isReadingNumber = false;

        for (uint i = 0; i < strBytes.length; i++) {
            bytes1 char = strBytes[i];
            
            if (char >= "0" && char <= "9") {
                currentNumber = currentNumber * 10 + (uint8(char) - 48); // "0"の代わりにASCIIコード48を使用
                isReadingNumber = true;
            } else if (char == "," || char == "]") {
                if (isReadingNumber) {
                    tempArray[count] = currentNumber;
                    count++;
                    currentNumber = 0;
                    isReadingNumber = false;
                }
            }
        }
        
        uint[] memory result = new uint[](count);
        for (uint j = 0; j < count; j++) {
            result[j] = tempArray[j];
        }

        return result;
    }

    function getRequest(bytes32 requestid) internal pure returns(NonCensoriousContentModarationRequest storage _s) {
        assembly {
            mstore(0,REQUEST_SLOT)
            mstore(32,requestid)
            _s.slot := keccak256(0,64)
        }
    }

    function getPrompt() external view returns(string memory) {
        return TrustMinimizedLLMReasoning(hub).getAction(aiActionId).prompt;
    }

    function getCode() external view returns(string memory) {
        return TrustMinimizedLLMReasoning(hub).getAction(aiActionId).code;
    }



}