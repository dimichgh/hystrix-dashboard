'use strict';

const Assert = require('assert');
const express = require('express');
const Usecases = require('./use-cases.json');

const app = express();
app.use((req, res) => {
    const ucase = Usecases[req.url];
    Assert.ok(ucase, `Cannot find use-case for ${req.url}`);
    ucase.incomming && Object.keys(ucase.incomming.headers).forEach(name => {
        const expected = ucase.incomming.headers[name];
        if (expected instanceof RegExp) {
            Assert.ok(expected.test(req.headers[name]), `Expected ${expected}, actual: ${req.headers[name]}`);
            return;
        }
        Assert.equal(expected, req.headers[name]);
    });

    if (ucase.outgoing.statusCode) {
        res.writeHead(ucase.outgoing.statusCode, ucase.outgoing.headers);
    }

    const resType = ucase.outgoing.type || 'normal';
    switch(resType) {
        case 'normal':
            ucase.outgoing.body && res.write(typeof ucase.outgoing.body === 'object' ?
                JSON.stringify(ucase.outgoing.body) :
                ucase.outgoing.body);
            break;
        case 'echo':
            const buffer = [];
            req.on('data', data => {
                buffer.push(data);
            });
            req.on('end', () => {
                buffer.forEach(data => res.write(data));
                res.end();
            });
            return;
        case 'timeout':
            return;
        case 'chunk-and-timeout':
            res.write(JSON.stringify(ucase.outgoing.chunk));
            return;
        default:
            throw new Error(`Unknown response type ${resType}`);
    }
    res.end();
});

module.exports = app;
