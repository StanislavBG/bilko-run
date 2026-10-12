import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { buildCatalog, findCatalogProject } from '../../src/data/projectCatalog.js';

/**
 * Public project catalog: exactly the cards an anonymous visitor sees on
 * /projects, as JSON (GET /api/projects) and as a read-only MCP endpoint
 * (POST /mcp, streamable HTTP, stateless). No auth, no write tools.
 * Contract: docs/host-contract.md → "Public project catalog".
 */

// Registry only changes on deploy; 5 minutes keeps consumers close to live.
const CACHE_CONTROL = 'public, max-age=300';

function json(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

export function buildCatalogMcpServer(): McpServer {
  const server = new McpServer({ name: 'bilko-run-projects', version: '1.0.0' });

  server.registerTool(
    'list_projects',
    {
      title: 'List public projects',
      description:
        'Returns every project publicly listed on https://bilko.run/projects, in page order, with how to talk about each (audience, talking_points). Same data as GET https://bilko.run/api/projects.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => json(buildCatalog()),
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get a public project',
      description:
        'Returns one publicly listed bilko.run project by slug. Non-public or unknown slugs return a not-found error.',
      inputSchema: { slug: z.string().min(1).max(64) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ slug }) => {
      const project = findCatalogProject(slug);
      if (!project) {
        return { isError: true, content: [{ type: 'text' as const, text: `Project "${slug}" not found.` }] };
      }
      return json(project);
    },
  );

  return server;
}

export function registerProjectCatalogRoutes(app: FastifyInstance): void {
  app.get('/api/projects', async (_req, reply) => {
    reply.header('Cache-Control', CACHE_CONTROL);
    return buildCatalog();
  });

  // Stateless streamable HTTP with plain JSON replies: a fresh server +
  // transport per request (the SDK's stateless pattern), no session state.
  // Uses the Web-standard transport, not the Node one: the Node transport
  // (via @hono/node-server) waits to drain a body Fastify already read, then
  // calls destroySoon() on the socket, which drops keep-alive connections.
  app.post('/mcp', async (req, reply) => {
    const server = buildCatalogMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') headers.set(k, v);
        else if (Array.isArray(v)) headers.set(k, v.join(', '));
      }
      const res = await transport.handleRequest(
        new Request(`http://localhost${req.url}`, { method: 'POST', headers }),
        { parsedBody: req.body },
      );
      reply.status(res.status);
      res.headers.forEach((v, k) => { reply.header(k, v); });
      return reply.send(await res.text());
    } finally {
      await transport.close();
      await server.close();
    }
  });

  // No server-initiated streams or sessions in stateless mode.
  const notAllowed = async (_req: FastifyRequest, reply: FastifyReply) =>
    reply.status(405).header('Allow', 'POST').send({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null });
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);
}
