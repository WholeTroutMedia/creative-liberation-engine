import express from 'express';

const app = express();
const PORT = process.env.COMET_PORT || 3002;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', agent: 'COMET' });
});

app.post('/api/task', async (req, res) => {
  const { task, context } = req.body;
  
  // TODO: Implement COMET task execution logic
  // For now, echo back the task
  
  res.json({
    success: true,
    message: `COMET received task: ${task}`,
    agent: 'COMET',
    filesChanged: []
  });
});

app.listen(PORT, () => {
  console.log(`👨‍🚀 COMET agent listening on http://localhost:${PORT}`);
});
