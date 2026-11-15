const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const app = express();

app.use(express.json());
app.use(cors());

// Database connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ VIP! Database Connect Ho Gaya Hai!'))
  .catch((err) => console.log('❌ Masla Aa Gaya:', err));

// Test route
app.get('/', (req, res) => {
  res.send('Mubarak ho! Backend Server chal raha hai!');
});

app.listen(5000, () => {
  console.log('🚀 Server Port 5000 par start ho gaya hai');
});