import { DataAPIClient } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";

import "dotenv/config";
import { EnvVariables } from "../interface/type";
import { conference_urls } from "../data/urls";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const {
  GEMINI_API_KEY,
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_API_ENDPOINT,
} = process.env as unknown as EnvVariables;

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const model = genAI.getGenerativeModel({
  model: "text-embedding-004",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, {
  namespace: ASTRA_DB_NAMESPACE,
});

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async (
  similarity: SimilarityMetric = "dot_product"
) => {
  const results = await db.createCollection(ASTRA_DB_COLLECTION, {
    vector: {
      dimension: 768,
      metric: similarity,
    },
  });

  console.log(results);
};

const loadSampleData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION);

  for (const url of conference_urls) {
    const content = await scrapePage(url);
    const chunks = await splitter.splitText(content);
    for await (const chunk of chunks) {
      const embedding = await model.embedContent(chunk);
      const vector = embedding.embedding.values;
      // console.log({ embedding: embedding.embedding.values });
      const results = await collection.insertOne({
        $vector: vector,
        text: chunk,
      });
      console.log(results);
    }
  }
};

const scrapePage = async (url: string) => {
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: { headless: true },
    gotoOptions: { waitUntil: "domcontentloaded" },
    evaluate: async (page, browser) => {
      const results = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return results;
    },
  });
  return (await loader.scrape())?.replace(/<[^>]*>?/gm, "");
};

createCollection().then(() => loadSampleData());
