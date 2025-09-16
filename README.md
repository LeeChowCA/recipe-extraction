# Recipe Extraction Tool

A Next.js application that extracts structured recipe data from PDF files using AI. Upload a recipe PDF and get back structured JSON with recipe details, components, ingredients (with proper nesting), and allergens information.

### Usage
1. Upload a PDF file containing a recipe
2. Click "Extract Recipe" 
3. View the structured JSON output with recipe details, components, and ingredients

## AI Tools & APIs Used

### OpenAI GPT-4o-mini
- **Why chosen**: Excellent cost-to-quality ratio for structured data extraction. We can definitely choose 5-nano, 5-mini or standard 5. but 4o-mini is actually enough.
- **Temperature**: 0.1 (so it's not very creative, but following our instruction)
- **Usage**: Processes extracted PDF text and converts to structured JSON

### LangChain
- **Components used**: 
  - `ChatPromptTemplate` for structured prompts. at this point, we don't need to use agent pattern, if we want to add more features into this app, then we might need to use agent pattern.
  - `StructuredOutputParser` with Zod schemas
  - OpenAI integration
- **Why chosen**: Robust framework for LLM applications with excellent schema validation

### PDF.js (pdfjs-dist)
- **Why chosen**: Client-side PDF processing, no server uploads needed
- **Usage**: Extracts raw text from PDF files for AI processing

### Zod Schema Validation
- **Why chosen**: TypeScript-first schema validation with transform capabilities
- **Usage**: Ensures consistent JSON structure and handles optional nested ingredients

## Architecture

```
Frontend (Next.js) → PDF.js → API Route → LangChain + OpenAI → Structured JSON
```

- **Client-side**: PDF upload and text extraction
- **Server-side**: AI processing (keeps API key secure)
- **Validation**: Zod schemas ensure data consistency

## Assumptions Made

1. **Nested Ingredients**: Handles ingredients with sub-components (e.g., spice mixtures)
2. **Missing Data**: Uses sensible defaults (empty strings for text, 0 for numbers)
3. **PDF Format**: Assumes text-based PDFs (not image-based scanned documents)

## Technical Stack

- **Frontend**: Next.js 15.5.3, TypeScript, Mantine UI v7
- **AI**: OpenAI GPT-4o-mini, LangChain
- **Validation**: Zod schemas with transforms
- **PDF Processing**: PDF.js (pdfjs-dist)
- **Styling**: Tailwind CSS with Mantine components


## Accuracy Assessment

### What Works Well ✅

- **Well-Structured Recipes**: Recipes with clear headings and organized sections parse with 90%+ accuracy. For example, it works well for teriyaki chicken
- **Ingredient Extraction**: Successfully extracts ingredient names and quantities
- **Component Classification**: Accurately categorizes ingredients into protein/starch/vegetable/sauce
- **Nested Ingredients**: Properly handles complex ingredient hierarchies (spice mixes, sauces)
- **Data Validation**: Zod schemas ensure consistent output structure

### Areas Needing Improvement 🔧

- **Measurement Ambiguity**: Casual language and approximations ("a pinch", "handful") need better interpretation. For example, we have 1 cup lime juice, 1/2 cup apple cider vinegar on the second recipe from chef's note, it's not clear. For some ingredients, we can consider to add some estimation logic

- **Smart Cooking Method Recognition**: AI should infer cooking methods from temperature ranges:
  - 325-450°F (163-232°C) → Oven cooking (baking for bread/cakes/pastries, roasting for meats/nuts)
  - Steaming → Use water evaporation temp (212°F/100°C) or N/A, this can be discussed
  - Add wok-fry temperature recognition, temperature for wok fry is actually important

- **Enhanced Prompt Engineering**: Tailor prompts with contextual information to help AI agents make better inferences about cooking methods and missing details

- **Intelligent Default Values**: 
  - Sauce preparation: Set appropriate default mixing times based on sauce type
  - Room temperature defaults for sauce preparation
  - Better handling of cook time = 0 scenarios

- **Vector Database Integration**: Store extracted recipes in vector DB with similarity search:
  - Alert users when similar dishes already exist
  - Show comparable recipes as references
  - Build knowledge base for improved extraction accuracy
  - Enable recipe recommendation system

- **Multi-Perspective Chain Processing**: For chef's informal notes, use LangChain to:
  - Create reasoning chains with multiple extraction attempts
  - Try different perspectives/interpretations
  - Set thinking limits before generating final answer, so it doesn't form an infinite loop

- **Backend involved**: Add another confirmation button, once users are satisfied with the JSON, can upload the JSON into DB, for most of well structured recipe, this would be very practical.


### Accuracy by Recipe Type

1. **Well-Structured Commercial Recipes**: 90-95% accuracy
2. **Chef's Informal Notes**: 75-85% accuracy  
3. **Complex Multi-Component Recipes**: 80-90% accuracy


## File Structure

```
src/
├── app/
│   ├── api/extract-recipe/route.ts    # Server-side AI processing
│   ├── page.tsx                       # Main UI component
│   ├── layout.tsx                     # App layout with Mantine provider
│   └── globals.css                    # Global styles
```



---
## 📋 Additional Reference Material  
*Hi Dave, you can skip this part, it's optional for your reference. The following sections contain setup instructions and basic features overview - provided for completeness.*

## Features

- **PDF Processing**: Client-side PDF text extraction using PDF.js
- **AI-Powered Extraction**: GPT-4o-mini for intelligent recipe parsing
- **Structured Output**: Zod schema validation ensures consistent JSON structure
- **Nested Ingredients**: Properly handles complex ingredient hierarchies (e.g., spice mixtures). I assumed we should handle the sub ingredients properly, like the herb crust mixture.
- **Component Classification**: Automatically categorizes into protein, starch, vegetable, and sauce components
- **Modern UI**: Built with Mantine v7 component library

## How to Run

### Prerequisites
- Node.js 18+ 
- OpenAI API key.

### Setup
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file in the root directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser. Take a look at your terminal, if 3000 is taken, you might need to run it in a different port.
