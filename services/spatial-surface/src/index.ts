import express from 'express';

const app = express();
const port = process.env.PORT || 5106;

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'spatial-surface' });
});

app.listen(port, () => {
    console.log('spatial-surface listening on port ' + port);
});
