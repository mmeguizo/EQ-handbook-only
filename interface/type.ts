export interface EnvVariables {
  GEMINI_API_KEY: string;
  ASTRA_DB_APPLICATION_TOKEN: string;
  ASTRA_DB_COLLECTION: string;
  ASTRA_DB_NAMESPACE: string;
  ASTRA_DB_API_ENDPOINT: string;
  MONGODB_DB_NAME: string;
  MONGODB_COLLECTION: string;
  MONGODB_URI: string;
}


export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}
