import { MongoClient } from 'mongodb';
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import "dotenv/config";
import { EnvVariables } from "../interface/type";
import { conference_urls } from "../data/urls";

const {
  MONGODB_URI,
  MONGODB_DB_NAME,
  MONGODB_COLLECTION,
  GEMINI_API_KEY,
} = process.env as unknown as EnvVariables;

if (!MONGODB_URI || !MONGODB_DB_NAME || !MONGODB_COLLECTION) {
    throw new Error("Required MongoDB environment variables are not set");
}

if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set");
}

// Initialize MongoDB client
const client = new MongoClient(MONGODB_URI);
const database = client.db(MONGODB_DB_NAME);
const collection = database.collection(MONGODB_COLLECTION);

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async () => {
    try {
        // Drop existing collection if it exists
        try {
            await database.dropCollection(MONGODB_COLLECTION);
        } catch (e) {
            console.log("No existing collection to drop");
        }

        await database.createCollection(MONGODB_COLLECTION);
        
        await collection.createIndex(
            { embedding: 1 },
            {
                name: "vector_index",
                background: true,
                custom: {
                    type: "vectorSearch",
                    dimensions: 768,
                    similarity: "cosine"
                }
            } as any
        );
        console.log("Collection and vector index created successfully");
    } catch (error) {
        console.error("Error creating collection:", error);
    }
}

const connectToDatabase = async () => {
    try {
        await client.connect();
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

const closeConnection = async () => {
    try {
        await client.close();
        console.log("MongoDB connection closed");
    } catch (error) {
        console.error("Error closing MongoDB connection:", error);
    }
}

const scrapePage = async (url: string) => {
    const loader = new PuppeteerWebBaseLoader(url, {
        launchOptions: {
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        },
        gotoOptions: {
            waitUntil: 'networkidle2',
            timeout: 120000
        },
        async evaluate(page) {
            await page.setDefaultNavigationTimeout(120000);
            await page.setDefaultTimeout(120000);
            
            try {
                await page.waitForSelector('#main', { timeout: 60000 })
                    .catch(() => page.waitForSelector('.body-block', { timeout: 60000 }))
                    .catch(() => page.waitForSelector('article', { timeout: 60000 }))
                    .catch(() => page.waitForSelector('body', { timeout: 60000 }));
                
                const content = await page.evaluate(() => {
                    const elementsToRemove = [
                        'script', 'style', 'header', 'footer', 'nav',
                        '.navigation', '.header', '.footer', '#header', '#footer'
                    ];
                    
                    elementsToRemove.forEach(selector => {
                        document.querySelectorAll(selector).forEach(el => el.remove());
                    });
                    
                    const mainContent = document.querySelector('#main') ||
                                      document.querySelector('.body-block') ||
                                      document.querySelector('article') ||
                                      document.querySelector('.content');
                    
                    return mainContent 
                        ? (mainContent as HTMLElement).innerText.trim()
                        : (document.body as HTMLElement).innerText.trim();
                });
                
                return content;
            } catch (error) {
                console.log('Error in page evaluation:', error);
                return '';
            }
        }
    });
    
    const docs = await loader.load();
    return docs[0]?.pageContent || '';
}

const loadSampleData = async () => {
    for (let i = 0; i < conference_urls.length; i++) {
        const url = conference_urls[i];
        try {
            console.log(`Processing URL ${i + 1}/${conference_urls.length}: ${url}`);

    const content = await scrapePage(url);
            if (!content) {
                console.error(`No content retrieved for URL: ${url}`);
                continue;
            }

    const chunks = await splitter.splitText(content);
            console.log(`Split into ${chunks.length} chunks`);

            for (let j = 0; j < chunks.length; j++) {
                const chunk = chunks[j];
                try {
                    const embeddingResult = await model.embedContent(chunk);
                    const vectorValues = embeddingResult.embedding.values || embeddingResult.embedding;
                    
                    await collection.insertOne({
                        text: chunk,
                        embedding: vectorValues,  // Store the raw vector values
                        metadata: {
                            chunkIndex: j + 1,
                            totalChunks: chunks.length
                        },
                        url: url
                    });

                    if ((j + 1) % 10 === 0) {
                        console.log(`Processed ${j + 1}/${chunks.length} chunks`);
                    }
                } catch (error) {
                    console.error(`Error processing chunk: ${error}`);
                }
            }
        } catch (error) {
            console.error(`Error processing URL ${url}:`, error);
        }
    }
}

async function main() {
    try {
        await connectToDatabase();
        await createCollection();
        await loadSampleData();
        console.log("Data loading completed successfully");
    } catch (error) {
        console.error("Error in main process:", error);
    } finally {
        await closeConnection();
    }
}

main().catch(console.error);
