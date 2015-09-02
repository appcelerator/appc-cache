'use strict';
var url = require('url'),
	crypto = require('crypto'),
	util = require('util'),
	request = require('request'),
	colors = require('colors'),
	debug = require('debug')('appc:cache'),
	EventEmitter = require('events').EventEmitter,
	environments = {
		'production': 'https://cache.appcelerator.com',
		'preproduction': 'https://cache-preprod.cloud.appctest.com'
	},
	version = require('../package.json').version,
	processExit = process.exit,
	events = ['exit', 'shutdown', 'SIGINT', 'SIGTERM'],
	fingerprint;

/**
 * utility to determine if we're running in production
 */
function isRunningInPreproduction() {
	return process.env.NODE_ACS_URL &&
		process.env.NODE_ACS_URL.indexOf('.appctest.com') > 0 ||
		process.env.NODE_ENV === 'preproduction' ||
		process.env.APPC_ENV === 'preproduction' ||
		process.env.NODE_ENV === 'development' ||
		process.env.APPC_ENV === 'development';
}

function sha1(value) {
	var crypto = require('crypto');
	var sha = crypto.createHash('sha1');
	sha.update(value);
	return sha.digest('hex');
}

/**
 * get a unique fingerprint for the machine (hashed) which is used for
 * server-side client id tracking
 */
function getComputerFingerprint (callback, append) {
	if (fingerprint) { return callback && callback(null, fingerprint); }
	var exec = require('child_process').exec,
		cmd;
	switch (process.platform) {
		case 'darwin':
			// serial number + uuid is a good fingerprint
			// jscs:disable validateQuoteMarks
			cmd = "ioreg -l | awk '/IOPlatformSerialNumber/ { print $4 }' | sed s/\\\"//g && ioreg -rd1 -c IOPlatformExpertDevice |  awk '/IOPlatformUUID/ { print $3; }' | sed s/\\\"//g;";
			debug('running:', cmd);
			return exec(cmd, function (err, stdout) {
				if (err) { return callback(err); }
				var tokens = stdout.trim().split(/\s/),
					serial = tokens[0],
					uuid = tokens[1];
				fingerprint = sha1(stdout + process.pid);
				callback && callback(null, fingerprint);
			});
		case 'win32':
		case 'windows':
			cmd = 'reg query HKLM\\Software\\Microsoft\\Cryptography /v MachineGuid';
			if (append) { cmd += append; }
			debug('running:', cmd);
			return exec(cmd, function (err, stdout) {
				if (err && !append) {
					debug('trying again, forcing it to use 64bit registry view');
					return getComputerFingerprint(callback, ' /reg:64');
				} else if (err) {
					return callback(err);
				}
				var tokens = stdout.trim().split(/\s/),
					serial = tokens[tokens.length - 1];
				fingerprint = sha1(serial + process.pid);
				callback && callback(null, fingerprint);
			});
		case 'linux':
			cmd = "ifconfig | grep eth0 | grep -i hwaddr | awk '{print $1$5}' | sed 's/://g' | xargs echo | sed 's/ //g'";
			debug('running:', cmd);
			return exec(cmd, function (err, stdout) {
				if (err) { return callback(err); }
				var serial = stdout.trim();
				fingerprint = sha1(serial + process.pid);
				callback && callback(null, fingerprint);
			});
		default:
			callback(new Error("Unknown platform:" + process.platform));
	}
}

/**
 * get our interface information for both public and private
 */
function getIPAddresses (callback) {
	getComputerFingerprint(function (err, fingerprint) {
		try {
			var internalIP = require('internal-ip')();
			var handler = function errorHandler(e) {
				// this happens if we are offline, just capture it for now
			};
			process.on('uncaughtException', handler);
			var pip = require('public-ip');
			pip(function (err, publicIP) {
				process.removeListener('uncaughtException', handler);
				callback(null, {
					publicAddress: publicIP || internalIP,
					privateAddress: internalIP || '127.0.0.1'
				}, fingerprint || Date.now());
			});
		}
		catch (E) {
			callback(E);
		}
	});
}

/**
 * Class constructor
 *
 * @class Cache
 * @param {Object} opts options for configuring the client
 */
function Cache(opts) {
	opts = opts || {};
	opts.debug && (debug = function () {
		var args = Array.prototype.slice.call(arguments);
		if (args[0] && !!~args[0].indexOf('%')) {
			var result = util.format.apply(util.format, args);
			console.log('appc:cache'.red, result);
		} else {
			args.unshift('appc:cache'.red);
			console.log.apply(this, args);
		}
	});
	var env = opts.env || isRunningInPreproduction() ? 'preproduction' : 'production';
	this.timeout = opts.timeout || 10000;
	this.url = opts.url || environments[env] || environments.production;
	this.key = opts.key;
	this.secret = opts.secret;
	this.preferWebSocket = true;
	if (!this.key) {
		throw new Error('missing key');
	}
	if (!this.secret) {
		throw new Error('missing secret');
	}
	var self = this;
	this.disabled = opts.disabled;
	this.init();
	getComputerFingerprint();
	this._pendingStart = true;
	var localExit = function localExit(ec) {
		if (self._pendingStart) {
			debug('process.exit called but pending start, will exit on connect');
			self._pendingStartExit = true;
			self._pendingStartExitCode = ec;
			return;
		}
		debug('process exit called');
		processExit.apply(this, arguments);
	};
	process.exit = localExit;
	process.nextTick(function () {
		self._reconnect();
		self._pendingStart = false;
		if (process.exit === localExit) {
			debug('resetting process.exit');
			process.exit = processExit;
		}
		if (self._pendingStartExit) {
			debug('pending start, we exited');
			process.exit(self._pendingStartExitCode);
		}
	});
}

util.inherits(Cache, EventEmitter);

/**
 * return the fingerprint
 */
Cache.prototype.getFingerprint = function (callback) {
	if (fingerprint && callback) {
		return callback(null, fingerprint);
	} else if (fingerprint) {
		return fingerprint;
	} else if (callback) {
		return getComputerFingerprint(callback);
	}
	throw new Error('fingerprint has not yet been generated. invoke this function with a callback');
};

/**
 * common handler for errors
 */
function createErrorHandler (self, opts) {
	return function cacheRequetErrorHandler(err) {
		if (/^(ETIMEDOUT|ENOTFOUND|ECONNREFUSED)$/.test(err.code)) {
		}
		self.emit('error', err, opts);
		debug('error called', err, opts);
	};
}

Cache.prototype.close = function(callback) {
	if (this.disabled) { return callback && callback(); }
	this._closed = true;
	this._connected = this._connecting = this._authed = false;
	this.emit('close');
	this.removeAllListeners();
	if (this._socket) {
		this._socket.close();
		this._socket = null;
	}
	clearInterval(this._socketKA);
	this._socketKA = null;
	callback && callback();
};

function createDisconnectHandler(self, socket, reconnect) {
	return function disconnectHandler(reason, message) {
		debug('disconnect', reason, message, reconnect, !!self._pendingExit);
		if (self._closing && !self._closed) {
			debug('already closing, ignore disconnect');
			return;
		}
		var serverDisconnect = reason === 'io server disconnect';
		if (self._pendingStart && !serverDisconnect) {
			self._pendingStartExit = true;
			self._pendingStartExitCode = reason;
			self._pendingExit = true;
			debug('pending start, ignore disconnect');
			setTimeout(function() {
				self.emit('disconnecting');
				disconnectHandler(reason, message);
			}, self._sending ? 3000 : 1000);
			return;
		}
		var delay;
		if (!reconnect && !self._pendingExit && !serverDisconnect) {
			self._pendingExit = true;
			if (socket && !reason) {
				if (self._sending) { return ;}
				socket.emit('disconnecting');
				return setTimeout(function() {
					disconnectHandler(reason, message);
				}, self._sending ? 3000 : 1000);
			}
		}
		if (!reason && !reconnect || serverDisconnect) {
			delay = self.close();
		}
		if (reason && reason !== 'unauthorized' && !serverDisconnect) {
			if (!self._connecting && reconnect && !self._shutdown) {
				self._reconnect();
			}
		} else if (reason && !serverDisconnect) {
			var err = new Error(message);
			err.code = reason;
			self.emit('error',err);
		}
		if (self._shutdownHandler) {
			events.forEach(function (signal) {
				try { process.removeListener(signal, self._shutdownHandler); } catch (E) { }
			});
			self._shutdownHandler = null;
		}
		if (self._disconnectHandler) {
			socket.removeListener('disconnecting', self._disconnectHandler);
			socket.removeListener('disconnect', self._disconnectHandler);
			self._disconnectHandler = null;
		}
	};
}

Cache.prototype._reconnect = function() {
	if (this.disabled) { return; }
	debug('_reconnect');
	if (this._connecting || this._closed) {
		debug('_reconnect called but connecting=%d, closed=%d', !!this._connecting, !!this._closed);
		return;
	}
	this._authed = false;
	this._connecting = true;
	this._connected = false;
	clearInterval(this._socketKA);
	this._socketKA = setInterval(function () {
	}, 60000);
	if (this._socket) {
		debug('closing existing socket', this._socket);
		this._socket.close();
	}
	var socket = this._socket = require('socket.io-client')(this.url, {forceNew:true});
	var self = this;
	debug('connecting url=%s', this.url);
	socket.on('connect', function() {
		debug('connected');
		// we can get multiple notices so we ignore after first
		if (self._connected) { return; }
		self._connected = true;
		self._connecting = false;
		self._shutdown = false;
		self.emit('connect');
		// if closed before fully auth, just return
		getIPAddresses(function (err, address, fingerprint) {
			socket.emit('authenticate', {
				uuid: fingerprint, // used to uniquely identify this client
				key: self.key,
				signature: crypto.createHmac('SHA256',self.secret).update(self.key).digest('base64'),
				address: address
			});
			socket.on('authenticated', function () {
				if (self._authed || self._closed) { return; }
				self._authed = true;
				debug('authenticated');
				socket.emit('register');
			});
			socket.on('ping', function () {
				debug('received ping, sending pong');
				socket.emit('pong');
			});
			socket.on('message', function (channel, data) {
				self.emit('message', channel, data);
			});
			socket.on('pmessage', function (pattern, channel, data) {
				self.emit('pmessage', pattern, channel, data);
			});
		});
	});
	socket.io.on('connect_error', function(data) {
		self.emit('connect_error', data);
	});
	if (this._shutdownHandler) {
		events.forEach(function (signal) {
			try { process.removeListener(signal, self._shutdownHandler); } catch (E) { }
		});
	}
	this._disconnectHandler = createDisconnectHandler(this, socket, true);
	this._shutdownHandler = createDisconnectHandler(this, socket, false);
	socket.on('disconnecting', this._disconnectHandler);
	socket.on('disconnect', this._disconnectHandler);
	events.forEach(function (signal) {
		process.on(signal, self._shutdownHandler);
	});
};

Cache.prototype._connect = function(name) {
	if (this.disabled) { return; }
	debug('_connect %s', name);
	var i = name.indexOf(':'),
		pattern = name.substring(i+1);

	if (!this._connected) {
		this._reconnect();
	} else if (this._socket && this._authed) {
		this._socket.emit('register');
	}
};

////////////////////////////////////////////////////////////////////////////////

/**
 * ensure we're connected and authenticated before invoking
 */
function createWrappedFunction (self, name) {
	var fn = self[name],
		delegate;
	self[name] = delegate = function wrappedFunction() {
		var args = arguments;
		if (self._authed) {
			debug('exec => %s', name);
			return fn.apply(self, args);
		} else {
			setTimeout(function() {
				return delegate.apply(self, args);
			}, 10);
		}
	};
	return delegate;
}

/**
 * generic callback handler
 */
function createResponseHandler (self, callback) {
	return function responseHandler (err, resp) {
		if (err) {
			if (err.success === false) {
				return callback && callback(err.message);
			}
			return callback && callback(err);
		}
		if (resp && resp.success === false) {
			return callback && callback(new Error(resp.message));
		}
		callback && callback(null, resp && resp.data);
	};
}

function getCallback (arg) {
	return arg && typeof(arg) === 'function' ? arg : null;
}

Cache.prototype._queue = function (fn, args) {
	this.queue = this.queue || [];
	this.queue.push([fn, args]);
};

Cache.prototype._runQueue = function () {
	if (this.queue && this.queue.length) {
		var i = this.queue.shift();
		i[0].apply(this, i[1]);
	}
};

Cache.prototype.createExecutor = function (command) {
	// don't overwrite if we have a special implementation overriden
	var action = command.charAt(0) === '_' ? command.substring(1) : command;
	if (!(command in this)) {
		var self = this;
		var fn = function executor () {
			// pipeline all calls
			if (self._executing) {
				return self._queue(fn, arguments);
			}
			self._executing = true;
			var callback = getCallback(arguments[arguments.length - 1]),
				args = Array.prototype.slice.call(arguments, 0, callback ? -1 : arguments.length);
			debug('exec=>', command, args, callback);
			self._socket.emit('command', {action:command, args:args}, createResponseHandler(self, function (err, data) {
				self._executing = false;
				callback && callback(err, data);
				// run any pending commands
				self._runQueue();
			}));
		};
		self[action] = fn;
	}
	return createWrappedFunction(this, action);
};

/**
 * handle pubsub subscriptions
 */
Cache.prototype.subscribe = function () {
	var callback = arguments[arguments.length - 1],
		args = Array.prototype.slice.call(arguments, 0, -1),
		self = this;
	if (typeof(callback) !== 'function') {
		throw new Error('invalid usage. last argument must be a function');
	}
	var fn = function (channel, data) {
		for (var c = 0; c < args.length; c++) {
			if (args[c] === channel) {
				callback(null, channel, data);
				break;
			}
		}
	};
	this.on('message', fn);
	this._subscribe.apply(this, args);
	return fn;
};

Cache.prototype.unsubscribe = function () {
	var callback = arguments[arguments.length - 1],
		args = Array.prototype.slice.call(arguments, 0, -1),
		self = this;
	this._unsubscribe.apply(this, args);
	if (callback && typeof(callback) === 'function') {
		this.removeListener('message', callback);
	} else {
		this.removeAllListeners('message');
	}
};

/**
 * handle pubsub subscriptions
 */
Cache.prototype.psubscribe = function () {
	var callback = arguments[arguments.length - 1],
		args = Array.prototype.slice.call(arguments, 0, -1),
		self = this;
	if (typeof(callback) !== 'function') {
		throw new Error('invalid usage. last argument must be a function');
	}
	var fn = function (pattern, channel, data) {
		for (var c = 0; c < args.length; c++) {
			if (args[c] === pattern) {
				callback(null, pattern, channel, data);
				break;
			}
		}
	};
	this.on('pmessage', fn);
	this._psubscribe.apply(this, args);
	return fn;
};

Cache.prototype.punsubscribe = function () {
	var callback = arguments[arguments.length - 1],
		args = Array.prototype.slice.call(arguments, 0, -1),
		self = this;
	this._punsubscribe.apply(this, args);
	if (callback && typeof(callback) === 'function') {
		this.removeListener('pmessage', callback);
	} else {
		this.removeAllListeners('pmessage');
	}
};

/**
 * load our commands mapping
 */
Cache.prototype.init = function() {
	// wire up our built-in redis command maps and any custom commands
	var adds = [
		'_lock',
		'_unlock',
		'_extend'
	];
	Cache.validCommands.concat(adds).forEach(function (command) {
		this.createExecutor(command);
	}, this);
};

/**
 * dump
 */
Cache.prototype.inspect = function () {
	return '[object Cache]';
};

var oneDay = 86400;

/**
 * return TTL in seconds for session
 */
function getTTL(store, sess) {
	var maxAge = sess.cookie.maxAge;
	// return in seconds (instead of milliseconds)
	return (store.ttl || (typeof maxAge === 'number' ? Math.floor(maxAge) : oneDay)) / 1000;
}

/**
 * create an express session store
 */
Cache.createSessionStore = function (session) {
	// adapted from https://github.com/tj/connect-redis/blob/master/lib/connect-redis.js
	var Store = session.Store;

	/**
	 * @constructor
	 */
	function CacheStore (options) {
		options = options || {};
		Store.call(this, options);
		this.prefix = options.prefix || 'session';
		this.cache = new Cache(options);
		this.ttl = options.ttl;
	}

	CacheStore.prototype.__proto__ = Store.prototype;

	/**
	 * Attempt to fetch session by the given `sid`.
	 *
	 * @param {String} sid
	 * @param {Function} fn
	 * @api public
	 */
	CacheStore.prototype.get = function (sid, fn) {
		var psid = this.prefix + sid;
		this.cache.get(psid, fn);
	};

	/**
	 * Commit the given `sess` object associated with the given `sid`.
	 *
	 * @param {String} sid
	 * @param {Session} sess
	 * @param {Function} fn
	 * @api public
	 */
	CacheStore.prototype.set = function (sid, sess, fn) {
		var psid = this.prefix + sid;
		var ttl = getTTL(this, sess);
		this.cache.setex(psid, ttl, sess, fn);
	};

	/**
	 * Destroy the session associated with the given `sid`.
	 *
	 * @param {String} sid
	 * @api public
	 */
	CacheStore.prototype.destroy = function (sid, fn) {
		var psid = this.prefix + sid;
		this.cache.del(psid, fn);
	};

	/**
	 * Refresh the time-to-live for the session with the given `sid`.
	 *
	 * @param {String} sid
	 * @param {Session} sess
	 * @param {Function} fn
	 * @api public
	 */
	CacheStore.prototype.touch = function (sid, sess, fn) {
		var psid = this.prefix + sid;
		var ttl = getTTL(this, sess);
		this.cache.expire(psid, ttl, fn);
	};

	return CacheStore;
};

module.exports = Cache;

// setup the valid commands
var blacklist = require('./blacklist'),
	commands = require('./commands').filter(function (item) {
		return blacklist.indexOf(item) === -1;
	});
Cache.validCommands = commands;
