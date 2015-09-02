var should = require('should'),
	Cache = require('../'),
	cache;

describe('strings', function () {
	this.timeout(10000);

	before(function (done) {
		cache = new Cache({
			key: process.env.APPC_TEST_KEY,
			secret: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://360-local.cloud.appctest.com:8445'
		});
		// delete all the keys before starting
		cache.flushdb(done);
	});

	afterEach(function (done) {
		cache.flushdb(done);
	});

	after(function (done) {
		if (cache) {
			cache.close(done);
		} else {
			done();
		}
	});

	it('supports append', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.append(key, 1, function (err, result) {
				if (err) { return done(err); }
				cache.get(key, function(err, result) {
					if (err) { return done(err); }
					should(result).be.equal('11');
					done();
				});
			});
		});
	});

	it('supports getset', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.getset(key, 2, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal('1');
				done();
			});
		});
	});

	it('supports incr', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.incr(key, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal(2);
				done();
			});
		});
	});

	it('supports incrby', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.incrby(key, 2, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal(3);
				done();
			});
		});
	});

	it('supports incrbyfloat', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.incrbyfloat(key, 2.5, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal('3.5');
				done();
			});
		});
	});

	it('supports incrbyfloat (negative)', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 5, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.incrbyfloat(key, -2.5, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal('2.5');
				done();
			});
		});
	});

	it('supports decr', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.decr(key, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal(0);
				done();
			});
		});
	});

	it('supports decrby', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 2, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.decrby(key, 2, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal(0);
				done();
			});
		});
	});

	it('supports getrange', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 'This is a string', function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.getrange(key, 0, 3, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal('This');
				done();
			});
		});
	});

	it('supports strlen', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 'This is a string', function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.strlen(key, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal(16);
				done();
			});
		});
	});

	it('supports mset', function (done) {
		var key1 = 'test.get.' + Math.random(Date.now()),
			key2 = 'test.get.' + Math.random(Date.now());
		cache.mset(key1, 1, key2, 2, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.get(key1, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal('1');
				cache.get(key2, function (err, result) {
					if (err) { return done(err); }
					should(result).be.equal('2');
					done();
				});
			});
		});
	});

	it('supports mget', function (done) {
		var key1 = 'test.get.' + Math.random(Date.now()),
			key2 = 'test.get.' + Math.random(Date.now());
		cache.mset(key1, 1, key2, 2, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.mget(key1, key2, function (err, result) {
				if (err) { return done(err); }
				should(result).be.an.array;
				should(result[0]).be.equal('1');
				should(result[1]).be.equal('2');
				done();
			});
		});
	});

});
