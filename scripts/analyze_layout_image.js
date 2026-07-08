import ZAI from 'z-ai-web-dev-sdk';
import fs from 'fs';
import path from 'path';

const IMAGE_PATH = '/home/z/my-project/upload/pasted_image_1783499515466.png';

async function main() {
  try {
    if (!fs.existsSync(IMAGE_PATH)) {
      console.error('Image not found:', IMAGE_PATH);
      process.exit(1);
    }

    const ext = path.extname(IMAGE_PATH).toLowerCase();
    const mimeMap = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
    };
    const mimeType = mimeMap[ext] || 'image/png';

    const imageBuffer = fs.readFileSync(IMAGE_PATH);
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const prompt = `You are a senior front-end engineer and QA reviewer specializing in responsive design and visual layout audits.

Please carefully analyze the provided screenshot and answer the following questions in detail. Be thorough and concrete — reference specific elements, positions (top/middle/bottom, left/right), colors, and text labels that you see.

1. VIEWPORT TYPE
   - Is this a mobile, tablet, or desktop view? What evidence supports this (aspect ratio, visible width, presence of sidebar, layout columns, etc.)?
   - Estimate the approximate viewport dimensions if possible.

2. PAGE / SECTION IDENTIFICATION
   - What page, screen, or section is being shown (e.g., login page, dashboard, product list, settings, etc.)?
   - Describe the purpose of the page based on visible headings, labels, and content.

3. LAYOUT & RESPONSIVE ISSUES — be very specific
   - Horizontal overflow / horizontal scrollbar?
   - Content cut off at any edge (top, bottom, left, right)?
   - Elements overlapping each other?
   - Broken alignment (left/right/center justification off)?
   - Text wrapping issues, truncated text with ellipsis that hides meaning?
   - Buttons or inputs with wrong width (too wide, too narrow, full-width when they shouldn't be)?
   - Whitespace / spacing problems (too much, too little, inconsistent)?
   - Z-index / stacking issues (modal behind content, dropdown hidden)?
   - Images distorted, stretched, or wrong aspect ratio?
   - Font size issues (too large, too small, inconsistent scale)?
   - Sticky/fixed elements covering content?
   - Grid/flex layout breaking (items not wrapping, wrong number of columns)?
   - Touch target size issues (buttons too small for mobile)?
   - Any visible console errors, broken images (alt text shown), or placeholder text?

4. ELEMENT-BY-ELEMENT INVENTORY
   - List each distinct visible UI element (header, nav, button, card, input, image, footer, modal, etc.).
   - For each element, note: its position, its apparent purpose, and ANY problem you can observe (or explicitly state "no issue" if it looks fine).

Be honest and precise. If you are uncertain about something, say so. Do not invent issues that are not visible. Format your answer with clear numbered sections matching the questions above.`;

    const zai = await ZAI.create();

    const response = await zai.chat.completions.createVision({
      model: 'glm-4.6v',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      thinking: { type: 'disabled' },
    });

    const reply = response.choices?.[0]?.message?.content;
    console.log('=== VLM ANALYSIS RESULT ===\n');
    console.log(reply ?? JSON.stringify(response, null, 2));
    console.log('\n=== END OF ANALYSIS ===');
  } catch (err) {
    console.error('Vision chat failed:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
