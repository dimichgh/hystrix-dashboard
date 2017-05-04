'use strict';

const Assert = require('assert');
const Http = require('http');
const express = require('express');
const supertest = require('supertest');

const app = express();
const proxy = require('../proxy');
app.use('/proxy.stream', proxy());

describe(__filename, () => {
    it('should start the server', next => {
        const dashboard = require('..')(app);

        supertest(dashboard)
        .get('/')
        .end((err, res) => {
            Assert.ok(!err, err && err.stack);
            Assert.equal(200, res.statusCode);
            Assert.ok(res.text.indexOf('<title>Hystrix Dashboard</title>') !== -1);
            next();
        });
    });

    describe('should emit ping when idle', () => {
        let port;

        before(next => {
            const dashboard = require('..')({
                idleTimeout: 100
            }, app);

            let svr = dashboard.listen(() => {
                port = svr.address().port;
                next();
            });
        });

        it('should get idle ping', function (next) {

            let data = [];
            const req = Http.get(`http://localhost:${port}/hystrix.stream`, res => {
                const statusCode = res.statusCode;
                const contentType = res.headers['content-type'];

                Assert.equal(200, statusCode);
                Assert.equal('text/event-stream;charset=UTF-8', contentType);

                res.setEncoding('utf8');
                res.on('data', chunk => {
                    data.push(chunk);
                })
                .on('end', () => {
                    Assert.ok(data.length);
                    data.forEach(d => Assert.equal(':ping\n\n', d));
                    next();
                });
            })
            .once('error', next);

            setTimeout(() => req.abort(), 500);
        });
    });

    describe('should emit metrics via topic into stream', () => {
        let port;

        before(next => {
            const dashboard = require('..')(app);

            let svr = dashboard.listen(() => {
                port = svr.address().port;
                next();
            });
        });

        it('test', function (next) {
            let data = [];
            const req = Http.get(`http://localhost:${port}/hystrix.stream`, res => {
                const statusCode = res.statusCode;
                const contentType = res.headers['content-type'];

                Assert.equal(200, statusCode);
                Assert.equal('text/event-stream;charset=UTF-8', contentType);

                res.setEncoding('utf8');
                res.on('data', chunk => {
                    data.push(chunk);
                })
                .on('end', () => {
                    Assert.deepEqual([ 'data: {"chunk":0}\n\n',
                      'data: {"chunk":1}\n\n',
                      'data: {"chunk":2}\n\n',
                      'data: {"chunk":3}\n\n',
                      'data: {"chunk":4}\n\n',
                      'data: {"chunk":5}\n\n',
                      'data: {"chunk":6}\n\n',
                      'data: {"chunk":7}\n\n',
                      'data: {"chunk":8}\n\n',
                      'data: {"chunk":9}\n\n',
                      'data: {"chunk":10}\n\n',
                      'data: {"chunk":11}\n\n',
                      'data: {"chunk":12}\n\n',
                      'data: {"chunk":13}\n\n',
                      'data: {"chunk":14}\n\n',
                      'data: {"chunk":15}\n\n',
                      'data: {"chunk":16}\n\n',
                      'data: {"chunk":17}\n\n',
                      'data: {"chunk":18}\n\n',
                      'data: {"chunk":19}\n\n' ], data);
                    next();
                });
            })
            .once('error', () => {
            });

            setTimeout(() => {
                for (var i = 0; i < 10; i++) {
                    process.emit('hystrix:metrics', `{"chunk":${i}}`);
                }

                setTimeout(() => {
                    for (; i < 20; i++) {
                        process.emit('hystrix:metrics', {chunk:i});
                    }

                    setTimeout(() => {
                        req.abort();
                    }, 100);
                });
            }, 400);

        });

    });

    describe('should proxy the hystrix stream', next => {
        let port;

        before(next => {
            const dashboard = require('..')(app);

            let svr = dashboard.listen(() => {
                port = svr.address().port;
                next();
            });
        });

        it('test', function (next) {
            let data = [];
            const req = Http.get(`http://localhost:${port}/proxy.stream?origin=http://localhost:${port}/hystrix.stream`, res => {
                const statusCode = res.statusCode;
                const contentType = res.headers['content-type'];

                Assert.equal(200, statusCode);
                Assert.equal('text/event-stream;charset=UTF-8', contentType);

                res.setEncoding('utf8');
                res.on('data', chunk => {
                    data.push(chunk);
                })
                .on('end', () => {
                    Assert.deepEqual([ 'data: chunk:0\n\n',
                      'data: chunk:1\n\n',
                      'data: chunk:2\n\n',
                      'data: chunk:3\n\n',
                      'data: chunk:4\n\n',
                      'data: chunk:5\n\n',
                      'data: chunk:6\n\n',
                      'data: chunk:7\n\n',
                      'data: chunk:8\n\n',
                      'data: chunk:9\n\n',
                      'data: chunk:10\n\n',
                      'data: chunk:11\n\n',
                      'data: chunk:12\n\n',
                      'data: chunk:13\n\n',
                      'data: chunk:14\n\n',
                      'data: chunk:15\n\n',
                      'data: chunk:16\n\n',
                      'data: chunk:17\n\n',
                      'data: chunk:18\n\n',
                      'data: chunk:19\n\n' ], data);
                    next();
                });
            })
            .once('error', () => {
            });

            setTimeout(() => {
                for (var i = 0; i < 10; i++) {
                    process.emit('hystrix:metrics', `chunk:${i}`);
                }

                setTimeout(() => {
                    for (; i < 20; i++) {
                        process.emit('hystrix:metrics', `chunk:${i}`);
                    }

                    setTimeout(() => {
                        req.abort();
                    }, 100);
                });
            }, 400);

        });
    });
});
