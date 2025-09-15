// app/api/extract-recipe/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";

// Enhanced Zod schema for robust recipe extraction with nested ingredients
const IngredientSchema = z.object({
    name: z.string().describe("Ingredient name"),
    amount_per_portion_grams: z.number().nonnegative().describe("Amount per portion in grams"),
    sub_ingredients: z.array(z.object({
        name: z.string().describe("Sub-ingredient name"),
        amount_per_portion_grams: z.number().nonnegative().describe("Amount per portion in grams"),
    })).optional().describe("Sub-ingredients if this is a mixture (like herb crust mixture). OMIT this property entirely if no sub-ingredients exist.")
}).transform((data) => {
    // Remove sub_ingredients property if it's empty or undefined
    const result: { 
        name: string; 
        amount_per_portion_grams: number; 
        sub_ingredients?: Array<{name: string; amount_per_portion_grams: number}> 
    } = {
        name: data.name,
        amount_per_portion_grams: data.amount_per_portion_grams
    };
    
    // Only add sub_ingredients if it exists and has items
    if (data.sub_ingredients && data.sub_ingredients.length > 0) {
        result.sub_ingredients = data.sub_ingredients;
    }
    
    return result;
});

const RecipeSchema = z.object({
    recipe_name: z.string().describe("Full name of the recipe"),
    chef: z.string().describe("Chef name if mentioned, empty string if not found"),
    yield_count: z.number().nonnegative().describe("Number of portions this recipe makes"),
    allergens: z.array(z.string()).describe("List of allergens found in the recipe"),
    components: z.array(
        z.object({
            name: z.string().describe("Component name like 'Braised Beef' or 'Roasted Vegetables'"),
            type: z.enum(["protein", "starch", "vegetable", "sauce"]).describe("Component category"),
            prep_time_minutes: z.number().int().nonnegative().describe("Preparation time in minutes"),
            cook_time_minutes: z.number().int().nonnegative().describe("Cooking time in minutes"),
            cook_temp_fahrenheit: z.number().int().nonnegative().describe("Cooking temperature in Fahrenheit, 0 if not specified"),
            cook_method: z.string().describe("Cooking method description"),
            portion_weight_grams: z.number().nonnegative().describe("Final portion weight in grams"),
            ingredients: z.array(IngredientSchema).describe("List of all ingredients for this component with proper nesting"),
        })
    ).describe("All recipe components (protein, starch, vegetable, sauce)"),
}).transform((data) => {
    // Ensure no null values and provide defaults
    return {
        ...data,
        recipe_name: data.recipe_name || "Unknown Recipe",
        chef: data.chef || "",
        yield_count: data.yield_count || 0,
        allergens: data.allergens || [],
        components: (data.components || []).map(component => ({
            ...component,
            name: component.name || "Unknown Component",
            type: component.type || "protein",
            prep_time_minutes: component.prep_time_minutes || 0,
            cook_time_minutes: component.cook_time_minutes || 0,
            cook_temp_fahrenheit: component.cook_temp_fahrenheit || 0,
            cook_method: component.cook_method || "",
            portion_weight_grams: component.portion_weight_grams || 0,
            ingredients: component.ingredients || []
        }))
    };
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
- NEVER return null values - use empty strings "" or N/A for missing data
- ALWAYS return valid JSON structure matching the exact schema
- ALL string fields must be actual strings, not null
- ALL number fields must be actual numbers, not null
- ALWAYS include all 4 component types: protein, starch, vegetable, sauce
- HANDLE NESTED INGREDIENTS PROPERLY - do not flatten them!
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

export async function POST(request: NextRequest) {
    try {
        const { recipeText } = await request.json();

        if (!recipeText || typeof recipeText !== 'string') {
            return NextResponse.json(
                { error: 'Recipe text is required' },
                { status: 400 }
            );
        }

        const model = new ChatOpenAI({
            modelName: "gpt-4o-mini",
            temperature: 0.1,
            apiKey: process.env.OPENAI_API_KEY, // Server-side environment variable
        });

        const chain = prompt.pipe(model).pipe(parser);
        const result = await chain.invoke({ 
            recipe_text: recipeText,
            format_instructions: parser.getFormatInstructions()
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('Recipe extraction error:', error);
        return NextResponse.json(
            { error: 'Failed to extract recipe data' },
            { status: 500 }
        );
    }
}
