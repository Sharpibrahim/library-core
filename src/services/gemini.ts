export interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export const getGeminiStream = async function* (prompt: string, history: { role: string, content: string }[], filePart?: GeminiPart) {
  try {
    const response = await fetch('/api/ai/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt, history, filePart })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'Streaming failed');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No body reader available');
    }

    const decoder = new TextDecoder();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        yield { text };
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};

export const getGeminiResponse = async (prompt: string, context?: string) => {
  try {
    const res = await fetch('/api/ai/chat', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ message: prompt, context, history: [] })
    });
    if (!res.ok) throw new Error('AI Chat failed');
    const data = await res.json();
    return data.reply;
  } catch (error) {
    console.error("Gemini Proxy Error:", error);
    return "I'm experiencing some technical difficulties connecting to my AI brain. Please try again later!";
  }
};

export const generateCourseLevel = async (title: string, description: string): Promise<string> => {
  try {
    const res = await fetch('/api/ai/suggest-difficulty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });
    if (!res.ok) return 'Beginner';
    const data = await res.json();
    return data.level;
  } catch (e) {
    return 'Beginner';
  }
};

export const generateQuizQuestions = async (lessonTitle: string, context?: string): Promise<any[]> => {
  try {
    const res = await fetch('/api/ai/generate-quiz', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: lessonTitle, context })
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
};

export const generateFinalExam = async (courseTitle: string, courseDescription: string): Promise<any[]> => {
  try {
    const res = await fetch('/api/ai/generate-exam', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: courseTitle, description: courseDescription })
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
};

export const generateCourseImage = async (title: string, description: string): Promise<string | null> => {
  try {
    const res = await fetch('/api/ai/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });
    if (!res.ok) return `https://picsum.photos/seed/${encodeURIComponent(title)}/800/450`;
    const data = await res.json();
    return data.url;
  } catch (e) {
    return `https://picsum.photos/seed/${encodeURIComponent(title)}/800/450`;
  }
};

export const createChat = (resourceId?: string) => {
  return {
    sendMessage: async (msg: string) => {
      const reply = await getGeminiResponse(msg, resourceId ? `Currently reading resource ID: ${resourceId}` : undefined);
      return { text: reply };
    }
  };
};
