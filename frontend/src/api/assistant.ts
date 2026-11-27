import api from '../services/api';

export interface AssistantSource {
  n: number;
  id: string;
  type: 'place' | 'new_project' | 'hotel' | 'tour' | 'restaurant' | 'destination';
  title: string;
  section?: string;
  href?: string;
  mapUrl?: string;
  links?: string[];
}

export interface AssistantReply {
  answer: string;
  sources: AssistantSource[];
  mode: 'llm' | 'retrieval';
  answered: boolean;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export const askAssistant = async (message: string, history: ChatTurn[]): Promise<AssistantReply> =>
  (await api.post('/assistant/chat', { message, history: history.slice(-6) }, { timeout: 45000 })).data.data;
