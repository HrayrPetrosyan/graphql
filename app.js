const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const path = require('path');
const multer = require('multer');
const uuidv4 = require('uuid/v4');
const graphqlHttp = require('express-graphql');

const graphqlSchema = require('./graphql/schema');
const graphqlResolver = require('./graphql/resolvers');
const auth = require('./middleware/is-auth');
const { clearImage } = require('./util/file');

const feedRoutes = require('./routes/feed');
const authRoutes = require('./routes/auth');


const app = express();

const fileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'images')
    },
    filename: (req, file, cb) => {
        cb(null, uuidv4())
    }
})

const fileFilter = (req, file, cb) => {
    if (
        file.mimetype === 'image/png' ||
        file.mimetype === 'image.jpg' ||
        file.mimetype === 'image/jpeg'
    ) {
        cb(null, true);
    } else {
        cb(null, false);
    }
}

app.use(bodyParser.json());
app.use(
    multer({storage: fileStorage, fileFilter: fileFilter}).single('image')
    );
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
})

app.use('/feed', feedRoutes);
app.use('/auth', authRoutes);

app.use(auth);

app.put('/post-image', (req,res, next) => {
    if (!req.isAuth) {
        throw new Error('Not authenticated')
    }
    if(!req.file) {
        return res.status.apply(200).json({message: 'No file provided!'})
    }
    if (req.body.oldpath) {
        clearImage(req.body.oldpath)
    }
    return res.status(201).json({message: 'file stored', filePath: req.file.path})
})

app.use('/graphql', graphqlHttp({
    schema: graphqlSchema,
    rootValue: graphqlResolver,
    graphiql: true,
    formatError(err) {
        if (!err.originalError) {
            return err;
        }
        const data = err.originalError.data;
        const message = err.message || 'An error occured';
        const code = err.originalError.cod || 500;
        return { message: message, status: code, data: data};
    }
}))

app.use((error, req, res, next) => {
    console.log(error);
    const status = error.statusCode || 500;
    const message = error.message;
    const data = error.data;
    res.status(status).json({ message: message, data: data})
})

mongoose
    .connect(
        'mongodb+srv://Hrayr:1gohardlikePutin!@cluster0-dl25r.mongodb.net/messages?retryWrites=true'
    )
    .then(res => {
        app.listen(8080);
    })
    .catch(err => console.log(err))

