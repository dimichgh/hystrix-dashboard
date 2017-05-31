'use strict';

const Hystrix = require('hystrixjs');

module.exports = {
    metricsFactory: {
        getAllMetrics() {
            return [];
        }
    },

    HystrixSSEStream: Hystrix.HystrixSSEStream
};
