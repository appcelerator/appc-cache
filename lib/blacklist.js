'use strict';

/**
 * commands we do not specifically allow
 */
module.exports = [
	"bgrewriteaof",
	"bgsave",
	"client kill",
	"client list",
	"client getname",
	"client pause",
	"client setname",
	"config get",
	"config rewrite",
	"config set",
	"config resetstat",
	"dbsize",
	"debug object",
	"debug segfault",
	"auth",
	"dump",
	"restore",
	"eval",
	"evalsha",
	"exec",
	"info",
	"migrate",
	"monitor",
	"move",
	"multi",
	"pubsub",
	"quit",
	"script exists",
	"script flush",
	"script kill",
	"script load",
	"select",
	"shutdown",
	"slaveof",
	"slowlog",
	"sync",
	"unwatch",
	"watch"
];