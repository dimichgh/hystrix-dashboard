'use strict';

const Assert = require('assert');
const Http = require('http');
const express = require('express');
const supertest = require('supertest');
const Index = require('..');

const proxy = require('../proxy');

describe(__filename, () => {

    describe('Utils', () => {
        after(() => {
            delete require.cache[require.resolve('hystrixjs')];
            delete require.cache[require.resolve('./fixtures/hystrix-mock/node_modules/hystrixjs/index')];
            delete require.cache[require.resolve('./fixtures/hystrix-mock/mock1')];
        });

        it('should not find hystrixjs', next => {
            Index.Utils.findHystrixModules(list => {
                Assert.equal(0, list.length);
                next();
            });
        });

        it('should find one module', next => {
            require('hystrixjs');
            Index.Utils.findHystrixModules(list => {
                Assert.equal(1, list.length);
                Assert.ok(/node_modules\/hystrixjs\/index.js$/.test(list[0]));
                next();
            });
        });

        it('should find two modules', next => {
            require('./fixtures/hystrix-mock/node_modules/hystrixjs/index');
            Index.Utils.findHystrixModules(list => {
                Assert.equal(2, list.length);
                Assert.ok(/node_modules\/hystrixjs\/index.js$/.test(list[0]));
                next();
            });
        });
    });

    it('should start the server', next => {
        const app = express();
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
        const app = express();
        app.use('/proxy.stream', proxy());
        let _findHystrixModules;

        before(next => {
            _findHystrixModules = Index.Utils.findHystrixModules;

            const dashboard = require('..')(app, {
                idleTimeout: 100
            });

            let svr = dashboard.listen(() => {
                port = svr.address().port;
                next();
            });
        });

        after(() => {
            Index.Utils.findHystrixModules = _findHystrixModules;
        });

        it('should get idle ping', function (next) {
            require('hystrixjs');
            Index.Utils.findHystrixModules = callback => callback([
                require.resolve('./fixtures/hystrix-mock/mock1.js')
            ]);

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
            .once('error', err => {});

            setTimeout(() => req.abort(), 500);
        });
    });

    describe('metrics stream', () => {
        let port;
        const app = express();

        before(next => {
            delete require.cache[require.resolve('hystrixjs')];
            const dashboard = require('..')(app, {
                interval: 300,
                idleTimeout: 400
            });

            let svr = dashboard.listen(() => {
                port = svr.address().port;
                next();
            });
        });

        it('should return empty stream and close it due to no metrics available', next => {
            Http.get(`http://localhost:${port}/hystrix.stream`, res => {
                const statusCode = res.statusCode;
                const contentType = res.headers['content-type'];

                Assert.equal(200, statusCode);
                Assert.equal('text/event-stream;charset=UTF-8', contentType);

                res.setEncoding('utf8');
                res.on('data', chunk => {
                    next(new Error('Should not happen'));
                })
                .on('end', () => {
                    next();
                });
            })
            .once('error', next);
        });

        it('should return stream with metrics', function (next) {
            const Hystrix = require('hystrixjs');

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
                    // make sure metrics observation is stopped by waiting for the next cycle
                    setTimeout(() => {
                        Assert.equal(21, data.length);
                        data.forEach((item, index) => {
                            Assert.ok(new RegExp(`{"type":"HystrixCommand","name":"command:${index}"`).test(item) ||
                            item === ':ping\n\n');
                        });
                        next();
                    }, 400);
                });
            })
            .once('error', () => {
            });

            setTimeout(() => {
                for (var i = 0; i < 10; i++) {
                    Hystrix.metricsFactory.getOrCreate({commandKey:`command:${i}`}).markSuccess();
                }

                setTimeout(() => {
                    for (; i < 20; i++) {
                        Hystrix.metricsFactory.getOrCreate({commandKey:`command:${i}`}).markSuccess();
                    }

                    setTimeout(() => {
                        req.abort();
                    }, 300);
                }, 100);
            }, 100);

        });

    });

    describe('should proxy the hystrix stream', next => {
        let port;

        before(next => {
            const dashboard = require('..')({
                interval: 300,
                proxy: true
            });

            let svr = dashboard.listen(() => {
                port = svr.address().port;
                next();
            });
        });

        it('test', function (next) {
            const Hystrix = require('hystrixjs');
            Hystrix.commandFactory.resetCache();
            Hystrix.circuitFactory.resetCache();
            Hystrix.metricsFactory.resetCache();

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
                    Assert.equal(20, data.length);
                    data.forEach((item, index) => {
                        Assert.ok(new RegExp(`{"type":"HystrixCommand","name":"command:${index}"`).test(item));
                    });
                    next();
                });
            })
            .once('error', () => {
            });

            setTimeout(() => {
                for (var i = 0; i < 10; i++) {
                    Hystrix.metricsFactory.getOrCreate({commandKey:`command:${i}`}).markSuccess();
                }

                setTimeout(() => {
                    for (; i < 20; i++) {
                        Hystrix.metricsFactory.getOrCreate({commandKey:`command:${i}`}).markSuccess();
                    }

                    setTimeout(() => {
                        req.abort();
                    }, 300);
                }, 100);
            }, 100);

        });
    });
});
