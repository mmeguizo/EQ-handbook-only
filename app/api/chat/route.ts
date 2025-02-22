import OpenAI from "openai";
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { EnvVariables, Message } from "@/interface/type";

const {
    GEMINI_API_KEY,
    MONGODB_URI,
    MONGODB_DB_NAME,
    MONGODB_COLLECTION,
} = process.env as unknown as EnvVariables;

const openai = new OpenAI({
    apiKey: GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

// Initialize MongoDB client
const client = new MongoClient(MONGODB_URI);
const database = client.db(MONGODB_DB_NAME);
const collection = database.collection(MONGODB_COLLECTION);

// Add connection function
async function connectDB() {
    try {
        await client.connect();
        console.log("MongoDB connected successfully");
        
        // Test the collection
        const count = await client.db(MONGODB_DB_NAME)
            .collection(MONGODB_COLLECTION)
            .countDocuments();
        console.log(`Collection has ${count} documents`);
        return true;
    } catch (error) {
        console.error("MongoDB connection error:", error);
        return false;
    }
}

// Add this type at the top with other imports
type ErrorWithStatus = {
    status: number;
    message: string;
};

export async function POST(req: Request) {
    try {
        console.log("Starting POST request handler");
        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1]?.content;
        console.log("Query:", lastMessage);

        let docContext = "";
        try {
            // Ensure DB connection
            await connectDB();
            
            console.log("Creating embedding for:", lastMessage);
            const embedding = await openai.embeddings.create({
                model: "text-embedding-004",
                input: lastMessage,
            });
            console.log("Embedding created successfully");

            // First, let's check what the embeddings look like
            console.log("Query embedding length:", embedding.data[0].embedding.length);

            // Try a simple find first to verify document structure
            const sampleDoc = await collection.findOne({});
            console.log("Sample document structure:", {
                hasEmbedding: !!sampleDoc?.embedding,
                embeddingLength: sampleDoc?.embedding?.length,
                textPreview: sampleDoc?.text?.substring(0, 100)
            });

            // MongoDB vector search query
            const documents = await collection.aggregate([
                {
                    $search: {
                        index: "vector_index",
                        knnBeta: {
                            vector: embedding.data[0].embedding,
                            path: "embedding",
                            k: 20
                        }
                    }
                },
                {
                    $project: {
                        text: 1,
                        score: { $meta: "searchScore" },
                        url: 1
                    }
                }
            ]).toArray();

            console.log("Vector search results:", {
                count: documents.length,
                firstMatchScore: documents[0]?.score,
                firstMatchPreview: documents[0]?.text?.substring(0, 100),
                firstMatchUrl: documents[0]?.url
            });

            // Only throw if no documents found
            if (documents.length === 0) {
                // Try a regular text search as fallback
                const textResults = await collection.find({
                    text: { 
                        $regex: /elders.*quorum|quorum.*elders/i 
                    }
                }).limit(5).toArray();
                
                if (textResults.length > 0) {
                    documents.push(...textResults);
                    console.log("Using text search results as fallback");
                } else {
                    throw new Error("No relevant documents found in search");
                }
            }

            // Log first document for debugging
            if (documents[0]) {
                console.log("First result preview:", documents[0].text.substring(0, 100));
            }

            const docMap = documents.map(doc => doc.text);
            docContext = docMap.join('\n\n');
            console.log("Context length:", docContext.length);

            // Create a more focused system message
            const systemMessage = {
                role: "system",
                content: `You are an AI assistant focused on providing information about The Church of Jesus Christ of Latter-day Saints, with special emphasis on the Elders Quorum.

                PRIMARY SOURCE - Church Handbook excerpts:
                ${docMap.map((text, i) => `[${i + 1}] ${text}`).join('\n\n')}

                SECONDARY SOURCE - Official Church Website (churchofjesuschrist.org):
                If you cannot find specific information in the handbook excerpts above, you may ONLY reference official information from churchofjesuschrist.org. 
                
                RESPONSE GUIDELINES:
                1. First, try to answer using the handbook excerpts provided above
                2. If the handbook excerpts don't contain the information, you may provide information from churchofjesuschrist.org
                3. Always cite your source:
                   - For handbook excerpts, cite as [Handbook Excerpt #]
                   - For church website, cite as [churchofjesuschrist.org]
                4. Do not make assumptions or add information from any other sources
                5. If the information cannot be found in either source, say "I don't have enough information to answer that question. Please refer to your local church leaders for more specific guidance."
                `
            };

            // Log context length for debugging
            console.log(`Context length: ${docContext.length} characters`);

            const userMessages = messages.map((msg: Message) => ({
                role: msg.role,
                content: msg.content
            }));

            const completion = await openai.chat.completions.create({
                model: "gemini-1.5-flash",
                messages: [systemMessage, ...userMessages],
                stream: true,
                temperature: 0.2,  // Slightly increased for better natural language
                max_tokens: 500
            });

            const encoder = new TextEncoder();
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        let accumulatedText = '';
                        for await (const chunk of completion) {
                            if (chunk.choices[0]?.delta?.content) {
                                const text = chunk.choices[0].delta.content;
                                accumulatedText += text;
                                
                                const data = {
                                    text: accumulatedText,
                                    done: false
                                };
                                
                                const encodedData = encoder.encode(
                                    `data: ${JSON.stringify(data)}\n\n`
                                );
                                controller.enqueue(encodedData);
                            }
                        }
                        const finalData = {
                            text: accumulatedText,
                            done: true
                        };
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify(finalData)}\n\n`)
                        );
                    } catch (error) {
                        console.error('Stream error:', error);
                        controller.error(error);
                    } finally {
                        controller.close();
                    }
                }
            });

            return new NextResponse(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                }
            });

        } catch (embeddingError) {
            console.error("Embedding Error:", embeddingError);
            if ((embeddingError as ErrorWithStatus).status === 429) {
                return NextResponse.json({
                    error: 'Rate limit exceeded. Please try again later.'
                }, { status: 429 });
            }
            return NextResponse.json({ error: 'Error creating embeddings' }, { status: 500 });
        }
    } catch (error) {
        console.error("Outer Error:", error);
        if ((error as ErrorWithStatus).status === 429) {
            return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

