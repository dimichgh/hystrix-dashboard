'use strict';

const Wreck = require('wreck');
const Hoek = require('hoek');

module.exports = function createProxy(config) {
    config = typeof config === 'object' && config || {};

    return function proxy(req, res) {
        const headers = config.headers;
        const requestOptions = Object.assign({}, config);

        if (config.connectTimeout) {
            requestOptions.timeout = config.connectTimeout;
        }
        // merge request headers with proxy headers
        requestOptions.headers = Object.assign({}, req.headers, headers, {
            host: req.headers.host
        });

        requestOptions.payload = req;

        var proxyRequest = Wreck.request(req.method, req.query.origin, requestOptions);
        if (config.socketTimeout) {
            proxyRequest.setTimeout(config.socketTimeout, function timedout() {
                proxyRequest.abort();
                if (res.headersSent) {
                    res.socket.destroy();
                }
            });
        }

        proxyRequest.once('response', function (proxyResponse) {
            res.writeHead(proxyResponse.statusCode, proxyResponse.headers);

            proxyResponse.pipe(res);
            proxyRequest.once('abort', () => {
                proxyResponse.unpipe();
                proxyResponse.destroy();
            });
        });

        const handleErr = Hoek.once(err => {
            if (err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET') {
                res.writeHead(504, `Gateway timeout`);
                delete requestOptions.payload;
                console.log(`[ERROR] Host info ${JSON.stringify(requestOptions, null, '  ')}`);
            }
            else {
                res.writeHead(500, 'Unknown error');
                console.log('[ERROR]', err.stack);
            }
            res.end();
        });

        proxyRequest.on('error', handleErr);

        req.on('end', () => proxyRequest.end());

        return proxyRequest;
    };
};
