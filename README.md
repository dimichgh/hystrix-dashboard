hystrix-dashboard
=================

The module provides UI part from hystrix java dashboard that can be used as part nodejs application.
For convenience, it also provides a publisher /hystrix.stream and a proxy /proxy.stream

[![codecov](https://codecov.io/gh/dimichgh/hystrix-dashboard/branch/master/graph/badge.svg)](https://codecov.io/gh/dimichgh/hystrix-dashboard)
[![Build Status](https://travis-ci.org/dimichgh/hystrix-dashboard.svg?branch=master)](https://travis-ci.org/dimichgh/hystrix-dashboard) [![NPM](https://img.shields.io/npm/v/hystrix-dashboard.svg)](https://www.npmjs.com/package/hystrix-dashboard)
[![Downloads](https://img.shields.io/npm/dm/hystrix-dashboard.svg)](http://npm-stat.com/charts.html?package=hystrix-dashboard)
[![Known Vulnerabilities](https://snyk.io/test/github/dimichgh/hystrix-dashboard/badge.svg)](https://snyk.io/test/github/dimichgh/hystrix-dashboard)


### Install

```bash
npm install hystrix-dashboard -S
```

### Usage

Expose it as part of your express app under /hystrix

```js
const express = require('express');
const app = express();
const dashboard = require('hystrix-dashboard');

app.use(dashboard({
    topic: 'hystrix:metrics' // <<< configurable hystrix metrics topic
}));

app.listen(8000); //  http://localhost:8000/hystrix
```

The stream can be served by /hystrix.stream if this module is used within the same runtime where service metrics is produced.

The hystrix stream will listen to process events with the configured topic (by default it will use 'hystrix:metrics'.)

Here's an example how you can link dashboard to the real metrics for services based on [hystrixjs](https://www.npmjs.com/package/hystrixjs) module provided that both components are part of the same runtime:

```js
const hystrixStream = require('hystrixjs').hystrixSSEStream;

hystrixStream.toObservable().subscribe(
    // publish metrics under hystrix:metrics
    sseData => process.emit('hystrix:metrics', sseData),
    err => {},
    () => {}
);
```

For a real example, you can look at how [trooba-hystrix-handler](https://github.com/trooba/trooba-hystrix-handler) uses it to expose trooba pipeline service metrics.
