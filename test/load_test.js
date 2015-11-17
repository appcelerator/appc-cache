var should = require('should'),
	async = require('async'),
	Cache = require('../'),
	cache;

describe('load test', function () {
	this.timeout(120000);

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

	function runBenchmark (fn, done) {
		// run longer on CI build machine
		var count = process.env.CI ? 10000 : 1000,
			threads = 25,
			iterations = 0,
			started = Date.now();

		function runLoad(n, cb) {
			if ((++iterations % 1000) === 0) {
				console.log('\t' + (iterations / 1000) + ',000 / ' + (count / 1000) + ',000 ....');
			}
			fn(cb);
		}

		async.timesLimit(count, threads, runLoad, function (err) {
			if (err) { return done(err); }
			var duration = Date.now() - started;
			console.log('load test took', (duration / 1000), 'seconds, ', (duration / count), 'ms/msg');
			done(null, duration);
		});
	}

	it('echo', function (done) {
		runBenchmark(function (cb){ cache.echo('OK', cb); }, done);
	});

	it('get', function (done) {
		cache.set('a', 'b');
		runBenchmark(function (cb){ cache.get('a', cb); }, done);
	});

	it('getset', function (done) {
		runBenchmark(function (cb){ cache.getset('a', 'b', cb); }, done);
	});

	it('multi', function (done) {
		var started = Date.now(),
			multi = cache.multi(),
			count = 1000;
		for (var c = 0; c < count; c++) {
			multi.getset('a', 'b');
		}
		multi.exec(function (err) {
			if (err) { return done(err); }
			var duration = Date.now() - started;
			console.log('load test took', (duration / 1000), 'seconds, ', (duration / count), 'ms/msg');
			done();
		});
	});

});
