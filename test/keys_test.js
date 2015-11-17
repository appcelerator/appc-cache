var should = require('should'),
	Cache = require('../'),
	cache;

describe('keys', function () {
	this.timeout(10000);

	before(function (done) {
		cache = new Cache({
			key: process.env.APPC_TEST_KEY,
			secret: process.env.APPC_TEST_SECRET,
			url: process.env.APPC_TEST_URL || 'https://local.cloud.appctest.com:8445'
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

	it('supports get', function (done) {
		cache.get('test.get.' + Date.now(), function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			done();
		});
	});

	it('supports set / get chaining', function (done) {
		cache.set('test.get','1').get('test.get', function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			done();
		});
	});

	it('supports set as string', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, '1', function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.get(key, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal('1');
				done();
			});
		});
	});

	it('supports set as number', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.get(key, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal('1');
				done();
			});
		});
	});

	it('supports set as object', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, {value:1}, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.get(key, function (err, result) {
				if (err) { return done(err); }
				should(result).be.eql({value:1});
				done();
			});
		});
	});

	it('supports set with ttl', function (done) {
		var key = 'test.get.' + Date.now();
		cache.setex(key, 1, {value:1}, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			setTimeout(function () {
				cache.get(key, function (err, result) {
					if (err) { return done(err); }
					should(result).be.null;
					done();
				});
			}, 1000);
		});
	});

	it('supports del', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.del(key);
			cache.get(key, function (err, result) {
				if (err) { return done(err); }
				should(result).be.null;
				done();
			});
		});
	});

	it('supports exists', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.exists(key, function (err, result) {
				if (err) { return done(err); }
				should(result).be.true;
				done();
			});
		});
	});

	it('supports expire', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.expire(key, 1);
			setTimeout(function () {
				cache.exists(key, function (err, result) {
					if (err) { return done(err); }
					should(result).be.false;
					done();
				});
			}, 1000);
		});
	});

	it('supports expireat', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.expireat(key, (Date.now() + 1000) / 1000);
			setTimeout(function () {
				cache.exists(key, function (err, result) {
					if (err) { return done(err); }
					should(result).be.false;
					done();
				});
			}, 1000);
		});
	});

	it('supports keys', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.keys('*', function (err, result) {
				if (err) { return done(err); }
				should(result).be.an.array;
				should(result).have.length(1);
				should(result[0]).be.equal(key);
				done();
			});
		});
	});

	it('supports persist', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.expireat(key, Date.now() + 500);
			cache.persist(key);
			setTimeout(function () {
				cache.get(key, function (err, result) {
					if (err) { return done(err); }
					should(result).be.equal('1');
					done();
				});
			}, 1000);
		});
	});

	it('supports pexpire', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.pexpire(key, 1000);
			setTimeout(function () {
				cache.get(key, function (err, result) {
					if (err) { return done(err); }
					should(result).be.null;
					done();
				});
			}, 1000);
		});
	});

	it('supports pexpireat', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.pexpireat(key, Date.now () + 1000);
			setTimeout(function () {
				cache.get(key, function (err, result) {
					if (err) { return done(err); }
					should(result).be.null;
					done();
				});
			}, 1000);
		});
	});

	it('supports pttl', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.pexpireat(key, Date.now () + 1000);
			cache.pttl(key, function (err, result) {
				if (err) { return done(err); }
				should(result).be.a.number;
				should(result).be.greaterThan(900);
				done();
			});
		});
	});

	it('supports randomkey', function (done) {
		cache.randomkey(function (err, result) {
			if (err) { return done(err); }
			should(result).be.null;
			cache.set('key', 1, function (err, result) {
				if (err) { return done(err); }
				cache.randomkey(function (err, result) {
					if (err) { return done(err); }
					should(result).be.equal('key');
					done();
				});
			});
		});
	});

	it('supports rename', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.rename(key, key+'.rename', function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal('OK');
				cache.get(key + '.rename', function (err, result) {
					if (err) { return done(err); }
					should(result).be.equal('1');
					done();
				});
			});
		});
	});

	it('supports renamenx', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.rename(key, key+'.rename', function (err) {
				if (err) { return done(err); }
				cache.get(key + '.rename', function (err, result) {
					if (err) { return done(err); }
					should(result).be.equal('1');
					done();
				});
			});
		});
	});

	it('supports ttl', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.ttl(key, function (err, result) {
				if (err) { return done(err); }
				should(result).be.equal(-1);
				cache.pexpireat(key, Date.now () + 1000);
				cache.ttl(key, function (err, result) {
					if (err) { return done(err); }
					should(result).be.equal(1);
					done();
				});
			});
		});
	});

	it('supports scan', function (done) {
		var key = 'test.get.' + Date.now();
		cache.set(key, 1, function (err, result) {
			if (err) { return done(err); }
			should(result).be.undefined;
			cache.scan(0, 'MATCH', '*', function (err, result) {
				if (err) { return done(err); }
				should(result).be.an.array;
				should(result[0]).be.equal('0');
				should(result[1]).be.an.array;
				should(result[1]).have.length(1);
				should(result[1][0]).be.equal(key);
				done();
			});
		});
	});
});
