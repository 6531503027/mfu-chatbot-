export type Role = "user" | "bot";

export interface Message {
    id: string;
    role: Role;
    text: string;
    createdAt: string;
    nextTopics?: string[];
}

export interface ApiChatResponse {
    answer: string;
    next_topics?: string[];
}

export interface StoredConversation {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messages: Message[];
}
