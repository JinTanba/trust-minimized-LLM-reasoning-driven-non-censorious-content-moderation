const ethers = await import('npm:ethers@5.7.0');
const Anthropic = await import('npm:@anthropic-ai/sdk');
const decoder = new ethers.utils.AbiCoder();
const contentIds = decoder.decode(['string[]'],bytesArgs[0])[0];
const contents =await fetchTweets(contentIds);
let postsDescription = contents.map((post, index) => `${index}:\n${post}\n`).join('\n');
const prompt = args[0];
const anthropic = new Anthropic.Anthropic({apiKey: secrets.apiKey});

let response;
try {
    response = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        temperature: 0,
        messages: [{
            role: 'user',
            content: [{
                type: 'text',
                text: prompt.replace('{{POSTS}}', postsDescription)
            }]
        }]
    });
} catch(e) {
    response = { content: [{ text: 'Error calling Anthropic API' }] };
}

function extractTagContent(xml, tagName) {
    const startTag = `<${tagName}>`;
    const endTag = `</${tagName}>`;
    const startIndex = xml.indexOf(startTag);
    const endIndex = xml.indexOf(endTag, startIndex + startTag.length);
    if (startIndex === -1 || endIndex === -1) {
        return '';
    }
    return xml.slice(startIndex + startTag.length, endIndex);
}

async function fetchTweets(tweetIds) {
    const bearerToken = secrets.xBearerToken; // 環境変数からトークンを取得
  
    try {
      const response = await Functions.makeHttpRequest({
        url: 'https://api.twitter.com/2/tweets',
        method: 'GET',
        params: {
          ids: tweetIds.join(',')
        },
        headers: {
          'Authorization': `Bearer ${bearerToken}`
        }
      });
  
      if (response.error) {
        throw new Error(`API request failed: ${response.message}`);
      }
      return response.data.data.map((tweet) => tweet.text);
    } catch (error) {
      console.error('Error fetching tweets:', error);
      throw error;
    }
  }
  

const result = response.content[0].text;
const resultString = extractTagContent(result, 'violating_posts');

return Functions.encodeString(resultString);