'use strict';

const Assert = require('assert');
const express = require('express');

const App = require('./fixtures/proxy/app');
const Wreck = require('wreck');
const prxy = require('../proxy');

describe(__filename, () => {
    let targetPort;
    let sourcePort;
    let proxy;

    before(next => {
        next = done(2, next);

        const target = App
        .listen(err => {
            Assert.ok(!err, err && err.stack);
            targetPort = target.address().port;
            next();
        });

        const sourceApp = express();
        const source = sourceApp.use((req, res) => {
            proxy(req, res);
        })
        .listen(err => {
            Assert.ok(!err, err && err.stack);
            sourcePort = source.address().port;
            next();
        });
    });

    it('should do GET proxy', next => {
        proxy = prxy({
            socketTimeout: 1000,
            connectTimeout: 100
        });

        const origin = `http://localhost:${targetPort}/get`;
        Wreck.request('GET', `http://localhost:${sourcePort}?origin=${origin}`, {
            headers: {
                foo: 'bar',
                qaz: 'wsx'
            }
        }, (err, res) => {
            Assert.ok(!err, err && err.stack);
            Assert.equal('ert', res.headers.qwe);
            Assert.equal('tgb', res.headers.rfv);

            Wreck.read(res, null, function onResponseRead(err, body) {
                if (err) {
                    next(err);
                    return;
                }
                Assert.equal('Hello World', body.toString());
                next();
            });

        });
    });

    it('should do POST proxy', next => {
        proxy = prxy({
            socketTimeout: 1000,
            connectTimeout: 100
        });

        const origin = `http://localhost:${targetPort}/post`;
        Wreck.request('POST', `http://localhost:${sourcePort}?origin=${origin}`, {
            headers: {
                foo: 'bar',
                qaz: 'wsx'
            },
            payload: 'Hello'
        }, (err, res) => {
            Assert.ok(!err, err && err.stack);

            Wreck.read(res, null, function onResponseRead(err, body) {
                if (err) {
                    next(err);
                    return;
                }
                Assert.equal('Hello', body.toString());
                next();
            });

        });
    });

    it('should proxy redirect', next => {
        proxy = prxy({
            socketTimeout: 1000,
            connectTimeout: 100
        });

        const origin = `http://localhost:${targetPort}/redirect`;
        Wreck.request('GET', `http://localhost:${sourcePort}?origin=${origin}`, {
            headers: {
                foo: 'bar',
                qaz: 'wsx'
            }
        }, (err, res) => {
            Assert.ok(!err, err && err.stack);
            Assert.equal('http://some.link/', res.headers.location);
            next();
        });
    });

    it('should handle connect timeout', next => {
        proxy = prxy({
            socketTimeout: 1000,
            connectTimeout: 1
        });

        const origin = `http://www.ebay.com`;
        Wreck.request('GET', `http://localhost:${sourcePort}?origin=${origin}`, {
            headers: {
                foo: 'bar',
                qaz: 'wsx'
            }
        }, (err, res) => {
            Assert.ok(!err, err && err.stack);
            Assert.equal(504, res.statusCode);
            Assert.equal('Gateway timeout', res.statusMessage);

            Wreck.read(res, null, function onResponseRead(err, body) {
                if (err) {
                    next(err);
                    return;
                }
                body = body.toString();
                Assert.ok(body.indexOf('Host info') !== -1);
                next();
            });
        });
    });

    it('should handle response timeout', next => {
        proxy = prxy({
            socketTimeout: 1,
            connectTimeout: 1000
        });

        const origin = `http://www.ebay.com`;
        Wreck.request('GET', `http://localhost:${sourcePort}?origin=${origin}`, {
            headers: {
                foo: 'bar',
                qaz: 'wsx',
                host: 'www.ebay.com'
            }
        }, (err, res) => {
            Assert.ok(!err, err && err.stack);
            Assert.equal(504, res.statusCode);
            Assert.equal('Gateway timeout', res.statusMessage);
            Wreck.read(res, null, function onResponseRead(err, body) {
                if (err) {
                    next(err);
                    return;
                }
                body = body.toString();
                Assert.ok(body.indexOf('Host info') !== -1);
                next();
            });
        });

    });

    it('should handle response timeout after one chunk', next => {
        proxy = prxy({
            socketTimeout: 100,
            connectTimeout: 1000
        });

        const origin = `http://localhost:${targetPort}/chunk-and-timeout`;
        Wreck.request('GET', `http://localhost:${sourcePort}?origin=${origin}`, {
            headers: {
                foo: 'bar',
                qaz: 'wsx'
            },
            socketTimeout: 100
        }, (err, res) => {
            Assert.ok(!err, err && err.stack);
            Assert.equal(200, res.statusCode);
            Wreck.read(res, null, function onResponseRead(err, body) {
                Assert.equal(body.toString(), '"Hello World"');
                next();
            });
        });

    });
});

function done(count, next) {
    return function (err) {
        if (err) {
            return next(err);
        }
        count--;
        if (count > 0) {
            return;
        }
        next();
    };
}
