// Chat domain types

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AgentSettings {
  daemonUrl: string;
  sourceKind: string;
  pullInterval: number;
  pullWaitMs: number;
}

export const DEFAULT_SETTINGS: AgentSettings = {
  daemonUrl: "http://127.0.0.1:20233",
  sourceKind: "obsidian",
  pullInterval: 50,
  pullWaitMs: 0,
};

export interface PluginSettings extends AgentSettings {
  defaultNoteFolder: string;
  autoCreateNote: boolean;
}

export const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  ...DEFAULT_SETTINGS,
  defaultNoteFolder: "Agent Chats",
  autoCreateNote: true,
};
