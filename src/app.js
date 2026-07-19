const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./modules/auth/auth.routes');

const notFoundMiddleware = require('./middlewares/notFound.middleware');
const errorMiddleware = require('./middlewares/error.middleware');

const app = express();

// Middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/auth', authRoutes);


// Routes
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: "API is healthy"
    });
})

// Error Handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;