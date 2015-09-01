# Appcelerator Cache Client library [![Build Status](https://travis-ci.org/appcelerator/appc-cache.svg?branch=master)](https://travis-ci.org/appcelerator/appc-cache)

The library makes it easy to use the Appcelerator Cache Server.

## Installation

    npm install appc-cache --save

## Usage

You must first include the library and create an instance.  At a minimum, you must pass in the `key` and `secret` values for constructing the client.

```javascript
var Cache = require('appc-cache'),
    cache = new Cache({
        key: 'MY_KEY',
        secret: 'MY_SECRET'
    });
```

Once you have created the client instance, you can use it.

```javascript
cache.set('key', 'value', function (err) {
    // set the value
});

cache.get('key', function (err, value) {
    console.log('cached value is', value);
});

cache.set('key', 'value', 10000, function (err) {
    // set the value and auto expire in 10s
});

cache.expire('key', function (err) {
    // expire key
});

cache.ttl('key', 20000, function (err) {
    // update the expiration ttl for key to 20s
});
```

## License

The library is Confidential and Proprietary to Appcelerator, Inc. and licensed under the Appcelerator Software License Agreement. Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
