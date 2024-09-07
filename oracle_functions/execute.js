const fs = require("fs");
const path = require("path");
const {
  SubscriptionManager,
  SecretsManager,
  simulateScript,
  ReturnType,
  decodeResult,
  createGist,
} = require("@chainlink/functions-toolkit");
const axios = require('axios');
const functionsConsumerAbi = require("../artifact/contracts/TrustMinimizedLLMReasoning.sol/TrustMinimizedLLMReasoning.json");
require('dotenv').config();
const aiContractAbi = require("../artifacts/contracts/NonCensoriousContentModaration.sol/NonCensoriousContentModaration.json");
const ethers = require("ethers");
const consumerAddress = process.env.consumerAddress; // REPLACE this with your Functions consumer address
const subscriptionId = process.env.subId;// REPLACE this with your subscription ID
const gist = process.env.gist;
const apiKey = process.env.apiKey;
const privKey = process.env.privKey;
const xApiKey = process.env.xApiKey;
const xApiSecretKey = process.env.xApiSecretKey;
const gasLimit = 300000;
const aiContractAddress = process.env.aiContract;

const getPrompt = async(signer, id) => {
  const aiContract = new ethers.Contract(aiContractAddress, aiContractAbi, signer);
  const action = await aiContract.getAction(id);
  return action.prompt;
}

const approveMyAllLink = async (signer, linkTokenAddress) => {
  const linkToken = new ethers.Contract(linkTokenAddress, [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address owner) external view returns (uint256)",
  ], signer);
  const myLinkAmount = await linkToken.balanceOf(signer.address);
  const tx = await linkToken.approve(aiContractAddress, myLinkAmount);
  await tx.wait();
  console.log("Approved LINK spending for consumer contract");
}

const makeRequestSepolia = async () => {
  // hardcoded for Ethereum Sepolia
  const routerAddress = "0xf9B8fc078197181C841c296C876945aaa425B278";
  const linkTokenAddress = "0xE4aB69C077896252FAFBD49EFD26B5D171A32410";
  const donId = "fun-base-sepolia-1";
  const explorerUrl = "https://sepolia.basescan.org/";
  const bearerToken = await getBearerToken(xApiKey, xApiSecretKey);
  const secrets = {apiKey:apiKey ,privKey: privKey, xBearerToken: bearerToken};
  console.log(secrets)
  // Initialize functions settings
  const source = fs
    .readFileSync(path.resolve(__dirname, "source.js"))
    .toString();

  // Initialize ethers signer and provider to interact with the contracts onchain
  const privateKey = secrets.privKey; 
  if (!privateKey)
    throw new Error(
      "private key not provided - check your environment variables"
    );

  const rpcUrl = 'https://base-sepolia.g.alchemy.com/v2/k3Dvibh6qSOCk1KkssKyZub9r6AuK1qy'; // fetch Sepolia RPC URL

  if (!rpcUrl)
    throw new Error(`rpcUrl not provided  - check your environment variables`);

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

  const wallet = new ethers.Wallet(privateKey);
  const signer = wallet.connect(provider); // create ethers signer for signing transactions
  const functionsConsumer = new ethers.Contract(
    consumerAddress,
    functionsConsumerAbi,
    signer
  );
  // await approveMyAllLink(signer, linkTokenAddress); 
  // const functionArgs = await functionsConsumer.getArgs();
  const contentIdsEnocded = ethers.utils.defaultAbiCoder.encode(["string[]"], [["1822327720648310952"]]);
  const prompt = await getPrompt(signer, await functionsConsumer.aiActionId())
  console.log("Prompt", prompt);
  ///////// START SIMULATION ////////////

  console.log("Start simulation...");

  const response = await simulateScript({
    source: source,
    args: [prompt],
    bytesArgs:[contentIdsEnocded], // bytesArgs - arguments can be encoded off-chain to bytes.
    secrets: secrets,
  });

  console.log("Simulation result", response);
  const errorString = response.errorString;
  if (errorString) {
    console.log(`❌ Error during simulation: `, errorString);
  } else {
    const returnType = ReturnType.uint256;
    const responseBytesHexstring = response.responseBytesHexstring;
    if (ethers.utils.arrayify(responseBytesHexstring).length > 0) {
      const decodedResponse = decodeResult(
        response.responseBytesHexstring,
        returnType
      );
      console.log(`✅ Decoded response to ${returnType}: `, decodedResponse);
    }
  }

  //////// ESTIMATE REQUEST COSTS ////////
  console.log("\nEstimate request costs...");
  // Initialize and return SubscriptionManager
  const subscriptionManager = new SubscriptionManager({
    signer: signer,
    linkTokenAddress: linkTokenAddress,
    functionsRouterAddress: routerAddress,
  });
  await subscriptionManager.initialize();

  // estimate costs in Juels

  const gasPriceWei = await signer.getGasPrice(); // get gasPrice in wei

  const estimatedCostInJuels =
    await subscriptionManager.estimateFunctionsRequestCost({
      donId: donId, // ID of the DON to which the Functions request will be sent
      subscriptionId: subscriptionId, // Subscription ID
      callbackGasLimit: gasLimit, // Total gas used by the consumer contract's callback
      gasPriceWei: BigInt(gasPriceWei), // Gas price in gWei
    });

  console.log(
    `Fulfillment cost estimated to ${ethers.utils.formatEther(
      estimatedCostInJuels
    )} LINK`
  );

  //////// MAKE REQUEST ////////

  console.log("\nMake request...");

  // First encrypt secrets and create a gist
  const secretsManager = new SecretsManager({
    signer: signer,
    functionsRouterAddress: routerAddress,
    donId: donId,
  });
  await secretsManager.initialize();

  // Encrypt secrets
  const encryptedSecretsObj = await secretsManager.encryptSecrets(secrets);

  console.log(`Creating gist...`);
  const githubApiToken = gist;
  if (!githubApiToken)
    throw new Error(
      "githubApiToken not provided - check your environment variables"
    );

  // Create a new GitHub Gist to store the encrypted secrets
  const gistURL = await createGist(
    githubApiToken,
    JSON.stringify(encryptedSecretsObj)
  );
  console.log(`\n✅Gist created ${gistURL} . Encrypt the URLs..`);
  const encryptedSecretsUrls = await secretsManager.encryptSecretsUrls([
    gistURL,
  ]);

  console.log('✅Encrypted', encryptedSecretsUrls);
  console.log(estimatedCostInJuels)
  const targetPost = ["1822327720648310952"];//🦄 input x content id!!!!
  // Actual transaction call
  const transaction = await functionsConsumer.execureReasoning(
    encryptedSecretsUrls,
    estimatedCostInJuels,
    targetPost,
  );
  console.log("Transaction hash:", transaction.hash);
  console.log("Waiting for transaction to be mined...");

  // Wait for the transaction to be mined
  const receipt = await transaction.wait();

  console.log("🦄🦄Transaction mined. Receipt:", receipt);

  // Get the returned bytes32 value
  const returnedBytes32 = receipt.events[0].data;
  console.log("Returned bytes32 value:", returnedBytes32);

};


async function getBearerToken(apiKey, apiSecretKey) {
  const url = 'https://api.twitter.com/oauth2/token';
  const credentials = Buffer.from(`${apiKey}:${apiSecretKey}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
  };
  const data = 'grant_type=client_credentials';
  try {
    const response = await axios.post(url, data, { headers });

    return response.data.access_token;
  } catch (error) {
    console.error('Bearer Tokenの取得に失敗しました:', error.response ? error.response.data : error.message);
    return null;
  }
}
// approveMyAllLink();
makeRequestSepolia().catch(console.error);

