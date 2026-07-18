const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());


// Routes
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: "API is healthy"
    });
})

module.exports = app;