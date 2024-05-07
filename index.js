'use strict';

const Async = require('async');
const NodePath = require('path');
const express = require('express');

module.exports = function configure(app, config) {
    if (app && !app.use) {
        config = app;
        app = undefined;
    }
    app = app || express();

    app.use('/hystrix.stream', function hystrixStreamResponse(request, response) {
        response.append('Content-Type', 'text/event-stream;charset=UTF-8');
        response.append('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
        response.append('Pragma', 'no-cache');

        // We need to deal with the case when more than one hystrixjs module is used
        // So we start observing them all for now
        findHystrixModules(list => {
            if (list.length > 0) {
                let publishing = list.map(path => {
                    const hystrix = require(path);
                    return startPublishing(hystrix, config && config.interval, publish);
                });

                let timer = setInterval(() => {
                    response.write(':ping\n\n');
                }, config && config.idleTimeout || 4000).unref();

                const cleanAll = () => {
                    if (publishing) {
                        publishing.forEach(session => {
                            session.stop();
                        });
                    }
                    publishing = undefined;
                    clearInterval(timer);
                    timer = undefined;
                };

                request.once('close', cleanAll);
                request.once('aborted', cleanAll);
                response.once('close', cleanAll);
                response.once('finish', cleanAll);
            }
            else {
                response.end();
            }
        });

        function publish(data) {
            response.write('data: ' + data + '\n\n');
        }

    });

    if (config && config.proxy) {
        app.use('/proxy.stream', require('./proxy')(config.proxy));
    }

    app.use('/', express.static(NodePath.join(__dirname, './webapp')));

    return app;
};

function findHystrixModules(callback) {
    // make it async to avoid going through too many entries at the same time
    Async.filterLimit(Object.keys(require.cache), 10, (entry, next) => {
        setImmediate(() => next(null, /node_modules\/hystrixjs\/index\.js$/.test(entry)));
    }, (err, list) => callback(list));
}

function toObservable(hystrix, interval) {
    interval = interval || 2000;
    const rx = require('rxjs');

    return rx.Observable
        .interval(interval)
        .flatMap(() => {
            return rx.Observable.from(hystrix.metricsFactory.getAllMetrics());
        })
        .map((metrics) => {
            const m = hystrix.hystrixSSEStream.toCommandJson(metrics);
            return m;
        });
}

function startPublishing(hystrix, interval, publish) {
    const subscription = toObservable(hystrix, interval)
    .subscribe(
        sseData => publish(sseData),
        err => {},
        () => {}
    );

    return {
        stop: function stop() {
            subscription.unsubscribe();
        }
    };
}

module.exports.Utils = {
    toObservable: toObservable,
    startPublishing: startPublishing,
    findHystrixModules: findHystrixModules
};
