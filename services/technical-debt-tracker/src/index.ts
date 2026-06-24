import express from 'express';

const app = express();
const port = process.env.PORT || 5102;

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'technical-debt-tracker' });
});

app.listen(port, () => {
    console.log('technical-debt-tracker listening on port ' + port);
});
