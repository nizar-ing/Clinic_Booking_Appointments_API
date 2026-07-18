const app = require('./app')
const env = require('./config/env');

const PORT = env.PORT;

const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})
