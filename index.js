'use strict';

const NodePath = require('path');
const express = require('express');

module.exports = function configure(config, app) {
    if (config && config.use) {
        app = config;
    }
    app = app || express();
    const topic = config && config.topic || 'hystrix:metrics';

    app.use('/hystrix.stream', function hystrixStreamResponse(request, response) {
        response.append('Content-Type', 'text/event-stream;charset=UTF-8');
        response.append('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
        response.append('Pragma', 'no-cache');

        const listener = data => {
            if (typeof data !== 'string') {
                data = JSON.stringify(data);
            }
            response.write('data: ' + data + '\n\n');
        };

        setInterval(() => {
            response.write(':ping\n\n');
        }, 4000).unref();

        process.on(topic, listener);

        const cleanAll = () => process.removeListener(topic, listener);

        request.once('close', cleanAll);
        request.once('aborted', cleanAll);
        response.once('close', cleanAll);
        response.once('finish', cleanAll);
    });

    app.use('/', express.static(NodePath.join(__dirname, './webapp')));

    return app;
};
