
"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Center,
  Container,
  FileInput,
  Group,
  Textarea,
  Title,
  rem,
  Alert,
  Text,
  Paper,
} from "@mantine/core";

export default function Page() {
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [jsonResult, setJsonResult] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfjsLib, setPdfjsLib] = useState<typeof import('pdfjs-dist') | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load PDF.js dynamically on client side
  useEffect(() => {
    if (!isClient) return;
    
    const loadPdfJs = async () => {
      try {
        const pdfjs = await import('pdfjs-dist');
        
        // Set up worker with multiple fallback options
        try {
          // Try local public directory first
          pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
        } catch {
          try {
            // Fallback to unpkg CDN
            pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
          } catch {
            // Final fallback to jsdelivr CDN
            pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;
          }
        }
        
        setPdfjsLib(pdfjs);
        console.log('PDF.js loaded successfully');
      } catch (error) {
        console.error('Failed to load PDF.js:', error);
        setError('Failed to load PDF processing library. Please refresh the page.');
      }
    };

    loadPdfJs();
  }, [isClient]);

  // Extract text from PDF using PDF.js
  const extractTextFromPDF = async (file: File): Promise<string> => {
    if (!pdfjsLib) {
      throw new Error('PDF.js library not loaded yet. Please try again.');
    }

    try {
      console.log('Starting PDF text extraction...');
      const arrayBuffer = await file.arrayBuffer();
      console.log('PDF file loaded, size:', arrayBuffer.byteLength);
      
      const pdf = await pdfjsLib.getDocument({ 
        data: arrayBuffer,
        verbosity: 0 // Reduce console noise
      }).promise;
      
      console.log('PDF parsed successfully, pages:', pdf.numPages);
      
      let fullText = '';
      
      // Extract text from all pages
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        console.log(`Processing page ${pageNum}...`);
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Combine all text items with proper spacing
        const pageText = textContent.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => item.str || '')
          .filter((text: string) => text.trim().length > 0)
          .join(' ');
        
        if (pageText.trim()) {
          fullText += pageText + '\n\n';
        }
      }
      
      console.log('Text extraction completed. Length:', fullText.length);
      console.log('Extracted text preview:', fullText.substring(0, 500) + '...');
      
      if (!fullText.trim()) {
        throw new Error('No text content found in PDF. The PDF might be image-based or corrupted.');
      }
      
      return fullText.trim();
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('Invalid PDF')) {
          throw new Error('Invalid PDF file. Please ensure the file is not corrupted.');
        } else if (error.message.includes('worker')) {
          throw new Error('PDF worker failed to load. Please refresh the page and try again.');
        } else if (error.message.includes('fetch')) {
          throw new Error('Network error loading PDF worker. Please check your internet connection.');
        }
      }
      
      throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleFileChange = (file: File | null) => {
    setPdfFile(file);
    setJsonResult("");
    setError(null);
  };

  const processRecipe = async () => {
    if (!pdfFile) {
      setError("Please select a PDF file first");
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // Step 1: Extract text from PDF
      const recipeText = await extractTextFromPDF(pdfFile);
      
      if (!recipeText.trim()) {
        throw new Error("No text found in PDF");
      }

      // Step 2: Use API to extract structured JSON
      const response = await fetch('/api/extract-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipeText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to extract recipe data');
      }

      const extractedJson = await response.json();
      
      // Step 3: Display formatted JSON
      setJsonResult(JSON.stringify(extractedJson, null, 2));
    } catch (err: unknown) {
      console.error("Error processing recipe:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to process recipe";
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Don't render until we're on the client to prevent hydration mismatches
  if (!isClient) {
    return (
      <Box style={{ minHeight: "100vh" }}>
        <Box style={{ background: "#1f2937", color: "white", padding: "1rem 0" }}>
          <Container size={700}>
            <Group justify="space-between">
              <Group gap="xs">
                <Box
                  style={{
                    width: rem(10),
                    height: rem(32),
                    background:
                      "linear-gradient(180deg, rgba(16,185,129,1) 0%, rgba(20,184,166,1) 50%, rgba(59,130,246,1) 100%)",
                    borderRadius: 6,
                  }}
                />
                <Title order={3} fw={900} style={{ letterSpacing: "-0.5px", color: "white" }}>
                  Recipe Extraction Demo
                </Title>
              </Group>
              <Text c="dimmed" size="sm" style={{ color: "#9ca3af" }}>
                LangChain + Mantine • AI-Powered
              </Text>
            </Group>
          </Container>
        </Box>
        <Container size={700} py="xl">
          <Center py={28}>
            <Text>Loading...</Text>
          </Center>
        </Container>
      </Box>
    );
  }

  return (
    <Box style={{ minHeight: "100vh" }}>
      {/* Header */}
      <Box style={{ background: "#1f2937", color: "white", padding: "1rem 0" }}>
        <Container size={700}>
          <Group justify="space-between">
            <Group gap="xs">
              <Box
                style={{
                  width: rem(10),
                  height: rem(32),
                  background:
                    "linear-gradient(180deg, rgba(16,185,129,1) 0%, rgba(20,184,166,1) 50%, rgba(59,130,246,1) 100%)",
                  borderRadius: 6,
                }}
              />
              <Title order={3} fw={900} style={{ letterSpacing: "-0.5px", color: "white" }}>
                Recipe Extraction Demo
              </Title>
            </Group>
            <Text c="dimmed" size="sm" style={{ color: "#9ca3af" }}>
              LangChain + Mantine • AI-Powered
            </Text>
          </Group>
        </Container>
      </Box>

      {/* Main Content */}
      <Container size={700} py="xl">
        <Center py={28}>
          <Text c="dimmed" ta="center" size="lg">
            Upload a recipe PDF file and let AI extract structured JSON data with 
            recipe details, components, ingredients, and allergens information.
          </Text>
        </Center>

        <Paper withBorder shadow="md" radius="lg" p="lg" mb="lg">
          {/* File Upload Section */}
          <Group align="flex-end" justify="space-between" mb="md">
            <FileInput
              label="Upload Recipe PDF"
              placeholder="Select PDF file containing recipe"
              accept="application/pdf"
              value={pdfFile}
              onChange={handleFileChange}
              style={{ minWidth: 300 }}
            />
            <Button 
              onClick={processRecipe} 
              disabled={!pdfFile || isProcessing}
              loading={isProcessing}
              color="teal"
              size="md"
            >
              {isProcessing ? "Processing..." : "Extract Recipe"}
            </Button>
          </Group>

          {/* Error Display */}
          {error && (
            <Alert color="red" mb="md" title="Error">
              {error}
            </Alert>
          )}

          {/* JSON Result Display */}
          <Textarea
            label="Extracted Recipe JSON"
            placeholder="Upload a PDF file and click 'Extract Recipe' to see the structured JSON output here..."
            value={jsonResult}
            minRows={15}
            autosize
            readOnly
            styles={{ input: { fontFamily: 'Monaco, Consolas, monospace, sans-serif', fontSize: '14px' } }}
          />
        </Paper>

        {/* Instructions */}
        <Paper withBorder radius="md" p="md" bg="gray.0">
          <Title order={4} mb="sm">How to use:</Title>
          <Text size="sm" c="dimmed">
            1. <strong>Upload PDF:</strong> Select a PDF file containing a recipe<br/>
            2. <strong>AI Processing:</strong> Click &quot;Extract Recipe&quot; to analyze the content<br/>
            3. <strong>JSON Output:</strong> View the structured data with recipe name, chef, components, ingredients, and allergens
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}
