import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

let pdf: any = null;

async function getPdfParser() {
  if (!pdf) {
    console.log('Loading pdf-parse...');
    const require = createRequire(import.meta.url);
    pdf = require('pdf-parse');
  }
  return pdf;
}

const stopWords = new Set([
  "the", "a", "an", "is", "are", "was", "were", "of", "and", "in", "to", "for", 
  "with", "about", "on", "what", "how", "why", "who", "where", "can", "you", 
  "tell", "me", "this", "that", "these", "those", "or", "but", "not", "by", 
  "from", "at", "it", "its", "their", "our", "your", "my", "we", "he", "she", 
  "they", "i", "be", "been", "have", "has", "had", "do", "does", "did", "will", 
  "would", "should", "could"
]);

function getSemanticChunks(text: string): string[] {
  // Split by double newline to get natural paragraphs
  const roughParagraphs = text.split(/\n\s*\n+/).map(p => p.trim()).filter(p => p.length > 5);
  
  if (roughParagraphs.length > 5) {
    return roughParagraphs;
  }
  
  // Fallback if there are no double-newlines (e.g. text is formatted line-by-line)
  // We cluster sequential lines together into solid paragraph-length chunks
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  
  for (const line of lines) {
    currentChunk.push(line);
    // Boundary of ~450 characters or ending a sentence
    if (currentChunk.join(' ').length > 450 || line.endsWith('.')) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [];
    }
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }
  return chunks.filter(c => c.length > 20);
}

function getScore(chunk: string, queryWords: string[], rawQuery: string): number {
  const normalizedChunk = chunk.toLowerCase().replace(/[^\w\s]/g, ' ');
  const chunkWords = normalizedChunk.split(/\s+/).filter(Boolean);
  
  let score = 0;
  
  // 1. Single keyword overlap with sequence weights
  for (const word of queryWords) {
    const count = chunkWords.filter(w => w === word).length;
    score += count * 2.0; // Primary term frequency weight
    
    // Tiny partial matching boost (e.g. "limit" inside "unlimited")
    if (normalizedChunk.includes(word)) {
      score += 0.5;
    }
  }
  
  // 2. Multi-word phrases matching (Bi-grams)
  const normalizedQuery = rawQuery.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
  const queryTerms = normalizedQuery.split(/\s+/).filter(w => !stopWords.has(w));
  
  if (queryTerms.length >= 2) {
    for (let i = 0; i < queryTerms.length - 1; i++) {
      const pair = `${queryTerms[i]} ${queryTerms[i+1]}`;
      if (normalizedChunk.includes(pair)) {
        score += 15.0; // Heavy reward for matching sequential terms
      }
    }
  }
  
  // 3. Exact matching full phrases (Tri-grams or larger)
  if (queryTerms.length >= 3) {
    const fullPhrase = queryTerms.join(' ');
    if (normalizedChunk.includes(fullPhrase)) {
      score += 35.0; // Extreme matches get top priority
    }
  }
  
  // Normalize score slightly by length penalty to avoid super massive paragraphs dominating matches
  if (chunk.length > 1000) {
    score = score * (1000 / chunk.length);
  }
  
  return score;
}

export async function extractText(filePath: string): Promise<string> {
  try {
    if (filePath.endsWith('.pdf')) {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfModule = await getPdfParser();
      const pdfParser = typeof pdfModule === 'function' ? pdfModule : (pdfModule as any).default;
      if (typeof pdfParser !== 'function') {
        throw new Error('PDF parser is not a function. Check pdf-parse installation.');
      }
      const data = await pdfParser(dataBuffer);
      return data.text || '';
    } else {
      return fs.readFileSync(filePath, 'utf-8') || '';
    }
  } catch (error) {
    console.error('Text Extraction Error:', error);
    throw error;
  }
}

export async function getLocalAnswer(question: string, filePath: string) {
  try {
    const text = await extractText(filePath);
    if (!text || text.trim().length === 0) {
      return {
        answer: "The selected reading document seems to have no extractable text.",
        score: 0,
        source: 'Local AI (Offline / Error)'
      };
    }

    const chunks = getSemanticChunks(text);
    
    // Clean and stem queries
    const queryWords = question
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));
      
    let bestChunk = '';
    let maxScore = -1;
    
    for (const chunk of chunks) {
      const score = getScore(chunk, queryWords, question);
      if (score > maxScore) {
        maxScore = score;
        bestChunk = chunk;
      }
    }
    
    if (maxScore <= 0 || !bestChunk) {
      // Clean fallback displaying opening document section
      return {
        answer: `I analyzed the document but did not spot any matching key terms for your query. Here is a preview of the opening passage:\n\n${text.substring(0, 900)}...`,
        score: 0,
        source: 'Local AI (Offline / Scan)'
      };
    }
    
    // Clean matching word highlights
    let highlightedChunk = bestChunk;
    const keyMatchWords = queryWords.slice(0, 3);
    for (const word of keyMatchWords) {
      if (word.length > 2) {
        const regex = new RegExp(`\\b(${word}\\w*)\\b`, 'gi');
        highlightedChunk = highlightedChunk.replace(regex, '**$1**');
        break; // limit to first matches to keep markdown clean
      }
    }

    const answer = `Based on my offline analysis of the document, here is the most relevant section found matching your query:

> ${highlightedChunk}

*This response was generated in local offline reading mode.*`;

    return {
      answer,
      score: maxScore,
      source: 'Local AI (Offline)'
    };
  } catch (error) {
    console.error('Local AI Error:', error);
    return {
      answer: "Pardon me, an error occurred while searching this document offline. Make sure the file has readable text passages and try again.",
      score: 0,
      source: 'Local AI (Offline / Error)'
    };
  }
}

export async function searchLibrary(question: string, documents: { title: string, filePath: string }[]) {
  try {
    let bestAnswer = { answer: "", score: 0, title: "" };
    
    const queryWords = question
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !stopWords.has(w));

    // Search top 15 library items
    const searchDocs = documents.slice(0, 15);
    console.log(`[LOCAL SEARCH] Indexing catalog search of ${searchDocs.length} items...`);

    for (const doc of searchDocs) {
      try {
        if (!fs.existsSync(doc.filePath)) continue;
        
        const text = await extractText(doc.filePath);
        if (!text || text.trim().length === 0) continue;
        
        const chunks = getSemanticChunks(text);
        for (const chunk of chunks) {
          const score = getScore(chunk, queryWords, question);
          if (score > bestAnswer.score) {
            bestAnswer = {
              answer: chunk,
              score,
              title: doc.title
            };
          }
        }
      } catch (err) {
        console.error(`[LOCAL SEARCH] Error processing ${doc.title}:`, err);
      }
    }

    if (bestAnswer.score <= 0 || !bestAnswer.answer) {
      return {
        answer: "I scanned the offline Library archives but couldn't locate any direct topic matches. Please try search words or check your Gemini API key in **Settings > Secrets**.",
        score: 0
      };
    }

    const formattedAnswer = `Based on the library reference document **"${bestAnswer.title}"**, here is the most relevant passage found:

> ${bestAnswer.answer}

*Retrieved via local indexing of stored catalog files.*`;

    return {
      answer: formattedAnswer,
      score: bestAnswer.score,
      source: `Offline Archive (${bestAnswer.title})`
    };
  } catch (error) {
    console.error('Library Local Search Error:', error);
    return {
      answer: "An error occurred during local library offline search indexing.",
      score: 0
    };
  }
}
