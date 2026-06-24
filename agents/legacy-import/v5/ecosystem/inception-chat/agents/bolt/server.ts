import express from 'express';

const app = express();
const PORT = process.env.BOLT_PORT || 3004;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', agent: 'BOLT' });
});

app.post('/api/build', async (req, res) => {
  const { task, context } = req.body;
  
  // TODO: Implement BOLT build logic
  
  res.json({
    success: true,
    message: `BOLT received build request: ${task}`,
    agent: 'BOLT',
    filesChanged: []
  });
});

app.listen(PORT, () => {
  console.log(`⚡ BOLT agent listening on http://localhost:${PORT}`);
});
