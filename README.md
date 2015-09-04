# Appcelerator Cache Client library [![Build Status](https://travis-ci.org/appcelerator/appc-cache.svg?branch=master)](https://travis-ci.org/appcelerator/appc-cache)

The library makes it easy to use the Appcelerator Cache API Service. This library is meant to act as a drop-in replacement for the [Node Redis Client Library](https://github.com/NodeRedis/node_redis).

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

Once you have created the client instance, you can use it.  This library is (generally) compatible with the [Redis API](http://redis.io/commands).

```javascript
cache.set('key', 'value', function (err) {
    // set the value
});

cache.get('key', function (err, value) {
    console.log('cached value is', value);
});
```

## Redis Client emulation

This library emulates the same API as the redis client.  For example:

```javascript
var redis = require('appc-cache');
var client = redis.createClient({
    key: 'key'
});
client.auth('secret');
var multi = client.multi();
multi.echo('OK', redis.print);
multi.exec();
```


## Using as an Express Session Store

This library provides an Express compatible session store implementation.  Example usage:

```javascript
var app = express(),
    session = require('express-session'),
    Cache = require('appc-cache'),
    CacheStore = Cache.createSessionStore(session),
    options = {
        key: 'mykey',
        secret: 'mysecret',
        ttl: 2000
    };
app.use(session({
    store: new CacheStore(options),
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: false
}));
```

## Using Distributed Locks

This library supports distributed locks.  With a distributed lock, only one client can acquire a named lock at a time for a specified duration.

```javascript
cache.lock('my.lock', 10000, function (err, lock) {
    cache.unlock(lock);
});
```

You can extend the lock with the `extend` method. For example:

```javascript
cache.lock('my.lock', 10000, function (err, lock) {
    // extend the lock another 10 sec
    cache.extend(lock, 10000);
    cache.unlock(lock);
});
```

## APIs that are not supported

There are a number of APIs that are not support or not allowed. For example, this library does not support `shutdown`. For a full list of commands, see the file `lib/blacklist.js`.

## Running the Unit Tests

You can run the unit tests by setting the value of the following environment variables `APPC_TEST_KEY` and `APPC_TEST_SECRET` to the values to use for caching. For example:

```
APPC_TEST_KEY=kkkkkkkkkkkkkkkkkkkkkkkkk APPC_TEST_SECRET=ssssssssssssssssssssssss grunt
```

## License

The library is Confidential and Proprietary to Appcelerator, Inc. and licensed under the Appcelerator Software License Agreement. Copyright (c) 2015 by Appcelerator, Inc. All Rights Reserved.
