import express from 'express';

const app = express();
const port = process.env.PORT || 5101;

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'agent-observability' });
});

app.listen(port, () => {
    console.log('agent-observability listening on port ' + port);
});
