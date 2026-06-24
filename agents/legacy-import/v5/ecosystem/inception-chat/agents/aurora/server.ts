import express from 'express';

const app = express();
const PORT = process.env.AURORA_PORT || 3003;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', agent: 'Aurora' });
});

app.post('/api/design', async (req, res) => {
  const { task, context } = req.body;
  
  // TODO: Implement Aurora design generation logic
  
  res.json({
    success: true,
    message: `Aurora received design request: ${task}`,
    agent: 'Aurora',
    filesChanged: []
  });
});

app.listen(PORT, () => {
  console.log(`🌈 Aurora agent listening on http://localhost:${PORT}`);
});
