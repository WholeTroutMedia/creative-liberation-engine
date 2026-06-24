#!/usr/bin/env node
/**
 * Design Ingest MCP Server
 *
 * Brokers the Design Ingestion Pipeline: Canvas, Mobbin, and Vision based RAG.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CanvasExtractor } from './framer.js';
import { MobbinExtractor } from './mobbin.js';
import { VisionExtractor } from './vision.js';
import path from 'path';
import fs from 'fs';

const canvasExtractor = new CanvasExtractor();
const mobbinExtractor = new MobbinExtractor();
const visionExtractor = new VisionExtractor();

const server = new Server(
  { name: 'cle-design-ingest', version: '1.0.0-genesis' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'design.extract_canvas',
      description: 'Extracts living parameterized React code from a live visual canvas component URL using unframer and applies style harmonization + layout constraints auditing.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The visual canvas component URL' },
          targetComponent: { type: 'string', description: 'The specific component name to extract' }
        },
        required: ['url', 'targetComponent']
      },
    },
    {
      name: 'design.extract_framer',
      description: 'Legacy alias for design.extract_canvas. Extracts component from visual canvas URL.',
      inputSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The visual canvas component URL' },
          targetComponent: { type: 'string', description: 'The specific component name to extract' }
        },
        required: ['url', 'targetComponent']
      },
    },
    {
      name: 'design.extract_mobbin',
      description: 'Pulls structured pattern hierarchies and spacing metrics from the Mobbin API.',
      inputSchema: {
          type: 'object',
          properties: {
              patternCategory: { type: 'string', description: 'E.g., "onboarding", "paywall"' }
          },
          required: ['patternCategory']
      }
    },
    {
      name: 'design.vision_reconstruct',
      description: 'Navigates Comet to a target URL, analyzes visual hierarchy natively, and stubs out skeletal React code.',
      inputSchema: {
          type: 'object',
          properties: {
              url: { type: 'string', description: 'Target URL to reverse engineer' }
          },
          required: ['url']
      }
    }
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'design.extract_canvas':
    case 'design.extract_framer': {
      const { url, targetComponent } = args as Record<string, string>;
      
      // Determine output directory - check if apps/engine-room exists
      let outDir = path.resolve(process.cwd(), '..', '..', 'apps', 'engine-room', 'src', 'components', 'canvas', targetComponent);
      if (!fs.existsSync(path.dirname(path.dirname(outDir)))) {
          outDir = path.resolve(process.cwd(), '..', '..', 'apps', 'console', 'src', 'components', 'canvas', targetComponent);
      }
      
      try {
          const result = await canvasExtractor.extract(url, outDir, targetComponent);
          
          if (result.success) {
               return {
                  content: [{
                      type: 'text',
                      text: JSON.stringify({
                          status: 'extraction_complete',
                          vector: 'canvas',
                          url,
                          targetComponent,
                          savedTo: result.outPath,
                          message: 'Component successfully extracted, style-harmonized, and registered in the Canvas Ingestion Library.'
                      })
                  }]
              };
          } else {
               return {
                  content: [{ type: 'text', text: `Extraction failed: ${result.error}` }],
                  isError: true
              };
          }
      } catch (err: any) {
            return {
                content: [{ type: 'text', text: `Extraction error: ${err.message}` }],
                isError: true
            };
      }
    }
    case 'design.extract_mobbin': {
        const { patternCategory } = args as Record<string, string>;
        try {
            const result = await mobbinExtractor.extract(patternCategory);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        status: result.success ? 'extraction_complete' : 'extraction_failed',
                        vector: 'mobbin',
                        patternCategory,
                        patterns: result.patterns,
                        error: result.error,
                        message: 'Mobbin pattern library queried.'
                    })
                }]
            };
        } catch (err: any) {
            return { content: [{ type: 'text', text: `Extraction error: ${err.message}` }], isError: true };
        }
    }
    case 'design.vision_reconstruct': {
        const { url } = args as Record<string, string>;
        const componentName = url.replace(/[^a-zA-Z0-9]/g, '');
        const outDir = path.resolve(process.cwd(), '..', '..', 'apps', 'console', 'src', 'components', 'vision', componentName);
        
        try {
            const result = await visionExtractor.reconstruct(url, outDir);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        status: result.success ? 'extraction_complete' : 'extraction_failed',
                        vector: 'vision',
                        url,
                        savedTo: result.outPath,
                        error: result.error,
                        message: 'Comet session initiated for spatial/visual capture. Skeletal React code generated.'
                    })
                }]
            };
        } catch (err: any) {
            return { content: [{ type: 'text', text: `Extraction error: ${err.message}` }], isError: true };
        }
    }
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[DESIGN-INGEST] MCP Bridge online');
}

main().catch(console.error);
