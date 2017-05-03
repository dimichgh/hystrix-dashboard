'use strict';

const express = require('express');
const app = express();
const proxy = require('./proxy');

app.use('/proxy.stream', proxy());

const dashboard = require('.')(app);

dashboard.listen(8080, () => {
    console.log('The dashboard is ready');
});
