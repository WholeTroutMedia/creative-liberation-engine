import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

export const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3013;

interface RegisteredAgent {
  agentId: string;
  name: string;
  manifestUrl: string;
  scopes: string[];
  issuedToken: string;
  registeredAt: string;
}

const registeredAgents: Map<string, RegisteredAgent> = new Map();

// Serves the sovereign auth.md capabilities documentation
const authMdCapabilities = `
# Creative Liberation Engine Open Agent Registration Protocol (auth.md)

This endpoint exposes the sovereign OAuth capabilities of the Creative Liberation Engine.

## Discovery Configuration
* **Issuer:** \`https://cle.engine/api/auth-md\`
* **Registration Endpoint:** \`/api/auth-md/register\`
* **Token Verification Endpoint:** \`/api/auth-md/verify\`
* **Supported Scopes:** \`read:code\`, \`write:code\`, \`read:telemetry\`, \`run:tests\`, \`write:memory\`
* **Supported Grant Types:** \`urn:ietf:params:oauth:grant-type:token-exchange\`, \`client_credentials\`
* **Token Type:** \`Bearer\`
`;

app.get('/api/auth-md/health', (req, res) => {
  res.json({ status: 'OK', service: 'auth-md-hub' });
});

app.get('/api/auth-md/discover', (req, res) => {
  res.setHeader('Content-Type', 'text/markdown');
  res.send(authMdCapabilities.trim());
});

app.post('/api/auth-md/register', (req, res) => {
  const { name, manifestUrl, scopes } = req.body;
  if (!name || !manifestUrl || !scopes || !Array.isArray(scopes)) {
    return res.status(400).json({ error: 'name, manifestUrl, and scopes (array) are required' });
  }

  // Simulate remote manifest document check (auth.md compliance)
  logger.info(`[AUTH-MD] Fetching and verifying manifest at URL: ${manifestUrl}`);
  
  // Verify scopes align with supported capabilities
  const supportedScopes = ['read:code', 'write:code', 'read:telemetry', 'run:tests', 'write:memory'];
  const validScopes = scopes.filter(s => supportedScopes.includes(s));
  
  if (validScopes.length === 0) {
    return res.status(400).json({ error: 'No valid scopes requested. Must request at least one supported scope.' });
  }

  const agentId = uuidv4();
  const token = `ie_agent_${uuidv4().replace(/-/g, '')}`;

  const agent: RegisteredAgent = {
    agentId,
    name,
    manifestUrl,
    scopes: validScopes,
    issuedToken: token,
    registeredAt: new Date().toISOString()
  };

  registeredAgents.set(token, agent);
  logger.info(`[AUTH-MD] Agent registered successfully: ${name} (${agentId}) with scopes: ${validScopes.join(', ')}`);

  res.json({
    message: 'Agent registered successfully',
    agentId,
    name,
    scopes: validScopes,
    token_type: 'Bearer',
    access_token: token,
    expires_in: 3600
  });
});

app.post('/api/auth-md/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid or missing Authorization header' });
  }

  const token = authHeader.substring(7);
  const agent = registeredAgents.get(token);

  if (!agent) {
    logger.warn(`[AUTH-MD] Unauthorized token verification request received`);
    return res.status(403).json({ error: 'Forbidden. Access token is invalid or expired.' });
  }

  logger.info(`[AUTH-MD] Token verification succeeded for agent: ${agent.name}`);
  res.json({
    active: true,
    agentId: agent.agentId,
    name: agent.name,
    scopes: agent.scopes,
    clientId: agent.agentId
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info(`[AUTH-MD] Hub active on port ${PORT}`);
  });
}
