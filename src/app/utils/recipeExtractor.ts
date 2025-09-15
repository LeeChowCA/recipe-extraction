// app/utils/extractRecipe.ts
import { z } from "zod";
import { StructuredOutputParser } from "langchain/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";

// Zod schema to strongly shape the JSON
const RecipeSchema = z.object({
    recipe_name: z.string().min(1).describe("Name of the recipe."),
    chef: z.string().default(""),
    yield_count: z.number().nonnegative(),
    allergens: z.array(z.string()),
    components: z.array(
        z.object({
            name: z.string().min(1),
            type: z.enum(["protein", "starch", "vegetable", "sauce"]),
            prep_time_minutes: z.number().int().nonnegative(),
            cook_time_minutes: z.number().int().nonnegative(),
            cook_temp_fahrenheit: z.number().int().nonnegative().optional().default(0),
            cook_method: z.string().default(""),
            portion_weight_grams: z.number().nonnegative(),
            ingredients: z.array(
                z.object({
                    name: z.string(),
                    amount_per_portion_grams: z.number().nonnegative(),
                })
            ),
        })
    ),
});

const parser = StructuredOutputParser.fromZodSchema(RecipeSchema);

const systemPrompt = `
You are an expert culinary data extraction specialist. You must analyze the PROVIDED RECIPE TEXT and extract ALL information from IT ONLY into valid, complete JSON with PROPER NESTED INGREDIENT STRUCTURE.

🚨 CRITICAL: PROCESS ONLY THE PROVIDED RECIPE TEXT - DO NOT USE EXAMPLES OR TEMPLATES! 🚨

EXTRACTION RULES:
- EXTRACT data from the actual recipe text provided by the user
- DO NOT copy example names like "Mediterranean Herb-Crusted Salmon"
- USE the actual recipe name, ingredients, and details from the PROVIDED TEXT
- Process the REAL content, not templates or examples

CRITICAL JSON RULES:
- NEVER return null values - use empty strings "" or 0 for missing data
- ALWAYS return valid JSON structure matching the exact schema
- ALL string fields must be actual strings, not null
- ALL number fields must be actual numbers, not null
- ALWAYS include all 4 component types: protein, starch, vegetable, sauce
- HANDLE NESTED INGREDIENTS PROPERLY - do not flatten them!

NESTED INGREDIENT HANDLING:
When you see ingredient structures like:
"Herb crust mixture: 20g
  ○ Panko breadcrumbs: 12g
  ○ Parsley, dried: 2g  
  ○ Dill, dried: 2g
  ○ Lemon zest: 1g
  ○ Olive oil: 3g"

Extract as:
{{
  "name": "Herb crust mixture",
  "amount_per_portion_grams": 20,
  "sub_ingredients": [
    {{"name": "Panko breadcrumbs", "amount_per_portion_grams": 12}},
    {{"name": "Parsley, dried", "amount_per_portion_grams": 2}},
    {{"name": "Dill, dried", "amount_per_portion_grams": 2}},
    {{"name": "Lemon zest", "amount_per_portion_grams": 1}},
    {{"name": "Olive oil", "amount_per_portion_grams": 3}}
  ]
}}

EXACT SCHEMA STRUCTURE REQUIRED:
{{
  "recipe_name": "EXTRACT FROM PDF - Use actual recipe name",
  "chef": "EXTRACT FROM PDF - Use actual chef name or empty string",
  "yield_count": 0, // EXTRACT FROM PDF - Use actual yield count
  "allergens": [], // EXTRACT FROM PDF - Use actual allergens found
  "components": [
    {{
      "name": "EXTRACT FROM PDF - Component name",
      "type": "protein", // or starch, vegetable, sauce
      "prep_time_minutes": 0, // EXTRACT FROM PDF
      "cook_time_minutes": 0, // EXTRACT FROM PDF  
      "cook_temp_fahrenheit": 0, // EXTRACT FROM PDF
      "cook_method": "EXTRACT FROM PDF - Method description",
      "portion_weight_grams": 0, // EXTRACT FROM PDF
      "ingredients": [
        {{
          "name": "EXTRACT FROM PDF - Simple ingredient name",
          "amount_per_portion_grams": 0 // EXTRACT FROM PDF
        }},
        {{
          "name": "EXTRACT FROM PDF - Complex ingredient name", 
          "amount_per_portion_grams": 0, // EXTRACT FROM PDF
          "sub_ingredients": [
            {{"name": "EXTRACT FROM PDF - Sub ingredient", "amount_per_portion_grams": 0}},
            {{"name": "EXTRACT FROM PDF - Sub ingredient", "amount_per_portion_grams": 0}}
          ]
        }}
      ]
    }}
  ]
}}

DO NOT extract sub-ingredients as separate top-level ingredients!

RECIPE TYPES YOU HANDLE:
1. WELL-STRUCTURED: Clear sections, precise measurements, organized components
2. CHEF'S NOTES: Informal language, conversational tone, approximate quantities  
3. COMPLEX MULTI-COMPONENT: Multiple detailed components with sub-ingredients

EXTRACTION STRATEGY:

📋 RECIPE BASICS:
- Extract FULL recipe name from the PROVIDED TEXT (not examples!)
- Find chef name (patterns: "Chef [Name]", or use "" if none)
- Get yield/portions (look for "120 portions", "Production Yield: 120", ranges like "80-100" → use 90)

🍽️ COMPONENT IDENTIFICATION - ALWAYS FIND ALL 4:

PROTEIN (meat, fish, poultry):
- Look for: "PROTEIN:", protein descriptions, meat/fish/poultry items
- Extract: cooking times, temperatures, internal temps
- Parse ingredient lists with PROPER HIERARCHY:
  * Main protein ingredient: amount (main ingredient)
  * Seasoning mixture: amount (main ingredient with sub-ingredients)
    ○ Spice 1: amount (sub-ingredient)
    ○ Spice 2: amount (sub-ingredient)  
    ○ etc.
  * Simple seasonings: amount (main ingredient)
- Method: full cooking instructions

STARCH (rice, pasta, grains, bread):
- Look for: "STARCH:", "Quinoa Pilaf", grain/rice descriptions  
- Extract: cooking details (18 min simmer, 5 min rest)
- Parse all starch ingredients with proper nesting
- Method: preparation instructions

VEGETABLE (vegetables, legumes, plant sides):
- Look for: "VEGETABLE:", "Roasted Mediterranean Blend", vegetable descriptions
- Extract: cooking info (22 min @ 400°F)
- Parse vegetable ingredient lists with nesting
- Method: preparation technique

SAUCE (sauces, dressings, accompaniments):
- Look for: "SAUCE:", "Tzatziki", sauce descriptions
- Extract: prep details (rest 2hr minimum)  
- Parse sauce ingredients with proper nesting
- Method: preparation steps

📏 NESTED INGREDIENT PARSING RULES:
CRITICAL: Understand ingredient hierarchy correctly!

SAME LEVEL INGREDIENTS (main ingredients list):
- Main protein item: amount
- Seasoning mixture: amount  
- Simple seasoning 1: amount
- Simple seasoning 2: amount

SUB-INGREDIENTS (indented under parent):
Seasoning mixture: amount
  ○ Sub-ingredient 1: amount  ← These are SUB-INGREDIENTS of parent mixture
  ○ Sub-ingredient 2: amount
  ○ Sub-ingredient 3: amount
  ○ Sub-ingredient 4: amount
  ○ Sub-ingredient 5: amount

CORRECT PARSING:
- Items at same indentation level = separate main ingredients
- Items with bullet points/circles under a parent = sub_ingredients array

DO NOT extract sub-ingredients as separate top-level ingredients!

WEIGHT CONVERSIONS:
- Extract exact measurements when available
- Convert to grams: "4 oz" → 113, "1 lb" → 454, "2 cups flour" → 240
- For portions: divide total by yield
- Estimates for missing data:
  - Protein portions: 110-170g
  - Starch portions: 80-120g  
  - Vegetable portions: 60-100g
  - Sauce portions: 30-60g
- Weights: "110g" → 110, "30g" → 30
- Estimate missing weights reasonably

CRITICAL RULES:
- Return COMPLETE JSON with no null values
- Extract EVERY ingredient mentioned with proper nesting
- Use empty string "" for missing text fields
- Use 0 for missing numeric fields
- Always return all 4 component types
- MAINTAIN hierarchical ingredient structure from source
- Only include sub_ingredients property when ingredient has sub-components
- Be thorough and extract all available data
`;

const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["human", `You must extract complete recipe data and return ONLY valid JSON with no null values and PROPER NESTED INGREDIENTS.

    Schema format:
    {format_instructions}

    Recipe text to extract from:
    {recipe_text}

    Return ONLY the complete JSON object with EXACT field names and proper ingredient nesting:`],
]);

export async function extractRecipeJson(recipeText: string): Promise<z.infer<typeof RecipeSchema>> {
    const model = new ChatOpenAI({
        modelName: "gpt-4o-mini", // good cost/quality for structure
        temperature: 0,
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY, // Browser-use key
    });

    const chain = prompt.pipe(model).pipe(parser);
    const result = await chain.invoke({ 
        recipe_text: recipeText,
        format_instructions: parser.getFormatInstructions()
    });

    return result;
}
