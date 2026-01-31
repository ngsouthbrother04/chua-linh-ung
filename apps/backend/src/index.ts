import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(helmet());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Mobile Backend is running!', service: 'Node.js + Express' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
