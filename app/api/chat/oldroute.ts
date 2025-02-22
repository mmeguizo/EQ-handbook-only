import OpenAI from "openai";
import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { EnvVariables } from "@/interface/type";

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

export async function POST(req: Request) {
    try {
        const { messages } = await req.json();
        const lastMessage = messages[messages.length - 1]?.content;

        let docContext = "";
        try {
            const embedding = await openai.embeddings.create({
                model: "text-embedding-004",
                input: lastMessage,
            });

            // MongoDB vector search query
            const documents = await collection.aggregate([
                {
                    $vectorSearch: {
                        queryVector: embedding.data[0].embedding,
                        path: "embedding",
                        numCandidates: 20,
                        limit: 10,
                        index: "vector_index",
                    }
                },
                {
                    $project: {
                        text: 1,
                        score: { $meta: "vectorSearchScore" }
                    }
                }
            ]).toArray();

            const docMap = documents?.map(doc => doc.text);
            docContext = JSON.stringify(docMap);

            const template = {
                role: "system",
                content: `...${docContext}...${lastMessage}...`
            };

            const completion = await openai.chat.completions.create({
                model: "gemini-1.5-flash",
                messages: [template, ...messages],
                stream: true,
            });

            return new NextResponse(
                new ReadableStream({
                    async pull(controller) {
                        const textEncoder = new TextEncoder();
                        try {
                            for await (const chunk of completion) {
                                if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                                    const text = chunk.choices[0].delta.content;
                                    // Format as SSE data
                                    const formattedData = `data: ${JSON.stringify({ content: text })}\n\n`;
                                    const encoded = textEncoder.encode(formattedData);
                                    controller.enqueue(encoded);
                                }
                            }
                        } catch (error) {
                            console.error('Stream error:', error);
                        } finally {
                            controller.close();
                        }
                    },
                }),
                {
                    headers: {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                    },
                }
            );
        } catch (embeddingError) {
            console.error("Embedding Error:", embeddingError);

            if ((embeddingError as any).status === 429) {
                return NextResponse.json({
                    error: 'It seems we have hit our usage limit for now. Please wait a moment before trying again. Thank you for your patience!'
                }, { status: 429 });
            }

            return NextResponse.json({ error: 'Error creating embeddings' }, { status: 500 });
        }

    } catch (error) {
        console.error("Outer Error:", error);

        if ((error as any).status === 429) {
            return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 });
        }

        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

