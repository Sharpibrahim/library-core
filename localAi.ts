import fs from 'fs';
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

let qaPipeline: any = null;
let transformers: any = null;

async function getPipeline() {
  if (!qaPipeline) {
    if (!transformers) {
      console.log('Loading @xenova/transformers...');
      transformers = await import('@xenova/transformers');
      // Set cache directory for transformers to /tmp for Cloud Run compatibility
      transformers.env.cacheDir = '/tmp/transformers-cache';
    }
    console.log('Initializing local QA pipeline (this may take a while on first run)...');
    qaPipeline = await transformers.pipeline('question-answering', 'Xenova/distilbert-base-cased-distilled-squad');
    console.log('Local QA pipeline initialized successfully.');
  }
  return qaPipeline;
}

export async function extractText(filePath: string) {
  try {
    if (filePath.endsWith('.pdf')) {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfModule = await getPdfParser();
      const pdfParser = typeof pdfModule === 'function' ? pdfModule : (pdfModule as any).default;
      if (typeof pdfParser !== 'function') {
        throw new Error('PDF parser is not a function. Check pdf-parse installation.');
      }
      const data = await (pdfParser as any)(dataBuffer);
      return data.text;
    } else {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.error('Text Extraction Error:', error);
    throw error;
  }
}

export async function getLocalAnswer(question: string, filePath: string) {
  try {
    // 1. Extract text from document
    const text = await extractText(filePath);

    // 2. Initialize pipeline if not already done
    const pipeline = await getPipeline();

    console.log(`Analyzing document for question: ${question}`);
    // 3. Get answer
    // We might need to chunk the text if it's too long, but for now let's try the first 2000 chars
    // as a simple heuristic or find the most relevant chunk.
    const context = text.substring(0, 5000); // Limit context for performance
    
    const result = await pipeline(question, context);
    
    return {
      answer: result.answer,
      score: result.score,
      source: 'Local AI (Offline)'
    };
  } catch (error) {
    console.error('Local AI Error:', error);
    throw error;
  }
}

export async function searchLibrary(question: string, documents: { title: string, filePath: string }[]) {
  try {
    const pipeline = await getPipeline();

    let bestAnswer = { answer: "I couldn't find a specific answer in the library documents.", score: 0, title: "" };

    // Limit to top 5 documents to avoid extreme slowness
    const searchDocs = documents.slice(0, 5);
    console.log(`Searching through ${searchDocs.length} documents...`);

    const pdfModule = await getPdfParser();
    const pdfParser = typeof pdfModule === 'function' ? pdfModule : (pdfModule as any).default;

    for (const doc of searchDocs) {
      try {
        if (!fs.existsSync(doc.filePath)) {
          console.warn(`File not found: ${doc.filePath}`);
          continue;
        }

        console.log(`Processing document: ${doc.title}`);
        let text = '';
        if (doc.filePath.endsWith('.pdf')) {
          const dataBuffer = fs.readFileSync(doc.filePath);
          const data = await (pdfParser as any)(dataBuffer);
          text = data.text;
        } else {
          text = fs.readFileSync(doc.filePath, 'utf-8');
        }

        const context = text.substring(0, 3000); // Smaller context for multi-doc speed
        const result = await pipeline(question, context);

        console.log(`Result for ${doc.title}: score=${result.score}`);

        if (result.score > bestAnswer.score) {
          bestAnswer = { 
            answer: result.answer, 
            score: result.score, 
            title: doc.title 
          };
        }
      } catch (err) {
        console.error(`Error processing ${doc.title}:`, err);
      }
    }

    if (bestAnswer.score < 0.01) {
      return { answer: "I searched the library documents but couldn't find a confident answer.", score: 0 };
    }

    return {
      answer: `According to "${bestAnswer.title}": ${bestAnswer.answer}`,
      score: bestAnswer.score,
      source: 'Local AI (Library Search)'
    };
  } catch (error) {
    console.error('Library Search Error:', error);
    throw error;
  }
}
