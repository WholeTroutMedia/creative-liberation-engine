import express from 'express';

const app = express();
const port = process.env.PORT || 5104;

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'sovereign-coder' });
});

app.listen(port, () => {
    console.log('sovereign-coder listening on port ' + port);
});
