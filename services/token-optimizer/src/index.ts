import express from 'express';

const app = express();
const port = process.env.PORT || 5105;

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'token-optimizer' });
});

app.listen(port, () => {
    console.log('token-optimizer listening on port ' + port);
});
