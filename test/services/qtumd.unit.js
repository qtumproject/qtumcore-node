'use strict';

/* jshint sub: true */

var path = require('path');
var EventEmitter = require('events').EventEmitter;
var should = require('chai').should();
var crypto = require('crypto');
var qtumcore = require('qtumcore-lib');
var _ = qtumcore.deps._;
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var fs = require('fs');
var sinon = require('sinon');

var index = require('../../lib');
var log = index.log;
var errors = index.errors;

var Transaction = qtumcore.Transaction;
var readFileSync = sinon.stub().returns(fs.readFileSync(path.resolve(__dirname, '../data/qtum.conf')));
var QtumService = proxyquire('../../lib/services/qtumd', {
	fs: {
		readFileSync: readFileSync
	}
});
var defaultQtumConf = fs.readFileSync(path.resolve(__dirname, '../data/default.qtum.conf'), 'utf8');

describe('Qtum Service', function() {
	var txhex = '02000000018729e1903754b645c41cba1e5f9d9ccf9e3a1567c05def83c65f53157787bb19010000004847304402202379f2c157d515d525c9f14816be05747ac0bd385c2a32b0e882939fc3f81a530220720af854c1289fd0b034ff06f16e40db79f366ab3804314887e8f52d41f9991601ffffffff0b00000000000000000080119ff4020000002321034ac19f491683092a923138b52e2b36f2b7a182a931dd6a68d5641be37b78857fac005a6202000000001976a914e3c8033c2a416030ff221760542ba84ee5b9f43c88ac005a6202000000001976a914b6f603e399f673fee1ff82d27292a918f24b8e4a88ac005a6202000000001976a9148fde54e036a40c99c096dd65dfb29023bd96101288ac005a6202000000001976a9142e10fe88d6e075ad44a42f5c941599240aeba5fb88ac005a6202000000001976a914795607d424e0b6091b187cfa4a31a5b7a596791688ac005a6202000000001976a914edf2d506a7ba1966b858631accf8de3da157555688ac005a6202000000001976a9149d7c71eff196e749c5ec71277f50d4aef006e4f988ac005a6202000000001976a914c6c08d9ecb35760356219860553bfc7c19c26b4488ac005a6202000000001976a91439d41c6c7c944c196852928721ad2e623442e9ba88ac00000000';

	var baseConfig = {
		node: {
			network: qtumcore.Networks.testnet
		},
		spawn: {
			datadir: 'testdir',
			exec: 'testpath'
		}
	};

	describe('@constructor', function() {
		it('will create an instance', function() {
			var qtumd = new QtumService(baseConfig);
			should.exist(qtumd);
		});
		it('will create an instance without `new`', function() {
			var qtumd = QtumService(baseConfig);
			should.exist(qtumd);
		});
		it('will init caches', function() {
			var qtumd = new QtumService(baseConfig);

			should.exist(qtumd.utxosCache);
			should.exist(qtumd.txidsCache);
			should.exist(qtumd.balanceCache);
			should.exist(qtumd.summaryCache);
			should.exist(qtumd.transactionDetailedCache);
			should.exist(qtumd.accountInfo);

			should.exist(qtumd.transactionCache);
			should.exist(qtumd.rawTransactionCache);
			should.exist(qtumd.rawJsonTransactionCache);
			should.exist(qtumd.blockCache);
			should.exist(qtumd.blockJsonCache);
			should.exist(qtumd.blockSubsidyCache);
			should.exist(qtumd.rawBlockCache);
			should.exist(qtumd.blockHeaderCache);
			should.exist(qtumd.zmqKnownTransactions);
			should.exist(qtumd.zmqKnownBlocks);
			should.exist(qtumd.lastTip);
			should.exist(qtumd.lastTipTimeout);
			should.equal(qtumd.dgpInfoCache, null, 'should be null');
			should.equal(qtumd.miningInfoCache, null, 'should be null');
			should.equal(qtumd.stakingInfoCache, null, 'should be null');

			// limits
			should.equal(qtumd.maxTxids, 1000);
			should.equal(qtumd.maxTransactionHistory, 50);
			should.equal(qtumd.maxAddressesQuery, 10000);
			should.equal(qtumd.shutdownTimeout, 15000);

			// spawn restart setting
			should.equal(qtumd.spawnRestartTime, 5000);
			should.equal(qtumd.spawnStopTime, 10000);

			// try all interval
			should.equal(qtumd.tryAllInterval, 1000);
			should.equal(qtumd.startRetryInterval, 5000);

			// rpc limits
			should.equal(qtumd.transactionConcurrency, 5);

			// sync progress level when zmq subscribes to events
			should.equal(qtumd.zmqSubscribeProgress, 0.9999);
		});
		it('will init clients', function() {
			var qtumd = new QtumService(baseConfig);
			qtumd.nodes.should.deep.equal([]);
			qtumd.nodesIndex.should.equal(0);
			qtumd.nodes.push({ client: sinon.stub() });
			should.exist(qtumd.client);
		});
		it('will set subscriptions', function() {
			var qtumd = new QtumService(baseConfig);
			qtumd.subscriptions.should.deep.equal({
				address: {},
				rawtransaction: [],
				hashblock: [],
				balance: {},
			});
		});
	});

	describe('#_initDefaults', function() {
		it('will set transaction concurrency', function() {
			var qtumd = new QtumService(baseConfig);
			qtumd._initDefaults({ transactionConcurrency: 10 });
			qtumd.transactionConcurrency.should.equal(10);
			qtumd._initDefaults({});
			qtumd.transactionConcurrency.should.equal(5);
		});
	});

	describe('@dependencies', function() {
		it('will have no dependencies', function() {
			QtumService.dependencies.should.deep.equal([]);
		});
	});

	describe('#getAPIMethods', function() {
		it('will return spec', function() {
			var qtumd = new QtumService(baseConfig);
			var methods = qtumd.getAPIMethods();
			should.exist(methods);
			methods.length.should.equal(33);
		});
	});

	describe('#getPublishEvents', function() {
		it('will return spec', function() {
			var qtumd = new QtumService(baseConfig);
			var events = qtumd.getPublishEvents();
			should.exist(events);
			events.length.should.equal(4);

			events[0].name.should.equal('qtumd/rawtransaction');
			events[0].scope.should.equal(qtumd);
			events[0].subscribe.should.be.a('function');
			events[0].unsubscribe.should.be.a('function');

			events[1].name.should.equal('qtumd/hashblock');
			events[1].scope.should.equal(qtumd);
			events[1].subscribe.should.be.a('function');
			events[1].unsubscribe.should.be.a('function');

			events[2].name.should.equal('qtumd/addresstxid');
			events[2].scope.should.equal(qtumd);
			events[2].subscribe.should.be.a('function');
			events[2].unsubscribe.should.be.a('function');

			events[3].name.should.equal('qtumd/addressbalance');
			events[3].scope.should.equal(qtumd);
			events[3].subscribe.should.be.a('function');
			events[3].unsubscribe.should.be.a('function');

		});
		it('will call subscribe/unsubscribe with correct args', function() {
			var qtumd = new QtumService(baseConfig);
			qtumd.subscribe = sinon.stub();
			qtumd.unsubscribe = sinon.stub();
			var events = qtumd.getPublishEvents();

			events[0].subscribe('test');
			qtumd.subscribe.args[0][0].should.equal('rawtransaction');
			qtumd.subscribe.args[0][1].should.equal('test');

			events[0].unsubscribe('test');
			qtumd.unsubscribe.args[0][0].should.equal('rawtransaction');
			qtumd.unsubscribe.args[0][1].should.equal('test');

			events[1].subscribe('test');
			qtumd.subscribe.args[1][0].should.equal('hashblock');
			qtumd.subscribe.args[1][1].should.equal('test');

			events[1].unsubscribe('test');
			qtumd.unsubscribe.args[1][0].should.equal('hashblock');
			qtumd.unsubscribe.args[1][1].should.equal('test');
		});
	});

	describe('#subscribe', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will push to subscriptions', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter = {};
			qtumd.subscribe('hashblock', emitter);
			qtumd.subscriptions.hashblock[0].should.equal(emitter);

			var emitter2 = {};
			qtumd.subscribe('rawtransaction', emitter2);
			qtumd.subscriptions.rawtransaction[0].should.equal(emitter2);
		});
	});

	describe('#unsubscribe', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will remove item from subscriptions', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = {};
			var emitter2 = {};
			var emitter3 = {};
			var emitter4 = {};
			var emitter5 = {};
			qtumd.subscribe('hashblock', emitter1);
			qtumd.subscribe('hashblock', emitter2);
			qtumd.subscribe('hashblock', emitter3);
			qtumd.subscribe('hashblock', emitter4);
			qtumd.subscribe('hashblock', emitter5);
			qtumd.subscriptions.hashblock.length.should.equal(5);

			qtumd.unsubscribe('hashblock', emitter3);
			qtumd.subscriptions.hashblock.length.should.equal(4);
			qtumd.subscriptions.hashblock[0].should.equal(emitter1);
			qtumd.subscriptions.hashblock[1].should.equal(emitter2);
			qtumd.subscriptions.hashblock[2].should.equal(emitter4);
			qtumd.subscriptions.hashblock[3].should.equal(emitter5);
		});
		it('will not remove item an already unsubscribed item', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = {};
			var emitter3 = {};
			qtumd.subscriptions.hashblock = [emitter1];
			qtumd.unsubscribe('hashblock', emitter3);
			qtumd.subscriptions.hashblock.length.should.equal(1);
			qtumd.subscriptions.hashblock[0].should.equal(emitter1);
		});
	});

	describe('#subscribeAddress', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will not an invalid address', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter = new EventEmitter();
			qtumd.subscribeAddress(emitter, ['invalidaddress']);
			should.not.exist(qtumd.subscriptions.address['invalidaddress']);
		});
		it('will add a valid address', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter = new EventEmitter();
			qtumd.subscribeAddress(emitter, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			should.exist(qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
		});
		it('will handle multiple address subscribers', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscribeAddress(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscribeAddress(emitter2, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			should.exist(qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(2);
		});
		it('will not add the same emitter twice', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			qtumd.subscribeAddress(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscribeAddress(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			should.exist(qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
		});
	});

	describe('#unsubscribeAddress', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('it will remove a subscription', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscribeAddress(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscribeAddress(emitter2, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			should.exist(qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(2);
			qtumd.unsubscribeAddress(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
		});
		it('will unsubscribe subscriptions for an emitter', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter1, emitter2];
			qtumd.unsubscribeAddress(emitter1);
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
		});
		it('will NOT unsubscribe subscription with missing address', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter1, emitter2];
			qtumd.unsubscribeAddress(emitter1, ['qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX']);
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(2);
		});
		it('will NOT unsubscribe subscription with missing emitter', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter2];
			qtumd.unsubscribeAddress(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'][0].should.equal(emitter2);
		});
		it('will remove empty addresses', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter1, emitter2];
			qtumd.unsubscribeAddress(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.unsubscribeAddress(emitter2, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			should.not.exist(qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
		});
		it('will unsubscribe emitter for all addresses', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter1, emitter2];
			qtumd.subscriptions.address['qRRv2uwzP5YSfWcnkcEUP25jvEDW7BJz1a'] = [emitter1, emitter2];
			sinon.spy(qtumd, 'unsubscribeAddressAll');
			qtumd.unsubscribeAddress(emitter1);
			qtumd.unsubscribeAddressAll.callCount.should.equal(1);
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
			qtumd.subscriptions.address['qRRv2uwzP5YSfWcnkcEUP25jvEDW7BJz1a'].length.should.equal(1);
		});
	});

	describe('#unsubscribeAddressAll', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will unsubscribe emitter for all addresses', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter1, emitter2];
			qtumd.subscriptions.address['qRRv2uwzP5YSfWcnkcEUP25jvEDW7BJz1a'] = [emitter1, emitter2];
			qtumd.subscriptions.address['qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2'] = [emitter2];
			qtumd.subscriptions.address['qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR'] = [emitter1];
			qtumd.unsubscribeAddressAll(emitter1);
			qtumd.subscriptions.address['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
			qtumd.subscriptions.address['qRRv2uwzP5YSfWcnkcEUP25jvEDW7BJz1a'].length.should.equal(1);
			qtumd.subscriptions.address['qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2'].length.should.equal(1);
			should.not.exist(qtumd.subscriptions.address['qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR']);
		});
	});

	describe('#_getDefaultConfig', function() {
		it('will generate config file from defaults', function() {
			var qtumd = new QtumService(baseConfig);
			var config = qtumd._getDefaultConfig();
			config.should.equal(defaultQtumConf);
		});
	});

	describe('#_loadSpawnConfiguration', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});


		it('will parse a qtum.conf file', function() {
			var TestQtum = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFileSync: readFileSync,
					existsSync: sinon.stub().returns(true),
					writeFileSync: sinon.stub()
				},
				mkdirp: {
					sync: sinon.stub()
				}
			});
			var qtumd = new TestQtum(baseConfig);
			qtumd.options.spawn.datadir = '/tmp/.qtum';

			sinon.spy(qtumd, '_expandRelativeDatadir');
			sinon.spy(qtumd, '_checkConfigIndexes');
			sinon.spy(qtumd, '_getDefaultConf')
			sinon.spy(qtumd, '_getNetworkConfigPath');
			sinon.spy(qtumd, '_parseBitcoinConf');

			var node = {};
			qtumd._loadSpawnConfiguration(node);

			qtumd._expandRelativeDatadir.callCount.should.equal(1);
			qtumd._checkConfigIndexes.callCount.should.equal(1);
			qtumd._getDefaultConf.callCount.should.equal(1);
			qtumd._getNetworkConfigPath.callCount.should.equal(1);
			qtumd._parseBitcoinConf.callCount.should.equal(2);

			should.exist(qtumd.spawn.config);
			qtumd.spawn.config.should.deep.equal({
				addressindex: 1,
				checkblocks: 144,
				dbcache: 8192,
				maxuploadtarget: 1024,
				port: 20000,
				rpcport: 50001,
				rpcallowip: '127.0.0.1',
				rpcuser: 'qtum',
				rpcpassword: 'qtumpassword',
				server: 1,
				spentindex: 1,
				timestampindex: 1,
				txindex: 1,
				upnp: 0,
				whitelist: '127.0.0.1',
				zmqpubhashblock: 'tcp://127.0.0.1:28332',
				zmqpubrawtx: 'tcp://127.0.0.1:28332'
			});
		});

		it('will expand relative datadir to absolute path', function() {
			var TestQtum = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFileSync: readFileSync,
					existsSync: sinon.stub().returns(true),
					writeFileSync: sinon.stub()
				},
				mkdirp: {
					sync: sinon.stub()
				}
			});
			var config = {
				node: {
					network: qtumcore.Networks.testnet,
					configPath: '/tmp/.qtumcore/qtumcore-node.json'
				},
				spawn: {
					datadir: './data',
					exec: 'testpath'
				}
			};
			var qtumd = new TestQtum(config);

			sinon.spy(qtumd, '_expandRelativeDatadir');
			sinon.spy(qtumd, '_checkConfigIndexes');
			sinon.spy(qtumd, '_getDefaultConf')
			sinon.spy(qtumd, '_getNetworkConfigPath');
			sinon.spy(qtumd, '_parseBitcoinConf');

			qtumd.options.spawn.datadir = './data';
			var node = {};
			qtumd._loadSpawnConfiguration(node);

			qtumd._expandRelativeDatadir.callCount.should.equal(1);
			qtumd._checkConfigIndexes.callCount.should.equal(1);
			qtumd._getDefaultConf.callCount.should.equal(1);
			qtumd._getNetworkConfigPath.callCount.should.equal(1);
			qtumd._parseBitcoinConf.callCount.should.equal(2);

			qtumd.options.spawn.datadir.should.equal('/tmp/.qtumcore/data');
		});
		it('should throw an exception if txindex isn\'t enabled in the configuration', function() {
			var TestQtum = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFileSync: sinon.stub().returns(fs.readFileSync(__dirname + '/../data/badqtum.conf')),
					existsSync: sinon.stub().returns(true),
				},
				mkdirp: {
					sync: sinon.stub()
				}
			});
			var qtumd = new TestQtum(baseConfig);
			(function() {
				qtumd._loadSpawnConfiguration({ datadir: './test' });
			}).should.throw(qtumcore.errors.InvalidState);
		});
		it('should NOT set https options if node https options are set', function() {
			var writeFileSync = function(path, config) {
				config.should.equal(defaultQtumConf);
			};
			var TestQtum = proxyquire('../../lib/services/qtumd', {
				fs: {
					writeFileSync: writeFileSync,
					readFileSync: readFileSync,
					existsSync: sinon.stub().returns(false)
				},
				mkdirp: {
					sync: sinon.stub()
				}
			});
			var config = {
				node: {
					network: {
						name: 'regtest'
					},
					https: true,
					httpsOptions: {
						key: 'key.pem',
						cert: 'cert.pem'
					}
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testexec'
				}
			};
			var qtumd = new TestQtum(config);
			qtumd.options.spawn.datadir = '/tmp/.qtum';
			var node = {};
			qtumd._loadSpawnConfiguration(node);
		});
	});

	describe('#_checkConfigIndexes', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'warn');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('should warn the user if txindex isn\'t set to 1 in the qtum.conf file', function() {
			var qtumd = new QtumService(baseConfig);
			var config = {
				txindex: 0,
				addressindex: 1,
				spentindex: 1,
				server: 1,
				zmqpubrawtx: 1,
				zmqpubhashblock: 1,
				reindex: 1
			};
			var node = {};
			(function() {
				qtumd._checkConfigIndexes(config, node);
			}).should.throw('"txindex" option');
		});
		it('should warn the user if addressindex isn\'t set to 1 in the qtum.conf file', function() {
			var qtumd = new QtumService(baseConfig);
			var config = {
				txindex: 1,
				addressindex: 0,
				spentindex: 1,
				server: 1,
				zmqpubrawtx: 1,
				zmqpubhashblock: 1,
				reindex: 1
			};
			var node = {};
			(function() {
				qtumd._checkConfigIndexes(config, node);
			}).should.throw('"addressindex" option');
		});
		it('should warn the user if spentindex isn\'t set to 1 in the qtum.conf file', function() {
			var qtumd = new QtumService(baseConfig);
			var config = {
				txindex: 1,
				addressindex: 1,
				spentindex: 0,
				server: 1,
				zmqpubrawtx: 1,
				zmqpubhashblock: 1,
				reindex: 1
			};
			var node = {};
			(function() {
				qtumd._checkConfigIndexes(config, node);
			}).should.throw('"spentindex" option');
		});
		it('should warn the user if server isn\'t set to 1 in the qtum.conf file', function() {
			var qtumd = new QtumService(baseConfig);
			var config = {
				txindex: 1,
				addressindex: 1,
				spentindex: 1,
				server: 0,
				zmqpubrawtx: 1,
				zmqpubhashblock: 1,
				reindex: 1
			};
			var node = {};
			(function() {
				qtumd._checkConfigIndexes(config, node);
			}).should.throw('"server" option');
		});
		it('should warn the user if reindex is set to 1 in the qtum.conf file', function() {
			var qtumd = new QtumService(baseConfig);
			var config = {
				txindex: 1,
				addressindex: 1,
				spentindex: 1,
				server: 1,
				zmqpubrawtx: 1,
				zmqpubhashblock: 1,
				reindex: 1
			};
			var node = {};
			qtumd._checkConfigIndexes(config, node);
			log.warn.callCount.should.equal(1);
			node._reindex.should.equal(true);
		});
		it('should warn if zmq port and hosts do not match', function() {
			var qtumd = new QtumService(baseConfig);
			var config = {
				txindex: 1,
				addressindex: 1,
				spentindex: 1,
				server: 1,
				zmqpubrawtx: 'tcp://127.0.0.1:28332',
				zmqpubhashblock: 'tcp://127.0.0.1:28331',
				reindex: 1
			};
			var node = {};
			(function() {
				qtumd._checkConfigIndexes(config, node);
			}).should.throw('"zmqpubrawtx" and "zmqpubhashblock"');
		});
	});

	describe('#_resetCaches', function() {
		it('will reset LRU caches', function() {
			var qtumd = new QtumService(baseConfig);
			var keys = [];
			for (var i = 0; i < 10; i++) {
				keys.push(crypto.randomBytes(32));
				qtumd.transactionDetailedCache.set(keys[i], {});
				qtumd.utxosCache.set(keys[i], {});
				qtumd.accountInfo.set(keys[i], {});
				qtumd.txidsCache.set(keys[i], {});
				qtumd.balanceCache.set(keys[i], {});
				qtumd.summaryCache.set(keys[i], {});
				qtumd.blockOverviewCache.set(keys[i], {});
				qtumd.blockJsonCache.set(keys[i], {});
			}
			qtumd._resetCaches();
			should.equal(qtumd.transactionDetailedCache.get(keys[0]), undefined);
			should.equal(qtumd.utxosCache.get(keys[0]), undefined);
			should.equal(qtumd.accountInfo.get(keys[0]), undefined);
			should.equal(qtumd.txidsCache.get(keys[0]), undefined);
			should.equal(qtumd.balanceCache.get(keys[0]), undefined);
			should.equal(qtumd.summaryCache.get(keys[0]), undefined);
			should.equal(qtumd.blockOverviewCache.get(keys[0]), undefined);
			should.equal(qtumd.blockJsonCache.get(keys[0]), undefined);


			should.equal(qtumd.dgpInfoCache, null, 'should be null');
			should.equal(qtumd.miningInfoCache, null, 'should be null');
			should.equal(qtumd.stakingInfoCache, null, 'should be null');
		});
	});

	describe('#_tryAllClients', function() {
		it('will retry for each node client', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.tryAllInterval = 1;
			qtumd.nodes.push({
				client: {
					getInfo: sinon.stub().callsArgWith(0, new Error('test'))
				}
			});
			qtumd.nodes.push({
				client: {
					getInfo: sinon.stub().callsArgWith(0, new Error('test'))
				}
			});
			qtumd.nodes.push({
				client: {
					getInfo: sinon.stub().callsArg(0)
				}
			});
			qtumd._tryAllClients(function(client, next) {
				client.getInfo(next);
			}, function(err) {
				if (err) {
					return done(err);
				}
				qtumd.nodes[0].client.getInfo.callCount.should.equal(1);
				qtumd.nodes[1].client.getInfo.callCount.should.equal(1);
				qtumd.nodes[2].client.getInfo.callCount.should.equal(1);
				done();
			});
		});
		it('will start using the current node index (round-robin)', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.tryAllInterval = 1;
			qtumd.nodes.push({
				client: {
					getInfo: sinon.stub().callsArgWith(0, new Error('2'))
				}
			});
			qtumd.nodes.push({
				client: {
					getInfo: sinon.stub().callsArgWith(0, new Error('3'))
				}
			});
			qtumd.nodes.push({
				client: {
					getInfo: sinon.stub().callsArgWith(0, new Error('1'))
				}
			});
			qtumd.nodesIndex = 2;
			qtumd._tryAllClients(function(client, next) {
				client.getInfo(next);
			}, function(err) {
				err.should.be.instanceOf(Error);
				err.message.should.equal('3');
				qtumd.nodes[0].client.getInfo.callCount.should.equal(1);
				qtumd.nodes[1].client.getInfo.callCount.should.equal(1);
				qtumd.nodes[2].client.getInfo.callCount.should.equal(1);
				qtumd.nodesIndex.should.equal(2);
				done();
			});
		});
		it('will get error if all clients fail', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.tryAllInterval = 1;
			qtumd.nodes.push({
				client: {
					getInfo: sinon.stub().callsArgWith(0, new Error('test'))
				}
			});
			qtumd.nodes.push({
				client: {
					getInfo: sinon.stub().callsArgWith(0, new Error('test'))
				}
			});
			qtumd.nodes.push({
				client: {
					getInfo: sinon.stub().callsArgWith(0, new Error('test'))
				}
			});
			qtumd._tryAllClients(function(client, next) {
				client.getInfo(next);
			}, function(err) {
				should.exist(err);
				err.should.be.instanceOf(Error);
				err.message.should.equal('test');
				done();
			});
		});
	});

	describe('#_wrapRPCError', function() {
		it('will convert qtumd-rpc error object into JavaScript error', function() {
			var qtumd = new QtumService(baseConfig);
			var error = qtumd._wrapRPCError({ message: 'Test error', code: -1 });
			error.should.be.an.instanceof(errors.RPCError);
			error.code.should.equal(-1);
			error.message.should.equal('Test error');
		});
	});

	describe('#_initChain', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will set height and genesis buffer', function(done) {
			var qtumd = new QtumService(baseConfig);
			var genesisBuffer = new Buffer([]);
			qtumd.getRawBlock = sinon.stub().callsArgWith(1, null, genesisBuffer);
			qtumd.nodes.push({
				client: {
					getBestBlockHash: function(callback) {
						callback(null, {
							result: 'bestblockhash'
						});
					},
					getBlock: function(hash, callback) {
						if (hash === 'bestblockhash') {
							callback(null, {
								result: {
									height: 5000
								}
							});
						}
					},
					getBlockHash: function(num, callback) {
						callback(null, {
							result: 'genesishash'
						});
					}
				}
			});
			qtumd._initChain(function() {
				log.info.callCount.should.equal(1);
				qtumd.getRawBlock.callCount.should.equal(1);
				qtumd.getRawBlock.args[0][0].should.equal('genesishash');
				qtumd.height.should.equal(5000);
				qtumd.genesisBuffer.should.equal(genesisBuffer);
				done();
			});
		});
		it('it will handle error from getBestBlockHash', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBestBlockHash = sinon.stub().callsArgWith(0, { code: -1, message: 'error' });
			qtumd.nodes.push({
				client: {
					getBestBlockHash: getBestBlockHash
				}
			});
			qtumd._initChain(function(err) {
				getBestBlockHash.callCount.should.equal(1);
				err.should.be.instanceOf(Error);
				done();
			});
		});
		it('it will handle error from getBlock', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBestBlockHash = sinon.stub().callsArgWith(0, null, {});
			var getBlock = sinon.stub().callsArgWith(1, { code: -1, message: 'error' });
			qtumd.nodes.push({
				client: {
					getBestBlockHash: getBestBlockHash,
					getBlock: getBlock
				}
			});
			qtumd._initChain(function(err) {
				getBestBlockHash.callCount.should.equal(1);
				getBlock.callCount.should.equal(1);
				err.should.be.instanceOf(Error);
				done();
			});
		});
		it('it will handle error from getBlockHash', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBestBlockHash = sinon.stub().callsArgWith(0, null, {});
			var getBlock = sinon.stub().callsArgWith(1, null, {
				result: {
					height: 10
				}
			});
			var getBlockHash = sinon.stub().callsArgWith(1, { code: -1, message: 'error' });
			qtumd.nodes.push({
				client: {
					getBestBlockHash: getBestBlockHash,
					getBlock: getBlock,
					getBlockHash: getBlockHash
				}
			});
			qtumd._initChain(function(err) {
				err.should.be.instanceOf(Error);
				getBestBlockHash.callCount.should.equal(1);
				getBlock.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				done();
			});
		});
		it('it will handle error from getRawBlock', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBestBlockHash = sinon.stub().callsArgWith(0, null, {});
			var getBlock = sinon.stub().callsArgWith(1, null, {
				result: {
					height: 10
				}
			});
			var getBlockHash = sinon.stub().callsArgWith(1, null, {});
			qtumd.nodes.push({
				client: {
					getBestBlockHash: getBestBlockHash,
					getBlock: getBlock,
					getBlockHash: getBlockHash
				}
			});
			qtumd.getRawBlock = sinon.stub().callsArgWith(1, new Error('test'));
			qtumd._initChain(function(err) {
				err.should.be.instanceOf(Error);
				getBestBlockHash.callCount.should.equal(1);
				getBlock.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				qtumd.getRawBlock.callCount.should.equal(1);
				done();
			});
		});
	});

	describe('#_getDefaultConf', function() {
		afterEach(function() {
			qtumcore.Networks.disableRegtest();
			baseConfig.node.network = qtumcore.Networks.testnet;
		});
		it('will get default rpc port for livenet', function() {
			var config = {
				node: {
					network: qtumcore.Networks.livenet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var qtumd = new QtumService(config);
			qtumd._getDefaultConf().rpcport.should.equal(8332);
		});
		it('will get default rpc port for testnet', function() {
			var config = {
				node: {
					network: qtumcore.Networks.testnet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var qtumd = new QtumService(config);
			qtumd._getDefaultConf().rpcport.should.equal(18332);
		});
		it('will get default rpc port for regtest', function() {
			qtumcore.Networks.enableRegtest();
			var config = {
				node: {
					network: qtumcore.Networks.testnet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var qtumd = new QtumService(config);
			qtumd._getDefaultConf().rpcport.should.equal(18332);
		});
	});

	describe('#_getNetworkConfigPath', function() {
		afterEach(function() {
			qtumcore.Networks.disableRegtest();
			baseConfig.node.network = qtumcore.Networks.testnet;
		});
		it('will get default config path for livenet', function() {
			var config = {
				node: {
					network: qtumcore.Networks.livenet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var qtumd = new QtumService(config);
			should.equal(qtumd._getNetworkConfigPath(), undefined);
		});
		it('will get default rpc port for testnet', function() {
			var config = {
				node: {
					network: qtumcore.Networks.testnet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var qtumd = new QtumService(config);
			qtumd._getNetworkConfigPath().should.equal('testnet3/qtum.conf');
		});
		it('will get default rpc port for regtest', function() {
			qtumcore.Networks.enableRegtest();
			var config = {
				node: {
					network: qtumcore.Networks.testnet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var qtumd = new QtumService(config);
			qtumd._getNetworkConfigPath().should.equal('regtest/qtum.conf');
		});
	});

	describe('#_getNetworkOption', function() {
		afterEach(function() {
			qtumcore.Networks.disableRegtest();
			baseConfig.node.network = qtumcore.Networks.testnet;
		});
		it('return --testnet for testnet', function() {
			var qtumd = new QtumService(baseConfig);
			qtumd.node.network = qtumcore.Networks.testnet;
			qtumd._getNetworkOption().should.equal('--testnet');
		});
		it('return --regtest for testnet', function() {
			var qtumd = new QtumService(baseConfig);
			qtumd.node.network = qtumcore.Networks.testnet;
			qtumcore.Networks.enableRegtest();
			qtumd._getNetworkOption().should.equal('--regtest');
		});
		it('return undefined for livenet', function() {
			var qtumd = new QtumService(baseConfig);
			qtumd.node.network = qtumcore.Networks.livenet;
			qtumcore.Networks.enableRegtest();
			should.equal(qtumd._getNetworkOption(), undefined);
		});
	});

	describe('#_zmqBlockHandler', function() {
		it('will emit block', function(done) {
			var qtumd = new QtumService(baseConfig);
			var node = {};
			var message = new Buffer('76843f1dfe455347d897e757ff5ff51a16a0f62b5d02a659c5680392de3a2b89', 'hex');
			qtumd._rapidProtectedUpdateTip = sinon.stub();
			qtumd.on('block', function(block) {
				block.should.equal(message);
				done();
			});
			qtumd._zmqBlockHandler(node, message);
			qtumd._rapidProtectedUpdateTip.callCount.should.equal(1);
		});
		it('will not emit same block twice', function(done) {
			var qtumd = new QtumService(baseConfig);
			var node = {};
			var message = new Buffer('76843f1dfe455347d897e757ff5ff51a16a0f62b5d02a659c5680392de3a2b89', 'hex');
			qtumd._rapidProtectedUpdateTip = sinon.stub();
			sinon.spy(qtumd, 'emit');
			qtumd.on('block', function(block) {
				block.should.equal(message);
				qtumd.emit.callCount.should.equal(1);
				qtumd._rapidProtectedUpdateTip.callCount.should.equal(1);
				done();
			});
			qtumd._zmqBlockHandler(node, message);
			qtumd._zmqBlockHandler(node, message);
		});
		it('will call function to update tip', function() {
			var qtumd = new QtumService(baseConfig);
			var node = {};
			var message = new Buffer('76843f1dfe455347d897e757ff5ff51a16a0f62b5d02a659c5680392de3a2b89', 'hex');
			qtumd._rapidProtectedUpdateTip = sinon.stub();
			qtumd._zmqBlockHandler(node, message);
			qtumd._rapidProtectedUpdateTip.callCount.should.equal(1);
			qtumd._rapidProtectedUpdateTip.args[0][0].should.equal(node);
			qtumd._rapidProtectedUpdateTip.args[0][1].should.equal(message);
		});
		it('will emit to subscribers', function(done) {
			var qtumd = new QtumService(baseConfig);
			var node = {};
			var message = new Buffer('76843f1dfe455347d897e757ff5ff51a16a0f62b5d02a659c5680392de3a2b89', 'hex');
			qtumd._rapidProtectedUpdateTip = sinon.stub();
			sinon.spy(qtumd, 'emit');
			var emitter = new EventEmitter();
			qtumd.subscriptions.hashblock.push(emitter);
			emitter.on('qtumd/hashblock', function(blockHash) {
				qtumd._rapidProtectedUpdateTip.callCount.should.equal(1);
				qtumd.emit.callCount.should.equal(1);
				blockHash.should.equal(message.toString('hex'));
				done();
			});
			qtumd._zmqBlockHandler(node, message);
		});
	});

	describe('#_rapidProtectedUpdateTip', function() {
		it('will limit tip updates with rapid calls', function(done) {
			var qtumd = new QtumService(baseConfig);
			var callCount = 0;
			qtumd._updateTip = function() {
				callCount++;
				callCount.should.be.within(1, 2);
				if (callCount > 1) {
					done();
				}
			};
			var node = {};
			var message = new Buffer('76843f1dfe455347d897e757ff5ff51a16a0f62b5d02a659c5680392de3a2b89', 'hex');
			var count = 0;
			function repeat() {
				qtumd._rapidProtectedUpdateTip(node, message);
				count++;
				if (count < 50) {
					repeat();
				}
			}
			repeat();
		});
	});

	describe('#_updateTip', function() {
		var sandbox = sinon.sandbox.create();
		var message = new Buffer('76843f1dfe455347d897e757ff5ff51a16a0f62b5d02a659c5680392de3a2b89', 'hex');
		beforeEach(function() {
			sandbox.stub(log, 'error');
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('log and emit rpc error from get block', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.syncPercentage = sinon.stub();
			sinon.spy(qtumd, '_resetCaches');
			qtumd.on('error', function(err) {
				err.code.should.equal(-1);
				err.message.should.equal('Test error');
				node.client.getBlock.callCount.should.equal(1);
				qtumd._resetCaches.callCount.should.equal(1);
				log.error.callCount.should.equal(1);
				done();
			});
			var node = {
				client: {
					getBlock: sinon.stub().callsArgWith(1, { message: 'Test error', code: -1 })
				}
			};
			qtumd._updateTip(node, message);
		});
		it('emit synced if percentage is 100', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.syncPercentage = sinon.stub().callsArgWith(0, null, 100);
			qtumd.on('synced', function() {
				qtumd.syncPercentage.callCount.should.equal(1);
				node.client.getBlock.callCount.should.equal(1);
				done();
			});
			var node = {
				client: {
					getBlock: sinon.stub()
				}
			};
			qtumd._updateTip(node, message);
		});
		it('NOT emit synced if percentage is less than 100', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.syncPercentage = sinon.stub().callsArgWith(0, null, 99);
			qtumd.on('synced', function() {
				qtumd.syncPercentage.callCount.should.equal(0);
				node.client.getBlock.callCount.should.equal(1);
				throw new Error('Synced called');
			});
			var node = {
				client: {
					getBlock: sinon.stub()
				}
			};
			qtumd._updateTip(node, message);
			log.info.callCount.should.equal(1);
			done();
		});
		it('log and emit error from syncPercentage', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.syncPercentage = sinon.stub().callsArgWith(0, new Error('test'));
			qtumd.on('error', function(err) {
				log.error.callCount.should.equal(1);
				qtumd.syncPercentage.callCount.should.equal(1);
				node.client.getBlock.callCount.should.equal(1);
				err.message.should.equal('test');
				done();
			});
			var node = {
				client: {
					getBlock: sinon.stub()
				}
			};
			qtumd._updateTip(node, message);
		});
		it('reset caches and set height', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.syncPercentage = sinon.stub();
			qtumd._resetCaches = sinon.stub();
			qtumd.on('tip', function(height) {
				qtumd._resetCaches.callCount.should.equal(1);
				height.should.equal(10);
				qtumd.height.should.equal(10);
				done();
			});
			var node = {
				client: {
					getBlock: sinon.stub().callsArgWith(1, null, {
						result: {
							height: 10
						}
					})
				}
			};
			qtumd._updateTip(node, message);
		});
		it('will NOT update twice for the same hash', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, 'emit');
			qtumd.syncPercentage = sinon.stub();
			qtumd._resetCaches = sinon.stub();
			qtumd.on('tip', function() {
				qtumd._resetCaches.callCount.should.equal(1);
				done();
			});
			var node = {
				client: {
					getBlock: sinon.stub().callsArgWith(1, null, {
						result: {
							height: 10
						}
					})
				}
			};
			qtumd._updateTip(node, message);
			qtumd._updateTip(node, message);
		});
		it('will not call syncPercentage if node is stopping', function(done) {
			var config = {
				node: {
					network: qtumcore.Networks.testnet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var qtumd = new QtumService(config);
			qtumd.syncPercentage = sinon.stub();
			qtumd._resetCaches = sinon.stub();
			qtumd.node.stopping = true;
			var node = {
				client: {
					getBlock: sinon.stub().callsArgWith(1, null, {
						result: {
							height: 10
						}
					})
				}
			};
			qtumd.on('tip', function() {
				qtumd.syncPercentage.callCount.should.equal(0);
				done();
			});
			qtumd._updateTip(node, message);
		});
	});

	describe('#_getAddressesFromTransaction', function() {
		it('will get results using qtumcore.Transaction', function() {
			var qtumd = new QtumService(baseConfig);
			var wif = 'cVTiUNavxbCzuoaQboDcgEhKYHhgXRaeQ8ZRoYkVXE9mxT1TcSrc';
			var privkey = qtumcore.PrivateKey.fromWIF(wif);
			var inputAddress = privkey.toAddress(qtumcore.Networks.testnet);
			var outputAddress = qtumcore.Address('qMDYc9oXQK19dmLSCQNs5okRt8z4XeMr1X');
			var tx = qtumcore.Transaction();
			tx.from({
				txid: '63ea7d22cb412283f4c6964a0fddebf3069f2e8a4761e86b5d0e2a39b0e84e5c',
				outputIndex: 0,
				script: qtumcore.Script(inputAddress),
				address: inputAddress.toString(),
				satoshis: 5000000000
			});
			tx.to(outputAddress, 5000000000);
			tx.sign(privkey);
			var addresses = qtumd._getAddressesFromTransaction(tx);
			addresses.length.should.equal(2);
			addresses[0].should.equal(inputAddress.toString());
			addresses[1].should.equal(outputAddress.toString());
		});
		it('will handle non-standard script types', function() {
			var qtumd = new QtumService(baseConfig);
			var tx = qtumcore.Transaction();
			tx.addInput(qtumcore.Transaction.Input({
				prevTxId: '63ea7d22cb412283f4c6964a0fddebf3069f2e8a4761e86b5d0e2a39b0e84e5c',
				script: qtumcore.Script('OP_TRUE'),
				outputIndex: 1,
				output: {
					script: qtumcore.Script('OP_TRUE'),
					satoshis: 5000000000
				}
			}));
			tx.addOutput(qtumcore.Transaction.Output({
				script: qtumcore.Script('OP_TRUE'),
				satoshis: 5000000000
			}));
			var addresses = qtumd._getAddressesFromTransaction(tx);
			addresses.length.should.equal(0);
		});
		it('will handle unparsable script types or missing input script', function() {
			var qtumd = new QtumService(baseConfig);
			var tx = qtumcore.Transaction();
			tx.addOutput(qtumcore.Transaction.Output({
				script: new Buffer('4c', 'hex'),
				satoshis: 5000000000
			}));
			var addresses = qtumd._getAddressesFromTransaction(tx);
			addresses.length.should.equal(0);
		});
		it('will return unique values', function() {
			var qtumd = new QtumService(baseConfig);
			var tx = qtumcore.Transaction();
			var address = qtumcore.Address('qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX');
			tx.addOutput(qtumcore.Transaction.Output({
				script: qtumcore.Script(address),
				satoshis: 5000000000
			}));
			tx.addOutput(qtumcore.Transaction.Output({
				script: qtumcore.Script(address),
				satoshis: 5000000000
			}));
			var addresses = qtumd._getAddressesFromTransaction(tx);
			addresses.length.should.equal(1);
		});
	});

	describe('#_notifyAddressTxidSubscribers', function() {
		it('will emit event if matching addresses', function(done) {
			var qtumd = new QtumService(baseConfig);
			var address = 'qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z';
			qtumd._getAddressesFromTransaction = sinon.stub().returns([address]);
			var emitter = new EventEmitter();
			qtumd.subscriptions.address[address] = [emitter];
			var txid = 'a9f5d9dc39bfff65c12d8a7a8263f57cc187d4c6cc62815d65186726bbc5ecb5';
			var transaction = {};
			emitter.on('qtumd/addresstxid', function(data) {
				data.address.should.equal(address);
				data.txid.should.equal(txid);
				emitter.emit.callCount.should.equal(1);
				done();
			});
			sinon.spy(emitter, 'emit');
			qtumd._notifyAddressTxidSubscribers(txid, transaction);
		});
		it('will NOT emit event without matching addresses', function() {
			var qtumd = new QtumService(baseConfig);
			var address = 'qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z';
			qtumd._getAddressesFromTransaction = sinon.stub().returns([address]);
			var emitter = new EventEmitter();
			var txid = 'a9f5d9dc39bfff65c12d8a7a8263f57cc187d4c6cc62815d65186726bbc5ecb5';
			var transaction = {};
			emitter.emit = sinon.stub();
			qtumd._notifyAddressTxidSubscribers(txid, transaction);
			emitter.emit.callCount.should.equal(0);
		});
	});

	describe('#_zmqTransactionHandler', function() {
		it('will emit to subscribers', function(done) {
			var qtumd = new QtumService(baseConfig);
			var expectedBuffer = new Buffer(txhex, 'hex');
			var emitter = new EventEmitter();
			qtumd.subscriptions.rawtransaction.push(emitter);
			emitter.on('qtumd/rawtransaction', function(hex) {
				hex.should.be.a('string');
				hex.should.equal(expectedBuffer.toString('hex'));
				done();
			});
			var node = {};
			qtumd._zmqTransactionHandler(node, expectedBuffer);
		});
		it('will NOT emit to subscribers more than once for the same tx', function(done) {
			var qtumd = new QtumService(baseConfig);
			var expectedBuffer = new Buffer(txhex, 'hex');
			var emitter = new EventEmitter();
			sinon.spy(qtumd, 'emit');
			qtumd.subscriptions.rawtransaction.push(emitter);
			emitter.on('qtumd/rawtransaction', function() {
				done();
			});
			var node = {};
			qtumd._zmqTransactionHandler(node, expectedBuffer);
			qtumd._zmqTransactionHandler(node, expectedBuffer);
		});
		it('will emit "tx" event', function(done) {
			var qtumd = new QtumService(baseConfig);
			var expectedBuffer = new Buffer(txhex, 'hex');
			qtumd.on('tx', function(buffer) {
				buffer.should.be.instanceof(Buffer);
				buffer.toString('hex').should.equal(expectedBuffer.toString('hex'));
				done();
			});
			var node = {};
			qtumd._zmqTransactionHandler(node, expectedBuffer);
		});
		it('will NOT emit "tx" event more than once for the same tx', function(done) {
			var qtumd = new QtumService(baseConfig);
			var expectedBuffer = new Buffer(txhex, 'hex');
			qtumd.on('tx', function() {
				done();
			});
			var node = {};
			qtumd._zmqTransactionHandler(node, expectedBuffer);
			qtumd._zmqTransactionHandler(node, expectedBuffer);
		});
	});

	describe('#_checkSyncedAndSubscribeZmqEvents', function() {
		var sandbox = sinon.sandbox.create();
		before(function() {
			sandbox.stub(log, 'error');
		});
		after(function() {
			sandbox.restore();
		});
		it('log errors, update tip and subscribe to zmq events', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._updateTip = sinon.stub();
			qtumd._subscribeZmqEvents = sinon.stub();
			var blockEvents = 0;
			qtumd.on('block', function() {
				blockEvents++;
			});
			var getBestBlockHash = sinon.stub().callsArgWith(0, null, {
				result: '76843f1dfe455347d897e757ff5ff51a16a0f62b5d02a659c5680392de3a2b89'
			});
			getBestBlockHash.onCall(0).callsArgWith(0, { code: -1, message: 'Test error' });
			var progress = 0.90;
			function getProgress() {
				progress = progress + 0.01;
				return progress;
			}
			var info = {};
			Object.defineProperty(info, 'result', {
				get: function() {
					return {
						verificationprogress: getProgress()
					};
				}
			});
			var getBlockchainInfo = sinon.stub().callsArgWith(0, null, info);
			getBlockchainInfo.onCall(0).callsArgWith(0, { code: -1, message: 'Test error' });
			var node = {
				_reindex: true,
				_reindexWait: 1,
				_tipUpdateInterval: 1,
				client: {
					getBestBlockHash: getBestBlockHash,
					getBlockchainInfo: getBlockchainInfo
				}
			};
			qtumd._checkSyncedAndSubscribeZmqEvents(node);
			setTimeout(function() {
				log.error.callCount.should.equal(2);
				blockEvents.should.equal(11);
				getBestBlockHash.callCount.should.equal(12);
				getBlockchainInfo.callCount.should.equal(11);
				qtumd._updateTip.callCount.should.equal(11);
				qtumd._subscribeZmqEvents.callCount.should.equal(1);
				done();
			}, 200);
		});
		it('it will clear interval if node is stopping', function(done) {
			var config = {
				node: {
					network: qtumcore.Networks.testnet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var qtumd = new QtumService(config);
			var getBestBlockHash = sinon.stub().callsArgWith(0, { code: -1, message: 'error' });
			var node = {
				_tipUpdateInterval: 1,
				client: {
					getBestBlockHash: getBestBlockHash
				}
			};
			qtumd._checkSyncedAndSubscribeZmqEvents(node);
			setTimeout(function() {
				qtumd.node.stopping = true;
				var count = getBestBlockHash.callCount;
				setTimeout(function() {
					getBestBlockHash.callCount.should.equal(count);
					done();
				}, 100);
			}, 100);
		});

		it('will not set interval if synced is true', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._updateTip = sinon.stub();
			qtumd._subscribeZmqEvents = sinon.stub();
			var getBestBlockHash = sinon.stub().callsArgWith(0, null, {
				result: 'fa1e9c65bce09d3bf7e067e1053779ae7dd7742c3dbba2e6c82dc7783a21fb2c'
			});
			var info = {
				result: {
					verificationprogress: 1.00
				}
			};
			var getBlockchainInfo = sinon.stub().callsArgWith(0, null, info);
			var node = {
				_tipUpdateInterval: 1,
				client: {
					getBestBlockHash: getBestBlockHash,
					getBlockchainInfo: getBlockchainInfo
				}
			};
			qtumd._checkSyncedAndSubscribeZmqEvents(node);
			setTimeout(function() {
				getBestBlockHash.callCount.should.equal(1);
				getBlockchainInfo.callCount.should.equal(1);
				done();
			}, 200);
		});
	});

	describe('#_subscribeZmqEvents', function() {
		it('will call subscribe on zmq socket', function() {
			var qtumd = new QtumService(baseConfig);
			var node = {
				zmqSubSocket: {
					subscribe: sinon.stub(),
					on: sinon.stub()
				}
			};
			qtumd._subscribeZmqEvents(node);
			node.zmqSubSocket.subscribe.callCount.should.equal(2);
			node.zmqSubSocket.subscribe.args[0][0].should.equal('hashblock');
			node.zmqSubSocket.subscribe.args[1][0].should.equal('rawtx');
		});

		it('will call relevant handler for rawtx topics', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._zmqTransactionHandler = sinon.stub();
			var node = {
				zmqSubSocket: new EventEmitter()
			};
			node.zmqSubSocket.subscribe = sinon.stub();
			qtumd._subscribeZmqEvents(node);
			node.zmqSubSocket.on('message', function() {
				qtumd._zmqTransactionHandler.callCount.should.equal(1);
				done();
			});
			var topic = new Buffer('rawtx', 'utf8');
			var message = new Buffer('abcdef', 'hex');
			node.zmqSubSocket.emit('message', topic, message);
		});
		it('will call relevant handler for hashblock topics', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._zmqBlockHandler = sinon.stub();
			var node = {
				zmqSubSocket: new EventEmitter()
			};
			node.zmqSubSocket.subscribe = sinon.stub();
			qtumd._subscribeZmqEvents(node);
			node.zmqSubSocket.on('message', function() {
				qtumd._zmqBlockHandler.callCount.should.equal(1);
				done();
			});
			var topic = new Buffer('hashblock', 'utf8');
			var message = new Buffer('abcdef', 'hex');
			node.zmqSubSocket.emit('message', topic, message);
		});
		it('will ignore unknown topic types', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._zmqBlockHandler = sinon.stub();
			qtumd._zmqTransactionHandler = sinon.stub();
			var node = {
				zmqSubSocket: new EventEmitter()
			};
			node.zmqSubSocket.subscribe = sinon.stub();
			qtumd._subscribeZmqEvents(node);
			node.zmqSubSocket.on('message', function() {
				qtumd._zmqBlockHandler.callCount.should.equal(0);
				qtumd._zmqTransactionHandler.callCount.should.equal(0);
				done();
			});
			var topic = new Buffer('unknown', 'utf8');
			var message = new Buffer('abcdef', 'hex');
			node.zmqSubSocket.emit('message', topic, message);
		});
	});

	describe('#_initZmqSubSocket', function() {
		it('will setup zmq socket', function() {
			var socket = new EventEmitter();
			socket.monitor = sinon.stub();
			socket.connect = sinon.stub();
			var socketFunc = function() {
				return socket;
			};
			var QtumService = proxyquire('../../lib/services/qtumd', {
				zmq: {
					socket: socketFunc
				}
			});
			var qtumd = new QtumService(baseConfig);
			var node = {};
			qtumd._initZmqSubSocket(node, 'url');
			node.zmqSubSocket.should.equal(socket);
			socket.connect.callCount.should.equal(1);
			socket.connect.args[0][0].should.equal('url');
			socket.monitor.callCount.should.equal(1);
			socket.monitor.args[0][0].should.equal(500);
			socket.monitor.args[0][1].should.equal(0);
		});
	});

	describe('#_checkReindex', function() {
		var sandbox = sinon.sandbox.create();
		before(function() {
			sandbox.stub(log, 'info');
		});
		after(function() {
			sandbox.restore();
		});
		it('give error from client getblockchaininfo', function(done) {
			var qtumd = new QtumService(baseConfig);
			var node = {
				_reindex: true,
				_reindexWait: 1,
				client: {
					getBlockchainInfo: sinon.stub().callsArgWith(0, { code: -1, message: 'Test error' })
				}
			};
			qtumd._checkReindex(node, function(err) {
				should.exist(err);
				node.client.getBlockchainInfo.callCount.should.equal(1);
				err.should.be.instanceof(errors.RPCError);
				done();
			});
		});
		it('will wait until sync is 100 percent', function(done) {
			var qtumd = new QtumService(baseConfig);
			var percent = 0.89;
			var node = {
				_reindex: true,
				_reindexWait: 10,
				client: {
					getBlockchainInfo: function(callback) {
						percent += 0.01;
						callback(null, {
							result: {
								verificationprogress: percent
							}
						});
					}
				}
			};
			qtumd._checkReindex(node, function() {
				node._reindex.should.equal(false);
				log.info.callCount.should.equal(11);
				done();
			});
		});
		it('will call callback if reindex is not enabled', function(done) {
			var qtumd = new QtumService(baseConfig);
			var node = {
				_reindex: false
			};
			qtumd._checkReindex(node, function() {
				node._reindex.should.equal(false);
				done();
			});
		});
	});

	describe('#_loadTipFromNode', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'warn');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will give rpc error from client getbestblockhash', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBestBlockHash = sinon.stub().callsArgWith(0, { code: -1, message: 'Test error' });
			var node = {
				client: {
					getBestBlockHash: getBestBlockHash
				}
			};
			qtumd._loadTipFromNode(node, function(err) {
				err.should.be.instanceof(Error);
				log.warn.callCount.should.equal(0);
				done();
			});
		});
		it('will give rpc error from client getblock', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBestBlockHash = sinon.stub().callsArgWith(0, null, {
				result: '45c766f3deda5027e99df3f4b437ca1874143efdddcc09261f9e7466a4b38629'
			});
			var getBlock = sinon.stub().callsArgWith(1, new Error('Test error'));
			var node = {
				client: {
					getBestBlockHash: getBestBlockHash,
					getBlock: getBlock
				}
			};
			qtumd._loadTipFromNode(node, function(err) {
				getBlock.args[0][0].should.equal('45c766f3deda5027e99df3f4b437ca1874143efdddcc09261f9e7466a4b38629');
				err.should.be.instanceof(Error);
				log.warn.callCount.should.equal(0);
				done();
			});
		});
		it('will log when error is RPC_IN_WARMUP', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBestBlockHash = sinon.stub().callsArgWith(0, { code: -28, message: 'Verifying blocks...' });
			var node = {
				client: {
					getBestBlockHash: getBestBlockHash
				}
			};
			qtumd._loadTipFromNode(node, function(err) {
				err.should.be.instanceof(Error);
				log.warn.callCount.should.equal(1);
				done();
			});
		});
		it('will set height and emit tip', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBestBlockHash = sinon.stub().callsArgWith(0, null, {
				result: '45c766f3deda5027e99df3f4b437ca1874143efdddcc09261f9e7466a4b38629'
			});
			var getBlock = sinon.stub().callsArgWith(1, null, {
				result: {
					height: 100
				}
			});
			var node = {
				client: {
					getBestBlockHash: getBestBlockHash,
					getBlock: getBlock
				}
			};
			qtumd.on('tip', function(height) {
				node.client.getBestBlockHash.callCount.should.equal(1);
				node.client.getBlock.callCount.should.equal(1);
				height.should.equal(100);
				qtumd.height.should.equal(100);
				done();
			});
			qtumd._loadTipFromNode(node, function(err) {
				if (err) {
					return done(err);
				}
			});
		});
	});

	describe('#_stopSpawnedProcess', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'warn');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('it will kill process and resume', function(done) {
			var readFile = sandbox.stub();
			readFile.onCall(0).callsArgWith(2, null, '4321');
			var error = new Error('Test error');
			error.code = 'ENOENT';
			readFile.onCall(1).callsArgWith(2, error);
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFile: readFile
				}
			});
			var qtumd = new TestQtumService(baseConfig);
			qtumd.spawnStopTime = 1;
			qtumd._process = {};
			qtumd._process.kill = sinon.stub();
			qtumd._stopSpawnedBitcoin(function(err) {
				if (err) {
					return done(err);
				}
				qtumd._process.kill.callCount.should.equal(1);
				log.warn.callCount.should.equal(1);
				done();
			});
		});
		it('it will attempt to kill process and resume', function(done) {
			var readFile = sandbox.stub();
			readFile.onCall(0).callsArgWith(2, null, '4321');
			var error = new Error('Test error');
			error.code = 'ENOENT';
			readFile.onCall(1).callsArgWith(2, error);
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFile: readFile
				}
			});
			var qtumd = new TestQtumService(baseConfig);
			qtumd.spawnStopTime = 1;
			qtumd._process = {};
			var error2 = new Error('Test error');
			error2.code = 'ESRCH';
			qtumd._process.kill = sinon.stub().throws(error2);
			qtumd._stopSpawnedBitcoin(function(err) {
				if (err) {
					return done(err);
				}
				qtumd._process.kill.callCount.should.equal(1);
				log.warn.callCount.should.equal(2);
				done();
			});
		});
		it('it will attempt to kill process with NaN', function(done) {
			var readFile = sandbox.stub();
			readFile.onCall(0).callsArgWith(2, null, '     ');
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFile: readFile
				}
			});
			var qtumd = new TestQtumService(baseConfig);
			qtumd.spawnStopTime = 1;
			qtumd._process = {};
			qtumd._process.kill = sinon.stub();
			qtumd._stopSpawnedBitcoin(function(err) {
				if (err) {
					return done(err);
				}
				done();
			});
		});
		it('it will attempt to kill process without pid', function(done) {
			var readFile = sandbox.stub();
			readFile.onCall(0).callsArgWith(2, null, '');
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFile: readFile
				}
			});
			var qtumd = new TestQtumService(baseConfig);
			qtumd.spawnStopTime = 1;
			qtumd._process = {};
			qtumd._process.kill = sinon.stub();
			qtumd._stopSpawnedBitcoin(function(err) {
				if (err) {
					return done(err);
				}
				done();
			});
		});
	});

	describe('#_spawnChildProcess', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
			sandbox.stub(log, 'warn');
			sandbox.stub(log, 'error');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will give error from spawn config', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._loadSpawnConfiguration = sinon.stub();
			qtumd._loadSpawnConfiguration = sinon.stub().throws(new Error('test'));
			qtumd._spawnChildProcess(function(err) {
				qtumd._loadSpawnConfiguration.callCount.should.equal(1);
				err.should.be.instanceof(Error);
				err.message.should.equal('test');
				done();
			});
		});
		it('will give error from stopSpawnedBitcoin', function() {
			var qtumd = new QtumService(baseConfig);
			qtumd._loadSpawnConfiguration = sinon.stub();
			qtumd._stopSpawnedBitcoin = sinon.stub().callsArgWith(0, new Error('test'));
			qtumd._spawnChildProcess(function(err) {
				qtumd._loadSpawnConfiguration.callCount.should.equal(1);
				qtumd._stopSpawnedBitcoin.callCount.should.equal(1);
				err.should.be.instanceOf(Error);
				err.message.should.equal('test');
			});
		});
		it('will exit spawn if shutdown', function() {
			var config = {
				node: {
					network: qtumcore.Networks.testnet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var process = new EventEmitter();
			var spawn = sinon.stub().returns(process);
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFileSync: readFileSync
				},
				child_process: {
					spawn: spawn
				}
			});
			var qtumd = new TestQtumService(config);
			qtumd.spawn = {};
			qtumd._loadSpawnConfiguration = sinon.stub();
			qtumd._stopSpawnedBitcoin = sinon.stub().callsArgWith(0, null);
			qtumd.node.stopping = true;
			qtumd._spawnChildProcess(function(err) {
				err.should.be.instanceOf(Error);
				err.message.should.match(/Stopping while trying to spawn/);
			});
		});
		it('will include network with spawn command and init zmq/rpc on node', function(done) {
			var process = new EventEmitter();
			var spawn = sinon.stub().returns(process);
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFileSync: readFileSync
				},
				child_process: {
					spawn: spawn
				}
			});
			var qtumd = new TestQtumService(baseConfig);

			qtumd._loadSpawnConfiguration = sinon.stub();
			qtumd.spawn = {};
			qtumd.spawn.exec = 'testexec';
			qtumd.spawn.configPath = 'testdir/qtum.conf';
			qtumd.spawn.datadir = 'testdir';
			qtumd.spawn.config = {};
			qtumd.spawn.config.rpcport = 20001;
			qtumd.spawn.config.rpcuser = 'qtum';
			qtumd.spawn.config.rpcpassword = 'password';
			qtumd.spawn.config.zmqpubrawtx = 'tcp://127.0.0.1:30001';

			qtumd._loadTipFromNode = sinon.stub().callsArgWith(1, null);
			qtumd._initZmqSubSocket = sinon.stub();
			qtumd._checkSyncedAndSubscribeZmqEvents = sinon.stub();
			qtumd._checkReindex = sinon.stub().callsArgWith(1, null);
			qtumd._spawnChildProcess(function(err, node) {
				should.not.exist(err);
				spawn.callCount.should.equal(1);
				spawn.args[0][0].should.equal('testexec');
				spawn.args[0][1].should.deep.equal([
					'--conf=testdir/qtum.conf',
					'--datadir=testdir',
					'--testnet'
				]);
				spawn.args[0][2].should.deep.equal({
					stdio: 'inherit'
				});
				qtumd._loadTipFromNode.callCount.should.equal(1);
				qtumd._initZmqSubSocket.callCount.should.equal(1);
				should.exist(qtumd._initZmqSubSocket.args[0][0].client);
				qtumd._initZmqSubSocket.args[0][1].should.equal('tcp://127.0.0.1:30001');
				qtumd._checkSyncedAndSubscribeZmqEvents.callCount.should.equal(1);
				should.exist(qtumd._checkSyncedAndSubscribeZmqEvents.args[0][0].client);
				should.exist(node);
				should.exist(node.client);
				done();
			});
		});
		it('will respawn qtumd spawned process', function(done) {
			var process = new EventEmitter();
			var spawn = sinon.stub().returns(process);
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFileSync: readFileSync
				},
				child_process: {
					spawn: spawn
				}
			});
			var qtumd = new TestQtumService(baseConfig);
			qtumd._loadSpawnConfiguration = sinon.stub();
			qtumd.spawn = {};
			qtumd.spawn.exec = 'qtumd';
			qtumd.spawn.datadir = '/tmp/qtum';
			qtumd.spawn.configPath = '/tmp/qtum/qtum.conf';
			qtumd.spawn.config = {};
			qtumd.spawnRestartTime = 1;
			qtumd._loadTipFromNode = sinon.stub().callsArg(1);
			qtumd._initZmqSubSocket = sinon.stub();
			qtumd._checkReindex = sinon.stub().callsArg(1);
			qtumd._checkSyncedAndSubscribeZmqEvents = sinon.stub();
			qtumd._stopSpawnedBitcoin = sinon.stub().callsArg(0);
			sinon.spy(qtumd, '_spawnChildProcess');
			qtumd._spawnChildProcess(function(err) {
				if (err) {
					return done(err);
				}
				process.once('exit', function() {
					setTimeout(function() {
						qtumd._spawnChildProcess.callCount.should.equal(2);
						done();
					}, 5);
				});
				process.emit('exit', 1);
			});
		});
		it('will emit error during respawn', function(done) {
			var process = new EventEmitter();
			var spawn = sinon.stub().returns(process);
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFileSync: readFileSync
				},
				child_process: {
					spawn: spawn
				}
			});
			var qtumd = new TestQtumService(baseConfig);
			qtumd._loadSpawnConfiguration = sinon.stub();
			qtumd.spawn = {};
			qtumd.spawn.exec = 'qtumd';
			qtumd.spawn.datadir = '/tmp/qtum';
			qtumd.spawn.configPath = '/tmp/qtum/qtum.conf';
			qtumd.spawn.config = {};
			qtumd.spawnRestartTime = 1;
			qtumd._loadTipFromNode = sinon.stub().callsArg(1);
			qtumd._initZmqSubSocket = sinon.stub();
			qtumd._checkReindex = sinon.stub().callsArg(1);
			qtumd._checkSyncedAndSubscribeZmqEvents = sinon.stub();
			qtumd._stopSpawnedBitcoin = sinon.stub().callsArg(0);
			sinon.spy(qtumd, '_spawnChildProcess');
			qtumd._spawnChildProcess(function(err) {
				if (err) {
					return done(err);
				}
				qtumd._spawnChildProcess = sinon.stub().callsArgWith(0, new Error('test'));
				qtumd.on('error', function(err) {
					err.should.be.instanceOf(Error);
					err.message.should.equal('test');
					done();
				});
				process.emit('exit', 1);
			});
		});
		it('will NOT respawn qtumd spawned process if shutting down', function(done) {
			var process = new EventEmitter();
			var spawn = sinon.stub().returns(process);
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFileSync: readFileSync
				},
				child_process: {
					spawn: spawn
				}
			});
			var config = {
				node: {
					network: qtumcore.Networks.testnet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var qtumd = new TestQtumService(config);
			qtumd._loadSpawnConfiguration = sinon.stub();
			qtumd.spawn = {};
			qtumd.spawn.exec = 'qtumd';
			qtumd.spawn.datadir = '/tmp/qtum';
			qtumd.spawn.configPath = '/tmp/qtum/qtum.conf';
			qtumd.spawn.config = {};
			qtumd.spawnRestartTime = 1;
			qtumd._loadTipFromNode = sinon.stub().callsArg(1);
			qtumd._initZmqSubSocket = sinon.stub();
			qtumd._checkReindex = sinon.stub().callsArg(1);
			qtumd._checkSyncedAndSubscribeZmqEvents = sinon.stub();
			qtumd._stopSpawnedBitcoin = sinon.stub().callsArg(0);
			sinon.spy(qtumd, '_spawnChildProcess');
			qtumd._spawnChildProcess(function(err) {
				if (err) {
					return done(err);
				}
				qtumd.node.stopping = true;
				process.once('exit', function() {
					setTimeout(function() {
						qtumd._spawnChildProcess.callCount.should.equal(1);
						done();
					}, 5);
				});
				process.emit('exit', 1);
			});
		});
		it('will give error after 60 retries', function(done) {
			var process = new EventEmitter();
			var spawn = sinon.stub().returns(process);
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFileSync: readFileSync
				},
				child_process: {
					spawn: spawn
				}
			});
			var qtumd = new TestQtumService(baseConfig);
			qtumd.startRetryInterval = 1;
			qtumd._loadSpawnConfiguration = sinon.stub();
			qtumd.spawn = {};
			qtumd.spawn.exec = 'testexec';
			qtumd.spawn.configPath = 'testdir/qtum.conf';
			qtumd.spawn.datadir = 'testdir';
			qtumd.spawn.config = {};
			qtumd.spawn.config.rpcport = 20001;
			qtumd.spawn.config.rpcuser = 'qtum';
			qtumd.spawn.config.rpcpassword = 'password';
			qtumd.spawn.config.zmqpubrawtx = 'tcp://127.0.0.1:30001';
			qtumd._loadTipFromNode = sinon.stub().callsArgWith(1, new Error('test'));
			qtumd._spawnChildProcess(function(err) {
				qtumd._loadTipFromNode.callCount.should.equal(60);
				err.should.be.instanceof(Error);
				done();
			});
		});
		it('will give error from check reindex', function(done) {
			var process = new EventEmitter();
			var spawn = sinon.stub().returns(process);
			var TestQtumService = proxyquire('../../lib/services/qtumd', {
				fs: {
					readFileSync: readFileSync
				},
				child_process: {
					spawn: spawn
				}
			});
			var qtumd = new TestQtumService(baseConfig);

			qtumd._loadSpawnConfiguration = sinon.stub();
			qtumd.spawn = {};
			qtumd.spawn.exec = 'testexec';
			qtumd.spawn.configPath = 'testdir/qtum.conf';
			qtumd.spawn.datadir = 'testdir';
			qtumd.spawn.config = {};
			qtumd.spawn.config.rpcport = 20001;
			qtumd.spawn.config.rpcuser = 'qtum';
			qtumd.spawn.config.rpcpassword = 'password';
			qtumd.spawn.config.zmqpubrawtx = 'tcp://127.0.0.1:30001';

			qtumd._loadTipFromNode = sinon.stub().callsArgWith(1, null);
			qtumd._initZmqSubSocket = sinon.stub();
			qtumd._checkSyncedAndSubscribeZmqEvents = sinon.stub();
			qtumd._checkReindex = sinon.stub().callsArgWith(1, new Error('test'));

			qtumd._spawnChildProcess(function(err) {
				err.should.be.instanceof(Error);
				done();
			});
		});
	});

	describe('#_connectProcess', function() {
		it('will give error if connecting while shutting down', function(done) {
			var config = {
				node: {
					network: qtumcore.Networks.testnet
				},
				spawn: {
					datadir: 'testdir',
					exec: 'testpath'
				}
			};
			var qtumd = new QtumService(config);
			qtumd.node.stopping = true;
			qtumd.startRetryInterval = 100;
			qtumd._loadTipFromNode = sinon.stub();
			qtumd._connectProcess({}, function(err) {
				err.should.be.instanceof(Error);
				err.message.should.match(/Stopping while trying to connect to qtumd/);
				qtumd._loadTipFromNode.callCount.should.equal(0);
				done();
			});
		});
		it('will give error from loadTipFromNode after 60 retries', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._loadTipFromNode = sinon.stub().callsArgWith(1, new Error('test'));
			qtumd.startRetryInterval = 1;
			var config = {};
			qtumd._connectProcess(config, function(err) {
				err.should.be.instanceof(Error);
				qtumd._loadTipFromNode.callCount.should.equal(60);
				done();
			});
		});
		it('will init zmq/rpc on node', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._initZmqSubSocket = sinon.stub();
			qtumd._subscribeZmqEvents = sinon.stub();
			qtumd._loadTipFromNode = sinon.stub().callsArgWith(1, null);
			var config = {};
			qtumd._connectProcess(config, function(err, node) {
				should.not.exist(err);
				qtumd._loadTipFromNode.callCount.should.equal(1);
				qtumd._initZmqSubSocket.callCount.should.equal(1);
				qtumd._loadTipFromNode.callCount.should.equal(1);
				should.exist(node);
				should.exist(node.client);
				done();
			});
		});
	});

	describe('#start', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will give error if "spawn" and "connect" are both not configured', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.options = {};
			qtumd.start(function(err) {
				err.should.be.instanceof(Error);
				err.message.should.be.a('string').and.equal('Qtum configuration options "spawn" or "connect" are expected');
				done();
			});
		});
		it('will give error from spawnChildProcess', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._spawnChildProcess = sinon.stub().callsArgWith(0, new Error('test'));
			qtumd.options = {
				spawn: {}
			};
			qtumd.start(function(err) {
				err.should.be.instanceof(Error);
				qtumd._spawnChildProcess.callCount.should.equal(1);
				err.message.should.equal('test');
				done();
			});
		});
		it('will give error from connectProcess', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._connectProcess = sinon.stub().callsArgWith(1, new Error('test'));
			qtumd.options = {
				connect: [
					{}
				]
			};
			qtumd.start(function(err) {
				qtumd._connectProcess.callCount.should.equal(1);
				err.should.be.instanceof(Error);
				err.message.should.equal('test');
				done();
			});
		});
		it('will push node from spawnChildProcess', function(done) {
			var qtumd = new QtumService(baseConfig);
			var node = {};
			qtumd._initChain = sinon.stub().callsArg(0);
			qtumd._spawnChildProcess = sinon.stub().callsArgWith(0, null, node);
			qtumd.options = {
				spawn: {}
			};
			qtumd.start(function(err) {
				should.not.exist(err);
				qtumd.nodes.length.should.equal(1);
				done();
			});
		});
		it('will push node from connectProcess', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._initChain = sinon.stub().callsArg(0);
			sinon.spy(qtumd, '_spawnChildProcess');
			var nodes = [{}];
			qtumd._connectProcess = sinon.stub().callsArgWith(1, null, nodes);
			qtumd.options = {
				connect: [
					{}
				]
			};
			qtumd.start(function(err) {
				should.not.exist(err);
				qtumd._initChain.callCount.should.equal(1);
				qtumd._connectProcess.callCount.should.equal(1);
				qtumd.nodes.length.should.equal(1);
				done();
			});
		});
	});

	describe('#isSynced', function() {
		it('will give error from syncPercentage', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.syncPercentage = sinon.stub().callsArgWith(0, new Error('test'));
			qtumd.isSynced(function(err) {
				should.exist(err);
				qtumd.syncPercentage.callCount.should.equal(1);
				err.message.should.equal('test');
				done();
			});
		});
		it('will give "true" if percentage is 100.00', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.syncPercentage = sinon.stub().callsArgWith(0, null, 100.00);
			qtumd.isSynced(function(err, synced) {
				if (err) {
					return done(err);
				}
				qtumd.syncPercentage.callCount.should.equal(1);
				synced.should.equal(true);
				done();
			});
		});
		it('will give "true" if percentage is 99.98', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.syncPercentage = sinon.stub().callsArgWith(0, null, 99.98);
			qtumd.isSynced(function(err, synced) {
				if (err) {
					return done(err);
				}
				qtumd.syncPercentage.callCount.should.equal(1);
				synced.should.equal(true);
				done();
			});
		});
		it('will give "false" if percentage is 99.49', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.syncPercentage = sinon.stub().callsArgWith(0, null, 99.49);
			qtumd.isSynced(function(err, synced) {
				if (err) {
					return done(err);
				}
				qtumd.syncPercentage.callCount.should.equal(1);
				synced.should.equal(false);
				done();
			});
		});
		it('will give "false" if percentage is 1', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.syncPercentage = sinon.stub().callsArgWith(0, null, 1);
			qtumd.isSynced(function(err, synced) {
				if (err) {
					return done(err);
				}
				qtumd.syncPercentage.callCount.should.equal(1);
				synced.should.equal(false);
				done();
			});
		});
	});

	describe('#syncPercentage', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBlockchainInfo = sinon.stub().callsArgWith(0, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					getBlockchainInfo: getBlockchainInfo
				}
			});
			qtumd.syncPercentage(function(err) {
				should.exist(err);
				qtumd.nodes[0].client.getBlockchainInfo.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will call client getInfo and give result', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBlockchainInfo = sinon.stub().callsArgWith(0, null, {
				result: {
					verificationprogress: '0.983821387'
				}
			});
			qtumd.nodes.push({
				client: {
					getBlockchainInfo: getBlockchainInfo
				}
			});
			qtumd.syncPercentage(function(err, percentage) {
				if (err) {
					return done(err);
				}
				qtumd.nodes[0].client.getBlockchainInfo.callCount.should.equal(1);
				percentage.should.equal(98.3821387);
				done();
			});
		});
	});

	describe('#_normalizeAddressArg', function() {
		it('will turn single address into array', function() {
			var qtumd = new QtumService(baseConfig);
			var args = qtumd._normalizeAddressArg('address');
			args.should.deep.equal(['address']);
		});
		it('will keep an array as an array', function() {
			var qtumd = new QtumService(baseConfig);
			var args = qtumd._normalizeAddressArg(['address one', 'address two']);
			args.should.deep.equal(['address one', 'address two']);
		});
	});

	describe('#getAddressBalance', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			qtumd.nodes.push({
				client: {
					getAddressBalance: sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' })
				}
			});
			var address = 'qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2';
			var options = {};
			qtumd.getAddressBalance(address, options, function(err) {
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				err.should.be.instanceof(Error);
				done();
			});
		});
		it('will give balance', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			var getAddressBalance = sinon.stub().callsArgWith(1, null, {
				result: {
					received: 100000,
					balance: 10000
				}
			});
			qtumd.nodes.push({
				client: {
					getAddressBalance: getAddressBalance
				}
			});
			var address = 'qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2';
			var options = {};
			qtumd.getAddressBalance(address, options, function(err, data) {
				if (err) {
					return done(err);
				}
				data.balance.should.equal(10000);
				data.received.should.equal(100000);
				qtumd.getAddressBalance(address, options, function(err, data2) {
					if (err) {
						return done(err);
					}
					data2.balance.should.equal(10000);
					data2.received.should.equal(100000);
					qtumd._normalizeAddressArg.callCount.should.equal(2);
					getAddressBalance.callCount.should.equal(1);
					done();
				});
			});
		});
	});

	describe('#getAddressUnspentOutputs', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.nodes.push({
				client: {
					getAddressUtxos: sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' })
				}
			});
			var options = {
				queryMempool: false
			};
			var address = 'qMYemSxspKpzB2RbDunJRosQv5PJd3eEWD';
			qtumd.getAddressUnspentOutputs(address, options, function(err) {
				should.exist(err);
				err.should.be.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give results from client getaddressutxos', function(done) {
			var qtumd = new QtumService(baseConfig);
			var expectedUtxos = [
				{
					"address": "qMYemSxspKpzB2RbDunJRosQv5PJd3eEWD",
					"txid": "34b0275d58b57f934c64f62efd30a0bb9aa18495b27700a6488c9310cd9aeba2",
					"outputIndex": 1,
					"script": "2102587cb17a9e4ca41e477b6d180db02f88515c14a1a7791f9306167cba46bef004ac",
					"satoshis": 14386000000,
					"height": 83445,
					"isStake": true
				}
			];
			var getAddressUtxos = sinon.stub().callsArgWith(1, null, {
				result: expectedUtxos
			});
			qtumd.nodes.push({
				client: {
					getAddressUtxos: getAddressUtxos
				}
			});
			var options = {
				queryMempool: false
			};
			var address = 'qMYemSxspKpzB2RbDunJRosQv5PJd3eEWD';
			qtumd.getAddressUnspentOutputs(address, options, function(err, utxos) {
				if (err) {
					return done(err);
				}
				getAddressUtxos.callCount.should.equal(1);
				utxos.length.should.equal(1);
				utxos.should.deep.equal(expectedUtxos);
				done();
			});
		});
		it('will use cache', function(done) {
			var qtumd = new QtumService(baseConfig);
			var expectedUtxos = [
				{
					"address": "qMYemSxspKpzB2RbDunJRosQv5PJd3eEWD",
					"txid": "34b0275d58b57f934c64f62efd30a0bb9aa18495b27700a6488c9310cd9aeba2",
					"outputIndex": 1,
					"script": "2102587cb17a9e4ca41e477b6d180db02f88515c14a1a7791f9306167cba46bef004ac",
					"satoshis": 14386000000,
					"height": 83445,
					"isStake": true
				}
			];
			var getAddressUtxos = sinon.stub().callsArgWith(1, null, {
				result: expectedUtxos
			});
			qtumd.nodes.push({
				client: {
					getAddressUtxos: getAddressUtxos
				}
			});
			var options = {
				queryMempool: false
			};
			var address = 'qMYemSxspKpzB2RbDunJRosQv5PJd3eEWD';
			qtumd.getAddressUnspentOutputs(address, options, function(err, utxos) {
				if (err) {
					return done(err);
				}
				utxos.length.should.equal(1);
				utxos.should.deep.equal(expectedUtxos);
				getAddressUtxos.callCount.should.equal(1);
				qtumd.getAddressUnspentOutputs(address, options, function(err, utxos) {
					if (err) {
						return done(err);
					}
					utxos.length.should.equal(1);
					utxos.should.deep.equal(expectedUtxos);
					getAddressUtxos.callCount.should.equal(1);
					done();
				});
			});
		});
		it('will update with mempool results', function(done) {
			var deltas = [
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: '971f7ad0186622cfb4e6a69b583a4235115d22ced37b0eafc0d5ad6df36b5dd4',
					index: 0,
					satoshis: -7679241,
					timestamp: 1461342707725,
					prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
					prevout: 1
				},
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					index: 0,
					satoshis: 100000,
					timestamp: 1461342833133,
					"isStake": true
				},
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: '848f409cd1e113595f0b897e5ee674d29c6fc841f3cf3091c97597fa9506fbe9',
					index: 1,
					satoshis: 400000,
					timestamp: 1461342954813,
					"isStake": true
				}
			];

			var qtumd = new QtumService(baseConfig);
			var confirmedUtxos = [
				{
					"address": "qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX",
					"txid": "c84abf14b57247cbd921c73abfe9a016e9fb68889ee470fbd11cd7760b2056d0",
					"outputIndex": 10,
					"height": 83447,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					"satoshis": 40000000,
					"isStake": true
				}
			];
			var expectedUtxos = [
				{
					"address": "qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX",
					"txid": "848f409cd1e113595f0b897e5ee674d29c6fc841f3cf3091c97597fa9506fbe9",
					"outputIndex": 1,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					"satoshis": 400000,
					"timestamp": 1461342954813,
					"isStake": true
				},
				{
					"address": "qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX",
					"txid": "e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0",
					"outputIndex": 0,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					"satoshis": 100000,
					"timestamp": 1461342833133,
					"isStake": true
				},
				{
					"address": "qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX",
					"txid": "c84abf14b57247cbd921c73abfe9a016e9fb68889ee470fbd11cd7760b2056d0",
					"outputIndex": 10,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					"satoshis": 40000000,
					"height": 83447,
					"isStake": true
				}
			];
			let getAddressUtxos = sinon.stub().callsArgWith(1, null, {
				result: confirmedUtxos
			});
			let getAddressMempool = sinon.stub().callsArgWith(1, null, {
				result: deltas
			})
			qtumd.nodes.push({
				client: {
					getAddressUtxos: getAddressUtxos,
					getAddressMempool: getAddressMempool
				}
			});
			var options = {
				queryMempool: true
			};
			var address = 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX';
			qtumd.getAddressUnspentOutputs(address, options, function(err, utxos) {
				if (err) {
					return done(err);
				}
				getAddressUtxos.callCount.should.equal(1);
				getAddressMempool.callCount.should.equal(1);
				utxos.length.should.equal(3);
				utxos.should.deep.equal(expectedUtxos);
				done();
			});
		});
		it('will update with mempool results with multiple outputs', function(done) {
			var deltas = [
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: '971f7ad0186622cfb4e6a69b583a4235115d22ced37b0eafc0d5ad6df36b5dd4',
					index: 0,
					satoshis: 7679241,
					timestamp: 1461342707725,
					prevtxid: '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0',
					prevout: 1,
					"isStake": true
				},
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					index: 0,
					satoshis: 100000,
					timestamp: 1461342833133,
					prevtxid: '848f409cd1e113595f0b897e5ee674d29c6fc841f3cf3091c97597fa9506fbe9',
					prevout: 2,
					"isStake": true
				}
			];
			var qtumd = new QtumService(baseConfig);
			var confirmedUtxos = [
				{
					"address": "qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX",
					"txid": "c84abf14b57247cbd921c73abfe9a016e9fb68889ee470fbd11cd7760b2056d0",
					"outputIndex": 10,
					"height": 83447,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					"satoshis": 40000000,
					"isStake": true
				}
			];
			var expectedUtxos = [
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					outputIndex: 0,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					satoshis: 100000,
					timestamp: 1461342833133,
					"isStake": true
				},
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: '971f7ad0186622cfb4e6a69b583a4235115d22ced37b0eafc0d5ad6df36b5dd4',
					outputIndex: 0,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					satoshis: 7679241,
					timestamp: 1461342707725,
					"isStake": true
				},
				{
					"address": "qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX",
					"txid": "c84abf14b57247cbd921c73abfe9a016e9fb68889ee470fbd11cd7760b2056d0",
					"outputIndex": 10,
					"height": 83447,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					"satoshis": 40000000,
					"isStake": true
				}
			];
			let getAddressUtxos = sinon.stub().callsArgWith(1, null, {
				result: confirmedUtxos
			});
			let getAddressMempool = sinon.stub().callsArgWith(1, null, {
				result: deltas
			})

			qtumd.nodes.push({
				client: {
					getAddressUtxos: getAddressUtxos,
					getAddressMempool: getAddressMempool,
				}
			});
			var options = {
				queryMempool: true
			};
			var address = 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX';
			qtumd.getAddressUnspentOutputs(address, options, function(err, utxos) {
				if (err) {
					return done(err);
				}
				getAddressUtxos.callCount.should.equal(1);
				getAddressMempool.callCount.should.equal(1);
				utxos.length.should.equal(3);
				utxos.should.deep.equal(expectedUtxos);

				done();
			});
		});
		it('three confirmed utxos -> one utxo after mempool', function(done) {
			var deltas = [
				{
					txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
					satoshis: -7679241,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 0,
					timestamp: 1461342707725,
					prevtxid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					prevout: 1
				},
				{
					txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
					satoshis: -7679241,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 1,
					timestamp: 1461342707725,
					prevtxid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					prevout: 2
				}
			];
			var qtumd = new QtumService(baseConfig);
			var confirmedUtxos = [
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					outputIndex: 1,
					height: 80000,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					satoshis: 100000,
				},
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					outputIndex: 2,
					height: 80001,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					satoshis: 200000,
				},
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					outputIndex: 3,
					height: 80002,
					"script": "76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac",
					satoshis: 300000,
				}
			];
			var getAddressUtxos = sinon.stub().callsArgWith(1, null, {
				result: confirmedUtxos
			});
			var getAddressMempool = sinon.stub().callsArgWith(1, null, {
				result: deltas
			});
			qtumd.nodes.push({
				client: {
					getAddressUtxos: getAddressUtxos,
					getAddressMempool: getAddressMempool
				}
			});
			var options = {
				queryMempool: true
			};
			var address = 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX';
			qtumd.getAddressUnspentOutputs(address, options, function(err, utxos) {
				if (err) {
					return done(err);
				}
				getAddressUtxos.callCount.should.equal(1);
				getAddressMempool.callCount.should.equal(1);
				utxos.length.should.equal(1);
				done();
			});
		});
		it('spending utxos in the mempool', function(done) {
			var deltas = [
				{
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					satoshis: 7679241,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 0,
					timestamp: 1461342707724
				},
				{
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					satoshis: 7679241,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 1,
					timestamp: 1461342707724
				},
				{
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					satoshis: 7679241,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					timestamp: 1461342707724,
					index: 2,
				},
				{
					txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
					satoshis: -7679241,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 0,
					timestamp: 1461342707725,
					prevtxid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					prevout: 0
				},
				{
					txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
					satoshis: -7679241,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 0,
					timestamp: 1461342707725,
					prevtxid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					prevout: 1
				},
				{
					txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
					satoshis: -7679241,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 1,
					timestamp: 1461342707725,
					prevtxid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					prevout: 2
				},
				{
					txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
					satoshis: 100000,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 1,
					timestamp: 1461342833133
				}
			];
			var qtumd = new QtumService(baseConfig);
			var confirmedUtxos = [];
			var getAddressUtxos = sinon.stub().callsArgWith(1, null, {
				result: confirmedUtxos
			});
			var getAddressMempool = sinon.stub().callsArgWith(1, null, {
				result: deltas
			});
			qtumd.nodes.push({
				client: {
					getAddressUtxos: getAddressUtxos,
					getAddressMempool: getAddressMempool
				}
			});
			var options = {
				queryMempool: true
			};
			var address = 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX';
			qtumd.getAddressUnspentOutputs(address, options, function(err, utxos) {
				if (err) {
					return done(err);
				}
				utxos.length.should.equal(1);
				getAddressUtxos.callCount.should.equal(1);
				getAddressMempool.callCount.should.equal(1);
				utxos[0].address.should.equal(address);
				utxos[0].txid.should.equal('e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce');
				utxos[0].outputIndex.should.equal(1);
				utxos[0].script.should.equal('76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac');
				utxos[0].timestamp.should.equal(1461342833133);
				done();
			});
		});
		it('will update with mempool results spending zero value output (likely never to happen)', function(done) {
			var deltas = [
				{
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					satoshis: 0,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 0,
					timestamp: 1461342707725,
					prevtxid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
					prevout: 1
				}
			];
			var qtumd = new QtumService(baseConfig);
			var confirmedUtxos = [
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
					outputIndex: 1,
					script: '76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac',
					satoshis: 0,
					height: 207111
				}
			];
			var getAddressUtxos = sinon.stub().callsArgWith(1, null, {
				result: confirmedUtxos
			});
			var getAddressMempool = sinon.stub().callsArgWith(1, null, {
				result: deltas
			});
			qtumd.nodes.push({
				client: {
					getAddressUtxos: getAddressUtxos,
					getAddressMempool: getAddressMempool
				}
			});
			var options = {
				queryMempool: true
			};
			var address = 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX';
			qtumd.getAddressUnspentOutputs(address, options, function(err, utxos) {
				if (err) {
					return done(err);
				}
				getAddressUtxos.callCount.should.equal(1);
				getAddressMempool.callCount.should.equal(1);
				utxos.length.should.equal(0);
				done();
			});
		});
		it('will not filter results if mempool is not spending', function(done) {
			var deltas = [
				{
					txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
					satoshis: 10000,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 0,
					timestamp: 1461342707725
				}
			];
			var qtumd = new QtumService(baseConfig);
			var confirmedUtxos = [
				{
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					outputIndex: 1,
					script: '76a91439d41c6c7c944c196852928721ad2e623442e9ba88ac',
					satoshis: 0,
					height: 207111
				}
			];
			var getAddressUtxos = sinon.stub().callsArgWith(1, null, {
				result: confirmedUtxos
			});
			var getAddressMempool = sinon.stub().callsArgWith(1, null, {
				result: deltas
			});
			qtumd.nodes.push({
				client: {
					getAddressUtxos: getAddressUtxos,
					getAddressMempool: getAddressMempool
				}
			});
			var options = {
				queryMempool: true
			};
			var address = 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX';
			qtumd.getAddressUnspentOutputs(address, options, function(err, utxos) {
				if (err) {
					return done(err);
				}
				getAddressUtxos.callCount.should.equal(1);
				getAddressMempool.callCount.should.equal(1);
				utxos.length.should.equal(2);
				done();
			});
		});
		it('it will handle error from getAddressMempool', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.nodes.push({
				client: {
					getAddressMempool: sinon.stub().callsArgWith(1, { code: -1, message: 'test' })
				}
			});
			var options = {
				queryMempool: true
			};
			var address = 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX';
			qtumd.getAddressUnspentOutputs(address, options, function(err) {
				err.should.be.instanceOf(Error);
				done();
			});
		});
		it('should set query mempool if undefined', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getAddressMempool = sinon.stub().callsArgWith(1, { code: -1, message: 'test' });
			qtumd.nodes.push({
				client: {
					getAddressMempool: getAddressMempool
				}
			});
			var options = {};
			var address = 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX';
			qtumd.getAddressUnspentOutputs(address, options, function(err) {
				getAddressMempool.callCount.should.equal(1);
				done();
			});
		});
	});

	describe('#_getBalanceFromMempool', function() {
		it('will sum satoshis', function() {
			var qtumd = new QtumService(baseConfig);
			var deltas = [
				{
					satoshis: -1000,
				},
				{
					satoshis: 2000,
				},
				{
					satoshis: -10,
				}
			];
			var sum = qtumd._getBalanceFromMempool(deltas);
			sum.should.equal(990);
		});
	});

	describe('#_getTxidsFromMempool', function() {
		it('will filter to txids', function() {
			var qtumd = new QtumService(baseConfig);
			var deltas = [
				{
					txid: 'txid0',
				},
				{
					txid: 'txid1',
				},
				{
					txid: 'txid2',
				}
			];
			var txids = qtumd._getTxidsFromMempool(deltas);
			txids.length.should.equal(3);
			txids[0].should.equal('txid0');
			txids[1].should.equal('txid1');
			txids[2].should.equal('txid2');
		});
		it('will not include duplicates', function() {
			var qtumd = new QtumService(baseConfig);
			var deltas = [
				{
					txid: 'txid0',
				},
				{
					txid: 'txid0',
				},
				{
					txid: 'txid1',
				}
			];
			var txids = qtumd._getTxidsFromMempool(deltas);
			txids.length.should.equal(2);
			txids[0].should.equal('txid0');
			txids[1].should.equal('txid1');
		});
	});

	describe('#_getHeightRangeQuery', function() {
		it('will detect range query', function() {
			var qtumd = new QtumService(baseConfig);
			var options = {
				start: 20,
				end: 0
			};
			var rangeQuery = qtumd._getHeightRangeQuery(options);
			rangeQuery.should.equal(true);
		});
		it('will return false:: end < 0', function() {
			var qtumd = new QtumService(baseConfig);
			var options = {
				start: 20,
				end: -1
			};
			var rangeQuery = qtumd._getHeightRangeQuery(options);
			rangeQuery.should.equal(false);
		});
		it('will return false:: start < 0', function() {
			var qtumd = new QtumService(baseConfig);
			var options = {
				start: -1,
				end: 0
			};
			var rangeQuery = qtumd._getHeightRangeQuery(options);
			rangeQuery.should.equal(false);
		});
		it('will get range properties', function() {
			var qtumd = new QtumService(baseConfig);
			var options = {
				start: 20,
				end: 0
			};
			var clone = {};
			var rangeQuery = qtumd._getHeightRangeQuery(options, clone);

			rangeQuery.should.equal(true);
			clone.end.should.equal(20);
			clone.start.should.equal(0);
		});
		it('will throw error with invalid range', function() {
			var qtumd = new QtumService(baseConfig);
			var options = {
				start: 0,
				end: 20
			};
			(function() {
				qtumd._getHeightRangeQuery(options);
			}).should.throw('"end" is expected to be less than or equal to "start"');
		});
	});

	describe('#getAddressTxids', function() {
		it('will give error from _getHeightRangeQuery', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd._getHeightRangeQuery = sinon.stub().throws(new Error('test'));
			qtumd.getAddressTxids('address', {}, function(err) {
				err.should.be.instanceOf(Error);
				err.message.should.equal('test');
				done();
			});
		});
		it('will give rpc error from mempool query', function() {
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_getHeightRangeQuery');
			sinon.spy(qtumd, '_normalizeAddressArg');

			qtumd.nodes.push({
				client: {
					getAddressMempool: sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' })
				}
			});
			var options = {};
			var address = 'qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2';
			qtumd.getAddressTxids(address, options, function(err) {
				should.exist(err);
				qtumd._getHeightRangeQuery.callCount.should.equal(1);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				err.should.be.instanceof(errors.RPCError);
			});
		});
		it('will give rpc error from txids query', function() {
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_getHeightRangeQuery');
			sinon.spy(qtumd, '_normalizeAddressArg');
			qtumd.nodes.push({
				client: {
					getAddressTxids: sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' })
				}
			});
			var options = {
				queryMempool: false
			};
			var address = 'qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2';
			qtumd.getAddressTxids(address, options, function(err) {
				should.exist(err);
				qtumd._getHeightRangeQuery.callCount.should.equal(1);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				err.should.be.instanceof(errors.RPCError);
			});
		});
		it('will get txid results', function(done) {
			var expectedTxids = [
				"b6b8ac5b726444a3d8a9a32511bdc66aa0eb3767728fd77cbe34ef2502cd7895",
				"bd56771add09ab79c557e6b8fb6a9c0c3c7ee56f6e8caba53f690b0d605b9237",
				"6abc4390e1f8f427d928f002fc92b329c50c2ad03533e0a3a3375936aa5832eb",
				"25cfac8c32eee1b9b915984c98eca608c5a3507b3ffdc08fb858fc1d534f3da6",
				"0ecc1eca85b7af969022cb07646995d754ed4180bff2027e48de732b6610e23f",
				"a2853606fbf8f5204c20f1982e79c0ddfbea9401b0f40e2eea3afa8cf45348c5",
				"62d72b01e245447ed37db0f0769f077452f2d690e24861903b04922743eaecdc",
				"37db7780e0a4cd470b69dd0a17bbacba7988299301001f6abd7b6d5294139055",
				"968a594807e5bc59762ff156ab5d46ee3b5e12e36722cfd5e8686b1fc7d4afa2",
				"f72a6a6b9207921adffa1307edc99b90458be0c56323b88c80814067d7d296a3",
				"f618aa80803b4db6a6f32a5b8734afa10d3280c7470813ceb09f336d1af6cc47",
				"668748896009c0a2efaf31a6eeb26e59cdb46aba16ad39c328d7669a84a6631d"
			];
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_getHeightRangeQuery');
			sinon.spy(qtumd, '_normalizeAddressArg');

			qtumd.nodes.push({
				client: {
					getAddressTxids: sinon.stub().callsArgWith(1, null, {
						result: expectedTxids.reverse()
					})
				}
			});
			var options = {
				queryMempool: false
			};
			var address = 'qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2';
			qtumd.getAddressTxids(address, options, function(err, txids) {
				if (err) {
					return done(err);
				}
				qtumd._getHeightRangeQuery.callCount.should.equal(1);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				txids.length.should.equal(expectedTxids.length);
				txids.should.deep.equal(expectedTxids);
				done();
			});
		});
		it('will get txid results from cache', function(done) {
			var expectedTxids = [
				'b6b8ac5b726444a3d8a9a32511bdc66aa0eb3767728fd77cbe34ef2502cd7895'
			];
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_getHeightRangeQuery');
			sinon.spy(qtumd, '_normalizeAddressArg');

			var getAddressTxids = sinon.stub().callsArgWith(1, null, {
				result: expectedTxids.reverse()
			});
			qtumd.nodes.push({
				client: {
					getAddressTxids: getAddressTxids
				}
			});
			var options = {
				queryMempool: false
			};
			var address = 'qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2';
			qtumd.getAddressTxids(address, options, function(err, txids) {
				if (err) {
					return done(err);
				}
				getAddressTxids.callCount.should.equal(1);
				txids.should.deep.equal(expectedTxids);

				qtumd.getAddressTxids(address, options, function(err, txids) {
					if (err) {
						return done(err);
					}
					qtumd._getHeightRangeQuery.callCount.should.equal(2);
					qtumd._normalizeAddressArg.callCount.should.equal(2);
					getAddressTxids.callCount.should.equal(1);
					txids.should.deep.equal(expectedTxids);
					done();
				});
			});
		});
		it('will get txid results WITHOUT cache if rangeQuery and exclude mempool', function(done) {
			var expectedTxids = [
				'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce'
			];
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_getHeightRangeQuery');
			sinon.spy(qtumd, '_normalizeAddressArg');

			var getAddressMempool = sinon.stub();
			var getAddressTxids = sinon.stub().callsArgWith(1, null, {
				result: expectedTxids.reverse()
			});
			qtumd.nodes.push({
				client: {
					getAddressTxids: getAddressTxids,
					getAddressMempool: getAddressMempool
				}
			});
			var options = {
				queryMempool: true, // start and end will exclude mempool
				start: 4,
				end: 2
			};
			var address = 'qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2';
			qtumd.getAddressTxids(address, options, function(err, txids) {
				if (err) {
					return done(err);
				}
				getAddressTxids.callCount.should.equal(1);
				getAddressMempool.callCount.should.equal(0);
				txids.should.deep.equal(expectedTxids);

				qtumd.getAddressTxids(address, options, function(err, txids) {
					if (err) {
						return done(err);
					}
					qtumd._getHeightRangeQuery.callCount.should.equal(4);
					qtumd._normalizeAddressArg.callCount.should.equal(2);
					getAddressTxids.callCount.should.equal(2);
					getAddressMempool.callCount.should.equal(0);
					txids.should.deep.equal(expectedTxids);
					done();
				});
			});
		});
		it('will get txid results from cache and live mempool', function(done) {
			var expectedTxids = [
				'25cfac8c32eee1b9b915984c98eca608c5a3507b3ffdc08fb858fc1d534f3da6'
			];
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_getHeightRangeQuery');
			sinon.spy(qtumd, '_normalizeAddressArg');

			var getAddressTxids = sinon.stub().callsArgWith(1, null, {
				result: expectedTxids.reverse()
			});
			var getAddressMempool = sinon.stub().callsArgWith(1, null, {
				result: [
					{
						txid: '668748896009c0a2efaf31a6eeb26e59cdb46aba16ad39c328d7669a84a6631d'
					},
					{
						txid: '19edf310a2b1e4515c40e7ab37470a547d26a6fb8a70cd6083a98d36c6f6cf75'
					},
					{
						txid: '407bccee66701745ba300710cb78fab93d9e2db8ff6e3cedd4af39db14ae1b54'
					}
				]
			});
			qtumd.nodes.push({
				client: {
					getAddressTxids: getAddressTxids,
					getAddressMempool: getAddressMempool
				}
			});
			var address = 'qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2';
			qtumd.getAddressTxids(address, { queryMempool: false }, function(err, txids) {
				if (err) {
					return done(err);
				}
				getAddressTxids.callCount.should.equal(1);
				txids.should.deep.equal(expectedTxids);

				qtumd.getAddressTxids(address, { queryMempool: true }, function(err, txids) {
					if (err) {
						return done(err);
					}
					getAddressTxids.callCount.should.equal(1);
					txids.should.deep.equal([
						'407bccee66701745ba300710cb78fab93d9e2db8ff6e3cedd4af39db14ae1b54', // mempool
						'19edf310a2b1e4515c40e7ab37470a547d26a6fb8a70cd6083a98d36c6f6cf75', // mempool
						'668748896009c0a2efaf31a6eeb26e59cdb46aba16ad39c328d7669a84a6631d', // mempool
						'25cfac8c32eee1b9b915984c98eca608c5a3507b3ffdc08fb858fc1d534f3da6' // confirmed
					]);

					qtumd.getAddressTxids(address, { queryMempoolOnly: true }, function(err, txids) {
						if (err) {
							return done(err);
						}
						getAddressTxids.callCount.should.equal(1);
						getAddressMempool.callCount.should.equal(2);
						txids.should.deep.equal([
							'407bccee66701745ba300710cb78fab93d9e2db8ff6e3cedd4af39db14ae1b54', // mempool
							'19edf310a2b1e4515c40e7ab37470a547d26a6fb8a70cd6083a98d36c6f6cf75', // mempool
							'668748896009c0a2efaf31a6eeb26e59cdb46aba16ad39c328d7669a84a6631d', // mempool
						]);
						qtumd._getHeightRangeQuery.callCount.should.equal(3);
						qtumd._normalizeAddressArg.callCount.should.equal(3);
						done();
					});
				});
			});
		});
	});

	describe('#_getConfirmationDetail', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'warn');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('should get 0 confirmation', function() {
			var tx = new Transaction(txhex);
			tx.height = -1;
			var qtumd = new QtumService(baseConfig);
			qtumd.height = 10;
			var confirmations = qtumd._getConfirmationsDetail(tx);
			confirmations.should.equal(0);
		});
		it('should get 1 confirmation', function() {
			var tx = new Transaction(txhex);
			tx.height = 10;
			var qtumd = new QtumService(baseConfig);
			qtumd.height = 10;
			var confirmations = qtumd._getConfirmationsDetail(tx);
			confirmations.should.equal(1);
		});
		it('should get 2 confirmation', function() {
			var qtumd = new QtumService(baseConfig);
			var tx = new Transaction(txhex);
			qtumd.height = 11;
			tx.height = 10;
			var confirmations = qtumd._getConfirmationsDetail(tx);
			confirmations.should.equal(2);
		});
		it('should get 0 confirmation with overflow', function() {
			var qtumd = new QtumService(baseConfig);
			var tx = new Transaction(txhex);
			qtumd.height = 3;
			tx.height = 10;
			var confirmations = qtumd._getConfirmationsDetail(tx);
			log.warn.callCount.should.equal(1);
			confirmations.should.equal(0);
		});
		it('should get 1000 confirmation', function() {
			var qtumd = new QtumService(baseConfig);
			var tx = new Transaction(txhex);
			qtumd.height = 1000;
			tx.height = 1;
			var confirmations = qtumd._getConfirmationsDetail(tx);
			confirmations.should.equal(1000);
		});
	});

	describe('#_getAddressDetailsForInput', function() {
		it('will return if missing an address', function() {
			var qtumd = new QtumService(baseConfig);
			var result = {};
			qtumd._getAddressDetailsForInput({}, 0, result, []);
			should.not.exist(result.addresses);
			should.not.exist(result.satoshis);
		});
		it('will only add address if it matches', function() {
			var qtumd = new QtumService(baseConfig);
			var result = {};
			qtumd._getAddressDetailsForInput({
				address: 'address1'
			}, 0, result, ['address2']);
			should.not.exist(result.addresses);
			should.not.exist(result.satoshis);
		});
		it('will instantiate if outputIndexes not defined', function() {
			var qtumd = new QtumService(baseConfig);
			var result = {
				addresses: {},
				satoshis: 10,
			};
			qtumd._getAddressDetailsForInput({
				address: 'address1',
				satoshis: 5,
			}, 0, result, ['address1']);
			should.exist(result.addresses);
			result.addresses['address1'].inputIndexes.should.deep.equal([0]);
			result.addresses['address1'].outputIndexes.should.deep.equal([]);
			result.satoshis.should.be.equal(5);
		});
		it('will push to inputIndexes', function() {
			var qtumd = new QtumService(baseConfig);
			var result = {
				addresses: {
					'address1': {
						inputIndexes: [1]
					}
				}
			};
			qtumd._getAddressDetailsForInput({
				address: 'address1'
			}, 2, result, ['address1']);
			should.exist(result.addresses);
			result.addresses['address1'].inputIndexes.should.deep.equal([1, 2]);
		});
	});

	describe('#_getAddressDetailsForOutput', function() {
		it('will return if missing an address', function() {
			var qtumd = new QtumService(baseConfig);
			var result = {};
			qtumd._getAddressDetailsForOutput({}, 0, result, []);
			should.not.exist(result.addresses);
			should.not.exist(result.satoshis);
		});
		it('will only add address if it matches', function() {
			var qtumd = new QtumService(baseConfig);
			var result = {};
			qtumd._getAddressDetailsForOutput({
				address: 'address1'
			}, 0, result, ['address2']);
			should.not.exist(result.addresses);
			should.not.exist(result.satoshis);
		});
		it('will instantiate if outputIndexes not defined with', function() {
			var qtumd = new QtumService(baseConfig);
			var result = {
				addresses: {},
				satoshis: 10,
			};
			qtumd._getAddressDetailsForOutput({
				address: 'address1',
				satoshis: 5
			}, 0, result, ['address1']);
			should.exist(result.addresses);
			result.addresses['address1'].inputIndexes.should.deep.equal([]);
			result.addresses['address1'].outputIndexes.should.deep.equal([0]);
			result.satoshis.should.be.equal(15);
		});
		it('will push if outputIndexes defined', function() {
			var qtumd = new QtumService(baseConfig);
			var result = {
				addresses: {
					'address1': {
						outputIndexes: [0]
					}
				}
			};
			qtumd._getAddressDetailsForOutput({
				address: 'address1'
			}, 1, result, ['address1']);
			should.exist(result.addresses);
			result.addresses['address1'].outputIndexes.should.deep.equal([0, 1]);
		});
	});

	describe('#_getAddressDetailsForTransaction', function() {
		it('will calculate details for the transaction', function(done) {
			/* jshint sub:true */
			var tx = {
				inputs: [
					{
						satoshis: 1000000000,
						address: 'qey8KJ8xkyLUUqFZZwqngXX9U2q9ef6Tw4'
					}
				],
				outputs: [
					{
						satoshis: 100000000,
						address: 'qZqqcqCsVtP2U38WWaUnwshHRpefvCa8hX'
					},
					{
						satoshis: 200000000,
						address: 'qey8KJ8xkyLUUqFZZwqngXX9U2q9ef6Tw4'
					},
					{
						satoshis: 50000000,
						address: 'qbyVuxhRy4Y4dgRk2McVVEwqDVao73MrjV'
					},
					{
						satoshis: 300000000,
						address: 'qYJaxQ579UNUiV8AnjP97ATnvvChFZmLLv'
					},
					{
						satoshis: 349990000,
						address: 'qey8KJ8xkyLUUqFZZwqngXX9U2q9ef6Tw4'
					}
				],
				locktime: 0
			};
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_getAddressDetailsForInput');
			sinon.spy(qtumd, '_getAddressDetailsForOutput');

			var addresses = ['qey8KJ8xkyLUUqFZZwqngXX9U2q9ef6Tw4'];
			var details = qtumd._getAddressDetailsForTransaction(tx, addresses);
			should.exist(details.addresses['qey8KJ8xkyLUUqFZZwqngXX9U2q9ef6Tw4']);
			details.addresses['qey8KJ8xkyLUUqFZZwqngXX9U2q9ef6Tw4'].inputIndexes.should.deep.equal([0]);
			details.addresses['qey8KJ8xkyLUUqFZZwqngXX9U2q9ef6Tw4'].outputIndexes.should.deep.equal([1, 4]);
			details.satoshis.should.equal(-450010000);
			qtumd._getAddressDetailsForInput.callCount.should.equal(1);
			qtumd._getAddressDetailsForOutput.callCount.should.equal(5);
			done();
		});
	});

	describe('#_getAddressDetailedTransaction', function() {
		it('will get detailed transaction info', function(done) {
			var txid = '3ff10ebe0c5d30d927a687e59e9af99c7196a711d0a2215a9f470ed899e406f1';
			var tx = {
				height: 20,
			};
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_getConfirmationsDetail');
			qtumd.getDetailedTransaction = sinon.stub().callsArgWith(1, null, tx);
			qtumd.height = 300;
			var addresses = {};
			qtumd._getAddressDetailsForTransaction = sinon.stub().returns({
				addresses: addresses,
				satoshis: 1000,
			});
			qtumd._getAddressDetailedTransaction(txid, {}, function(err, details) {
				if (err) {
					return done(err);
				}
				details.addresses.should.equal(addresses);
				details.satoshis.should.equal(1000);
				qtumd.getDetailedTransaction.callCount.should.equal(1);
				qtumd._getAddressDetailsForTransaction.callCount.should.equal(1);
				qtumd._getConfirmationsDetail.callCount.should.equal(1);
				details.confirmations.should.equal(281);
				details.tx.should.equal(tx);
				done();
			});
		});
		it('give error from _getDetailedTransaction', function(done) {
			var txid = '46f24e0c274fc07708b781963576c4c5d5625d926dbb0a17fa865dcd9fe58ea0';
			var qtumd = new QtumService(baseConfig);
			qtumd.getDetailedTransaction = sinon.stub().callsArgWith(1, new Error('test'));
			qtumd._getAddressDetailedTransaction(txid, {}, function(err) {
				err.should.be.instanceof(Error);
				qtumd.getDetailedTransaction.callCount.should.equal(1);
				done();
			});
		});
	});

	describe('#_getAddressStrings', function() {
		it('will get address strings from qtumcore addresses', function() {
			var addresses = [
				qtumcore.Address('qU12Fa5RHM535kSDvywxPjCmbL7gwkQJZ6'),
				qtumcore.Address('qcSLSxN1sngCWSrKFZ6UC7ri4hhVSdq9SU'),
			];
			var qtumd = new QtumService(baseConfig);
			var strings = qtumd._getAddressStrings(addresses);
			strings[0].should.equal('qU12Fa5RHM535kSDvywxPjCmbL7gwkQJZ6');
			strings[1].should.equal('qcSLSxN1sngCWSrKFZ6UC7ri4hhVSdq9SU');
		});
		it('will get address strings from strings', function() {
			var addresses = [
				'qU12Fa5RHM535kSDvywxPjCmbL7gwkQJZ6',
				'qcSLSxN1sngCWSrKFZ6UC7ri4hhVSdq9SU',
			];
			var qtumd = new QtumService(baseConfig);
			var strings = qtumd._getAddressStrings(addresses);
			strings[0].should.equal('qU12Fa5RHM535kSDvywxPjCmbL7gwkQJZ6');
			strings[1].should.equal('qcSLSxN1sngCWSrKFZ6UC7ri4hhVSdq9SU');
		});
		it('will get address strings from mixture of types', function() {
			var addresses = [
				qtumcore.Address('qU12Fa5RHM535kSDvywxPjCmbL7gwkQJZ6'),
				'qcSLSxN1sngCWSrKFZ6UC7ri4hhVSdq9SU',
			];
			var qtumd = new QtumService(baseConfig);
			var strings = qtumd._getAddressStrings(addresses);
			strings[0].should.equal('qU12Fa5RHM535kSDvywxPjCmbL7gwkQJZ6');
			strings[1].should.equal('qcSLSxN1sngCWSrKFZ6UC7ri4hhVSdq9SU');
		});
		it('will give error with unknown', function() {
			var addresses = [
				qtumcore.Address('qcSLSxN1sngCWSrKFZ6UC7ri4hhVSdq9SU'),
				0,
			];
			var qtumd = new QtumService(baseConfig);
			(function() {
				qtumd._getAddressStrings(addresses);
			}).should.throw(TypeError);
		});
	});

	describe('#_paginateTxids', function() {
		it('slice txids based on "from" and "to" (3 to 13)', function() {
			var qtumd = new QtumService(baseConfig);
			var txids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			var paginated = qtumd._paginateTxids(txids, 3, 13);
			paginated.should.deep.equal([3, 4, 5, 6, 7, 8, 9, 10]);
		});
		it('slice txids based on "from" and "to" (0 to 3)', function() {
			var qtumd = new QtumService(baseConfig);
			var txids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			var paginated = qtumd._paginateTxids(txids, 0, 3);
			paginated.should.deep.equal([0, 1, 2]);
		});
		it('slice txids based on "from" and "to" (0 to 1)', function() {
			var qtumd = new QtumService(baseConfig);
			var txids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			var paginated = qtumd._paginateTxids(txids, 0, 1);
			paginated.should.deep.equal([0]);
		});
		it('will throw error if "from" is greater than "to"', function() {
			var qtumd = new QtumService(baseConfig);
			var txids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			(function() {
				qtumd._paginateTxids(txids, 1, 0);
			}).should.throw('"from" (1) is expected to be less than "to"');
		});
		it('will handle string numbers', function() {
			var qtumd = new QtumService(baseConfig);
			var txids = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
			var paginated = qtumd._paginateTxids(txids, '1', '3');
			paginated.should.deep.equal([1, 2]);
		});
	});

	describe('#getAddressHistory', function() {
		var address = 'qU12Fa5RHM535kSDvywxPjCmbL7gwkQJZ6';
		it('will give an error if length of addresses is too long', function(done) {
			var addresses = [];
			for (var i = 0; i < 101; i++) {
				addresses.push(address);
			}
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			qtumd.maxAddressesQuery = 100;
			qtumd.getAddressHistory(addresses, {}, function(err) {
				should.exist(err);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				err.message.match(/Maximum/);
				done();
			});
		});
		it('will give error with "from" and "to" range that exceeds max size', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			sinon.spy(qtumd, '_getAddressStrings');
			qtumd.getAddressHistory(address, { from: 0, to: 51 }, function(err) {
				should.exist(err);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				qtumd._getAddressStrings.callCount.should.equal(1);
				err.message.match(/^\"from/);
				done();
			});
		});
		it('will give error with "from" and "to" order is reversed', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			sinon.spy(qtumd, '_getAddressStrings');
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, null, []);
			qtumd.getAddressHistory(address, { from: 51, to: 0 }, function(err) {
				should.exist(err);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				qtumd._getAddressStrings.callCount.should.equal(1);
				err.message.match(/^\"from/);
				done();
			});
		});
		it('will give error from _getAddressDetailedTransaction', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			sinon.spy(qtumd, '_getAddressStrings');
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, null, ['txid']);
			qtumd._getAddressDetailedTransaction = sinon.stub().callsArgWith(2, new Error('test'));
			qtumd.getAddressHistory(address, {}, function(err) {
				should.exist(err);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				qtumd._getAddressStrings.callCount.should.equal(1);
				qtumd.getAddressTxids.callCount.should.equal(1);
				qtumd._getAddressDetailedTransaction.callCount.should.equal(1);
				err.message.should.equal('test');
				done();
			});
		});
		it('give error from getAddressTxids', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			sinon.spy(qtumd, '_getAddressStrings');
			sinon.spy(qtumd, 'getAddressTxids');
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, new Error('test'));
			qtumd.getAddressHistory('address', {}, function(err) {
				should.exist(err);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				qtumd._getAddressStrings.callCount.should.equal(1);
				qtumd.getAddressTxids.callCount.should.equal(1);
				err.should.be.instanceof(Error);
				err.message.should.equal('test');
				done();
			});
		});
		it('will paginate', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			sinon.spy(qtumd, '_getAddressStrings');
			sinon.spy(qtumd, '_paginateTxids');
			qtumd._getAddressDetailedTransaction = function(txid, options, callback) {
				callback(null, txid);
			};
			sinon.spy(qtumd, '_getAddressDetailedTransaction');
			var txids = ['one', 'two', 'three', 'four'];
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, null, txids);
			qtumd.getAddressHistory('address', { from: 1, to: 3 }, function(err, data) {
				if (err) {
					return done(err);
				}
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				qtumd._getAddressStrings.callCount.should.equal(1);
				qtumd.getAddressTxids.callCount.should.equal(1);
				qtumd._getAddressDetailedTransaction.callCount.should.equal(2);
				qtumd._paginateTxids.callCount.should.equal(1);
				data.items.length.should.equal(2);
				data.items.should.deep.equal(['two', 'three']);
				done();
			});
		});
	});

	describe('#getAddressSummary', function() {
		var txid1 = '2766cc1a65d1c99fa9cd13571240aceab90799e58898d2f1b4a33fd38fde855f';
		var txid2 = 'ac35d7fc488356c3da29c6277594f2099c533766db2d8cc238c42b72ac9b97e4';
		var txid3 = '8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae';
		var memtxid1 = 'dd23969aec657934d4e14e6ffb3aa7b48a7bdafef2eccd5fcc644f48c72e5116';
		var memtxid2 = '28bf4485cc8f869bb8f2aa4beb8ba0a6da1059e0c8275d86ee1fa217dac0a924';
		it('will handle error from getAddressTxids', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.nodes.push({
				client: {
					getAddressMempool: sinon.stub().callsArgWith(1, null, {
						result: [
							{
								txid: '2766cc1a65d1c99fa9cd13571240aceab90799e58898d2f1b4a33fd38fde855f',
							}
						]
					})
				}
			});
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, new Error('test'));
			qtumd.getAddressBalance = sinon.stub().callsArgWith(2, null, {});
			var address = '';
			var options = {};
			qtumd.getAddressSummary(address, options, function(err) {
				should.exist(err);
				err.should.be.instanceof(Error);
				err.message.should.equal('test');
				done();
			});
		});
		it('will handle error from getAddressBalance', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.nodes.push({
				client: {
					getAddressMempool: sinon.stub().callsArgWith(1, null, {
						result: [
							{
								txid: '2766cc1a65d1c99fa9cd13571240aceab90799e58898d2f1b4a33fd38fde855f',
							}
						]
					})
				}
			});
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, null, {});
			qtumd.getAddressBalance = sinon.stub().callsArgWith(2, new Error('test'), {});
			var address = '';
			var options = {};
			qtumd.getAddressSummary(address, options, function(err) {
				should.exist(err);
				err.should.be.instanceof(Error);
				err.message.should.equal('test');
				done();
			});
		});
		it('will handle error from client getAddressMempool', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.nodes.push({
				client: {
					getAddressMempool: sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' })
				}
			});
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, null, {});
			qtumd.getAddressBalance = sinon.stub().callsArgWith(2, null, {});
			var address = '';
			var options = {};
			qtumd.getAddressSummary(address, options, function(err) {
				should.exist(err);
				err.should.be.instanceof(Error);
				err.message.should.equal('Test error');
				done();
			});
		});
		it('should set all properties', function(done) {
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_normalizeAddressArg');
			sinon.spy(qtumd, '_paginateTxids');

			qtumd.nodes.push({
				client: {
					getAddressMempool: sinon.stub().callsArgWith(1, null, {
						result: [
							{
								txid: memtxid1,
								satoshis: -1000000
							},
							{
								txid: memtxid2,
								satoshis: 99999
							}
						]
					})
				}
			});
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, null, [txid1, txid2, txid3]);
			qtumd.getAddressBalance = sinon.stub().callsArgWith(2, null, {
				received: 30 * 1e8,
				balance: 20 * 1e8
			});
			var address = 'qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR';
			var options = {};
			qtumd.getAddressSummary(address, options, function(err, summary) {
				qtumd._paginateTxids.callCount.should.equal(1);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				qtumd.getAddressTxids.callCount.should.equal(1);
				qtumd.getAddressBalance.callCount.should.equal(1);
				qtumd._paginateTxids.args[0][1].should.equal(0);
				qtumd._paginateTxids.args[0][2].should.equal(1000);
				summary.appearances.should.equal(3);
				summary.totalReceived.should.equal(3000000000);
				summary.totalSpent.should.equal(1000000000);
				summary.balance.should.equal(2000000000);
				summary.unconfirmedAppearances.should.equal(2);
				summary.unconfirmedBalance.should.equal(-900001);
				summary.txids.should.deep.equal([
					'28bf4485cc8f869bb8f2aa4beb8ba0a6da1059e0c8275d86ee1fa217dac0a924',
					'dd23969aec657934d4e14e6ffb3aa7b48a7bdafef2eccd5fcc644f48c72e5116',
					'2766cc1a65d1c99fa9cd13571240aceab90799e58898d2f1b4a33fd38fde855f',
					'ac35d7fc488356c3da29c6277594f2099c533766db2d8cc238c42b72ac9b97e4',
					'8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae'
				]);
				done();
			});
		});
		it('will give error with "from" and "to" range that exceeds max size', function(done) {
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_normalizeAddressArg');

			qtumd.nodes.push({
				client: {
					getAddressMempool: sinon.stub().callsArgWith(1, null, {
						result: [
							{
								txid: memtxid1,
								satoshis: -1000000
							},
							{
								txid: memtxid2,
								satoshis: 99999
							}
						]
					})
				}
			});
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, null, [txid1, txid2, txid3]);
			qtumd.getAddressBalance = sinon.stub().callsArgWith(2, null, {
				received: 30 * 1e8,
				balance: 20 * 1e8
			});
			var address = 'qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR';
			var options = {
				from: 0,
				to: 1001
			};
			qtumd.getAddressSummary(address, options, function(err) {
				should.exist(err);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				err.message.match(/^\"from/);
				done();
			});
		});
		it('will get from cache with noTxList', function(done) {
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_normalizeAddressArg');
			sinon.spy(qtumd, '_paginateTxids');

			qtumd.nodes.push({
				client: {
					getAddressMempool: sinon.stub().callsArgWith(1, null, {
						result: [
							{
								txid: memtxid1,
								satoshis: -1000000
							},
							{
								txid: memtxid2,
								satoshis: 99999
							}
						]
					})
				}
			});
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, null, [txid1, txid2, txid3]);
			qtumd.getAddressBalance = sinon.stub().callsArgWith(2, null, {
				received: 30 * 1e8,
				balance: 20 * 1e8
			});
			var address = 'qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR';
			var options = {
				noTxList: true
			};
			function checkSummary(summary) {
				summary.appearances.should.equal(3);
				summary.totalReceived.should.equal(3000000000);
				summary.totalSpent.should.equal(1000000000);
				summary.balance.should.equal(2000000000);
				summary.unconfirmedAppearances.should.equal(2);
				summary.unconfirmedBalance.should.equal(-900001);
				should.not.exist(summary.txids);
			}
			qtumd.getAddressSummary(address, options, function(err, summary) {
				checkSummary(summary);
				qtumd.getAddressTxids.callCount.should.equal(1);
				qtumd.getAddressBalance.callCount.should.equal(1);
				qtumd.getAddressSummary(address, options, function(err, summary) {
					checkSummary(summary);
					qtumd._paginateTxids.callCount.should.equal(0);
					qtumd._normalizeAddressArg.callCount.should.equal(2);
					qtumd.getAddressTxids.callCount.should.equal(1);
					qtumd.getAddressBalance.callCount.should.equal(1);
					done();
				});
			});
		});
		it('will skip querying the mempool with queryMempool set to false', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getAddressMempool = sinon.stub();
			qtumd.nodes.push({
				client: {
					getAddressMempool: getAddressMempool
				}
			});
			sinon.spy(qtumd, '_normalizeAddressArg');
			sinon.spy(qtumd, '_paginateTxids');

			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, null, [txid1, txid2, txid3]);
			qtumd.getAddressBalance = sinon.stub().callsArgWith(2, null, {
				received: 30 * 1e8,
				balance: 20 * 1e8
			});
			var address = 'qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR';
			var options = {
				queryMempool: false
			};
			qtumd.getAddressSummary(address, options, function() {
				getAddressMempool.callCount.should.equal(0);
				qtumd._paginateTxids.callCount.should.equal(1);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				qtumd.getAddressTxids.callCount.should.equal(1);
				qtumd.getAddressBalance.callCount.should.equal(1);
				done();
			});
		});
		it('will give error from _paginateTxids', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			sinon.spy(qtumd, '_paginateTxids');
			var getAddressMempool = sinon.stub();
			qtumd.nodes.push({
				client: {
					getAddressMempool: getAddressMempool
				}
			});
			qtumd.getAddressTxids = sinon.stub().callsArgWith(2, null, [txid1, txid2, txid3]);
			qtumd.getAddressBalance = sinon.stub().callsArgWith(2, null, {
				received: 30 * 1e8,
				balance: 20 * 1e8
			});
			qtumd._paginateTxids = sinon.stub().throws(new Error('test'));
			var address = 'qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR';
			var options = {
				queryMempool: false
			};
			qtumd.getAddressSummary(address, options, function(err) {
				getAddressMempool.callCount.should.equal(0);
				qtumd._paginateTxids.callCount.should.equal(1);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				qtumd.getAddressTxids.callCount.should.equal(1);
				qtumd.getAddressBalance.callCount.should.equal(1);
				err.should.be.instanceOf(Error);
				err.message.should.equal('test');
				done();
			});
		});
	});

	describe('#getRawBlock', function() {
		var blockhash = 'ba163051fc47fc78f520a01faae6356646e7465a139e2ca789ca3cfbcec96d64';
		var blockhex = '00000020d4ff21181cebdf54168db98ee5334213f0b11173612775c91fa4d6856cf6afb65ffd0ea1254ec9da7eca0249dead0e4e0f8b1329f6efcb7bd3f3c8e9e4771e29106f785ab17e171a00000000bcb7d21fb5fd547ab6f0d138669fad4dac03d6201b2449d8febc9328ce4b9068ad54137042cbed624d778860d64e8598f15ff01afa47090721e16493e9ab8faa88ebeb7cd7e7cfeb98ef3d3fa69c1da7adea011f8cb7b264c5f9044b1e21ce3a01000000463044022049d003c095a2115053a58b60a65c741603de9c6449e20f3828525a215bc3de4802205c5cbd7f32c29a58883dfca2576d1454e61ab236865e904cf7e6a4fdaddca34d02020000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff0503fe3d0100ffffffff020000000000000000000000000000000000266a24aa21a9ed598bdca4eab6001d5753ba33e9a50b1986649f4b477948b5f761decd6b742b4e0120000000000000000000000000000000000000000000000000000000000000000000000000020000000188ebeb7cd7e7cfeb98ef3d3fa69c1da7adea011f8cb7b264c5f9044b1e21ce3a010000004847304402201705c73821a6f91be123d1184aa6919f6bb8c86ec2928a793940078eec9d8a2502202234200415dd8c39d651cc4c17983dbf86f5cbc9385114c0f947db8838002a1801ffffffff0b00000000000000000000485d1b03000000232102ab266cbcd634d79269d7326deb622dd8abe83e5560734131cfebb40829213c72ac005a6202000000001976a914b29ec1e265ccb28ad6da4451eb9f275dcebc022688ac005a6202000000001976a9147fce39209069acc415e14ee3f506ee46f8bf644088ac005a6202000000001976a914b29ec1e265ccb28ad6da4451eb9f275dcebc022688ac005a6202000000001976a9145657742155679a88eb56bfe606163ceef3f42d8188ac005a6202000000001976a914ca01e35383979bdec15ce10a88cbdc6219ab3b0988ac005a6202000000001976a914a1bd7f3b948aa9a77c6486ad5f1ebfe247fab4d488ac005a6202000000001976a9149d7c71eff196e749c5ec71277f50d4aef006e4f988ac005a6202000000001976a9142820129a61e503e1fdecacd1133295ef51d2379a88ac005a6202000000001976a9145657742155679a88eb56bfe606163ceef3f42d8188ac00000000';
		it('will give rpc error from client getblockhash', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.nodes.push({
				client: {
					getBlockHash: sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' })
				}
			});
			qtumd.getRawBlock(10, function(err) {
				should.exist(err);
				err.should.be.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give rcp error from client getblock', function(done) {
			var qtumd = new QtumService(baseConfig);

			sinon.spy(qtumd, '_tryAllClients');
			qtumd.nodes.push({
				client: {
					getBlock: sinon.stub().callsArgWith(2, { code: -1, message: 'Test error' })
				}
			});
			qtumd.getRawBlock(blockhash, function(err) {
				should.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				err.should.be.instanceof(errors.RPCError);
				done();
			});
		});
		it('will try all nodes for getblock', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBlockWithError = sinon.stub().callsArgWith(2, { code: -1, message: 'Test error' });
			qtumd.tryAllInterval = 1;
			qtumd.nodes.push({
				client: {
					getBlock: getBlockWithError
				}
			});
			qtumd.nodes.push({
				client: {
					getBlock: getBlockWithError
				}
			});
			qtumd.nodes.push({
				client: {
					getBlock: sinon.stub().callsArgWith(2, null, {
						result: blockhex
					})
				}
			});
			qtumd.getRawBlock(blockhash, function(err, buffer) {
				if (err) {
					return done(err);
				}
				buffer.should.be.instanceof(Buffer);
				getBlockWithError.callCount.should.equal(2);
				done();
			});
		});
		it('will get block from cache', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: blockhex
			});
			qtumd.nodes.push({
				client: {
					getBlock: getBlock
				}
			});
			qtumd.getRawBlock(blockhash, function(err, buffer) {
				if (err) {
					return done(err);
				}
				buffer.should.be.instanceof(Buffer);
				getBlock.callCount.should.equal(1);
				qtumd.getRawBlock(blockhash, function(err, buffer) {
					if (err) {
						return done(err);
					}
					buffer.should.be.instanceof(Buffer);
					getBlock.callCount.should.equal(1);
					done();
				});
			});
		});
		it('will get block by height', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: blockhex
			});
			var getBlockHash = sinon.stub().callsArgWith(1, null, {
				result: 'ba163051fc47fc78f520a01faae6356646e7465a139e2ca789ca3cfbcec96d64'
			});
			qtumd.nodes.push({
				client: {
					getBlock: getBlock,
					getBlockHash: getBlockHash
				}
			});
			qtumd.getRawBlock(0, function(err, buffer) {
				if (err) {
					return done(err);
				}
				buffer.should.be.instanceof(Buffer);
				getBlock.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				done();
			});
		});
	});

	describe('#getBlock', function() {
		var blockhex = '0100000000000000000000000000000000000000000000000000000000000000000000006db905142382324db417761891f2d2f355ea92f27ab0fc35e59e90b50e0534edf5d2af59ffff001fc1257000e965ffd002cd6ad0e2dc402b8044de833e06b23127ea8c3d80aec9141077149556e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b4210000000000000000000000000000000000000000000000000000000000000000ffffffff000101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff420004bf91221d0104395365702030322c203230313720426974636f696e20627265616b732024352c30303020696e206c6174657374207072696365206672656e7a79ffffffff0100f2052a010000004341040d61d8653448c98731ee5fffd303c15e71ec2057b77f11ab3601979728cdaff2d68afbba14e4fa0bc44f2072b0b23ef63717f8cdfbe58dcd33f32b6afe98741aac00000000';
		it('will give an rpc error from client getblock', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlock = sinon.stub().callsArgWith(2, { code: -1, message: 'Test error' });
			var getBlockHash = sinon.stub().callsArgWith(1, null, {});
			qtumd.nodes.push({
				client: {
					getBlock: getBlock,
					getBlockHash: getBlockHash
				}
			});
			qtumd.getBlock(0, function(err) {
				qtumd._tryAllClients.callCount.should.equal(2);
				getBlock.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				err.should.be.instanceof(Error);
				done();
			});
		});
		it('will give an rpc error from client getblockhash', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlockHash = sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' });
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd.getBlock(0, function(err) {
				qtumd._tryAllClients.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				err.should.be.instanceof(Error);
				done();
			});
		});
		it('will getblock as qtumcore object from height', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: blockhex
			});
			var getBlockHash = sinon.stub().callsArgWith(1, null, {
				result: 'ea6aa9c122d7bd1a9a994f19de74e59fd03a811be5c892ff5987943a2742ee7c'
			});
			qtumd.nodes.push({
				client: {
					getBlock: getBlock,
					getBlockHash: getBlockHash
				}
			});
			qtumd.getBlock(0, function(err, block) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(2);
				getBlock.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				getBlock.args[0][0].should.equal('ea6aa9c122d7bd1a9a994f19de74e59fd03a811be5c892ff5987943a2742ee7c');
				getBlock.args[0][1].should.equal(false);
				block.should.be.instanceof(qtumcore.Block);
				done();
			});
		});
		it('will getblock as qtumcore object', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: blockhex
			});
			var getBlockHash = sinon.stub();
			qtumd.nodes.push({
				client: {
					getBlock: getBlock,
					getBlockHash: getBlockHash
				}
			});
			qtumd.getBlock('00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b', function(err, block) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getBlock.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(0);
				getBlock.args[0][0].should.equal('00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b');
				getBlock.args[0][1].should.equal(false);
				block.should.be.instanceof(qtumcore.Block);
				done();
			});
		});
		it('will get block from cache', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: blockhex
			});
			var getBlockHash = sinon.stub();
			qtumd.nodes.push({
				client: {
					getBlock: getBlock,
					getBlockHash: getBlockHash
				}
			});
			var hash = '00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b';
			qtumd.getBlock(hash, function(err, block) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(0);
				getBlock.callCount.should.equal(1);
				block.should.be.instanceof(qtumcore.Block);
				qtumd.getBlock(hash, function(err, block) {
					should.not.exist(err);
					qtumd._tryAllClients.callCount.should.equal(1);
					getBlock.callCount.should.equal(1);
					getBlockHash.callCount.should.equal(0);
					block.should.be.instanceof(qtumcore.Block);
					done();
				});
			});
		});
		it('will get block from cache with height (but not height)', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: blockhex
			});
			var getBlockHash = sinon.stub().callsArgWith(1, null, {
				result: '00000000050a6d07f583beba2d803296eb1e9d4980c4a20f206c584e89a4f02b'
			});
			qtumd.nodes.push({
				client: {
					getBlock: getBlock,
					getBlockHash: getBlockHash
				}
			});
			qtumd.getBlock(0, function(err, block) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(2);
				getBlockHash.callCount.should.equal(1);
				getBlock.callCount.should.equal(1);
				block.should.be.instanceof(qtumcore.Block);
				qtumd.getBlock(0, function(err, block) {
					should.not.exist(err);
					qtumd._tryAllClients.callCount.should.equal(3);
					getBlockHash.callCount.should.equal(2);
					getBlock.callCount.should.equal(1);
					block.should.be.instanceof(qtumcore.Block);
					done();
				});
			});
		});
	});

	describe('#getBlockHashesByTimestamp', function() {
		it('should give an rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBlockHashes = sinon.stub().callsArgWith(3, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					getBlockHashes: getBlockHashes
				}
			});
			qtumd.getBlockHashesByTimestamp(1517410000, 1517843954, function(err, hashes) {
				should.exist(err);
				err.message.should.equal('error');
				getBlockHashes.callCount.should.equal(1);
				done();
			});
		});
		it('should get the correct block hashes', function(done) {
			var qtumd = new QtumService(baseConfig);
			var block1 = 'a7efd3834b11c33c86841087d086d9c8a098c021b3c39c3133a085e32c7bdf46';
			var block2 = 'a010c9c94c2eb1267ef00ea05218c414a8793e1ff7694a2fc20d02c365bdbb4a';
			var getBlockHashes = sinon.stub().callsArgWith(3, null, {
				result: [block2, block1]
			});
			qtumd.nodes.push({
				client: {
					getBlockHashes: getBlockHashes
				}
			});
			qtumd.getBlockHashesByTimestamp(1517410000, 1517843954, function(err, hashes) {
				should.not.exist(err);
				getBlockHashes.callCount.should.equal(1);
				hashes.should.deep.equal([block2, block1]);
				done();
			});
		});
	});

	describe('#getBlockHeader', function() {
		var blockhash = 'a010c9c94c2eb1267ef00ea05218c414a8793e1ff7694a2fc20d02c365bdbb4a';
		it('will give error from getBlockHash', function() {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var getBlockHash = sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' });
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd.getBlockHeader(10, function(err) {
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				err.should.be.instanceof(Error);
			});
		});
		it('it will give rpc error from client getblockheader', function() {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var getBlockHeader = sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' });
			qtumd.nodes.push({
				client: {
					getBlockHeader: getBlockHeader
				}
			});
			qtumd.getBlockHeader(blockhash, function(err) {
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				err.should.be.instanceof(Error);
			});
		});
		it('it will give rpc error from client getblockhash', function() {
			var qtumd = new QtumService(baseConfig);
			var getBlockHeader = sinon.stub();
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var getBlockHash = sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' });
			qtumd.nodes.push({
				client: {
					getBlockHeader: getBlockHeader,
					getBlockHash: getBlockHash
				}
			});
			qtumd.getBlockHeader(0, function(err) {
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				err.should.be.instanceof(Error);
			});
		});
		it('will give result from client getblockheader (from height)', function() {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var result = {
				hash: 'a010c9c94c2eb1267ef00ea05218c414a8793e1ff7694a2fc20d02c365bdbb4a',
				version: 536870912,
				confirmations: 7,
				height: 81419,
				chainWork: '00000000000000000000000000000000000000000000000d8ca593b057b4d64b',
				prevHash: 'a7efd3834b11c33c86841087d086d9c8a098c021b3c39c3133a085e32c7bdf46',
				nextHash: '82bf3c3f24e2f6dce455c135f0e4fada3b12cc6594ac6a0c3660caa365eee725',
				merkleRoot: '91f07188d90aeeb6eb4c4dd49838fbdb46f3b90a685614333fe9787789bf6201',
				time: 1517843744,
				medianTime: 1517842912,
				nonce: 0,
				bits: '1a0ff41e',
				difficulty: 1051610.804201489,
			};
			var getBlockHeader = sinon.stub().callsArgWith(1, null, {
				result: {
					hash: 'a010c9c94c2eb1267ef00ea05218c414a8793e1ff7694a2fc20d02c365bdbb4a',
					version: 536870912,
					confirmations: 7,
					height: 81419,
					chainwork: '00000000000000000000000000000000000000000000000d8ca593b057b4d64b',
					previousblockhash: 'a7efd3834b11c33c86841087d086d9c8a098c021b3c39c3133a085e32c7bdf46',
					nextblockhash: '82bf3c3f24e2f6dce455c135f0e4fada3b12cc6594ac6a0c3660caa365eee725',
					merkleroot: '91f07188d90aeeb6eb4c4dd49838fbdb46f3b90a685614333fe9787789bf6201',
					time: 1517843744,
					mediantime: 1517842912,
					nonce: 0,
					bits: '1a0ff41e',
					difficulty: 1051610.804201489
				}
			});
			var getBlockHash = sinon.stub().callsArgWith(1, null, {
				result: blockhash
			});
			qtumd.nodes.push({
				client: {
					getBlockHeader: getBlockHeader,
					getBlockHash: getBlockHash
				}
			});
			qtumd.getBlockHeader(81419, function(err, blockHeader) {
				should.not.exist(err);
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				getBlockHeader.args[0][0].should.equal(blockhash);
				blockHeader.should.deep.equal(result);
			});
		});
		it('will give result from client getblockheader (from hash)', function() {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var result = {
				hash: 'a010c9c94c2eb1267ef00ea05218c414a8793e1ff7694a2fc20d02c365bdbb4a',
				version: 536870912,
				confirmations: 7,
				height: 81419,
				chainWork: '00000000000000000000000000000000000000000000000d8ca593b057b4d64b',
				prevHash: 'a7efd3834b11c33c86841087d086d9c8a098c021b3c39c3133a085e32c7bdf46',
				nextHash: '82bf3c3f24e2f6dce455c135f0e4fada3b12cc6594ac6a0c3660caa365eee725',
				merkleRoot: '91f07188d90aeeb6eb4c4dd49838fbdb46f3b90a685614333fe9787789bf6201',
				time: 1517843744,
				medianTime: 1517842912,
				nonce: 0,
				bits: '1a0ff41e',
				difficulty: 1051610.804201489,
			};
			var getBlockHeader = sinon.stub().callsArgWith(1, null, {
				result: {
					hash: 'a010c9c94c2eb1267ef00ea05218c414a8793e1ff7694a2fc20d02c365bdbb4a',
					version: 536870912,
					confirmations: 7,
					height: 81419,
					chainwork: '00000000000000000000000000000000000000000000000d8ca593b057b4d64b',
					previousblockhash: 'a7efd3834b11c33c86841087d086d9c8a098c021b3c39c3133a085e32c7bdf46',
					nextblockhash: '82bf3c3f24e2f6dce455c135f0e4fada3b12cc6594ac6a0c3660caa365eee725',
					merkleroot: '91f07188d90aeeb6eb4c4dd49838fbdb46f3b90a685614333fe9787789bf6201',
					time: 1517843744,
					mediantime: 1517842912,
					nonce: 0,
					bits: '1a0ff41e',
					difficulty: 1051610.804201489
				}
			});
			var getBlockHash = sinon.stub();
			qtumd.nodes.push({
				client: {
					getBlockHeader: getBlockHeader,
					getBlockHash: getBlockHash
				}
			});
			qtumd.getBlockHeader(blockhash, function(err, blockHeader) {
				should.not.exist(err);
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(0);
				blockHeader.should.deep.equal(result);
			});
		});
	});

	describe('#_maybeGetBlockHash', function() {
		it('will not get block hash with an address', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlockHash = sinon.stub();
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd._maybeGetBlockHash('qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX', function(err, hash) {
				if (err) {
					return done(err);
				}
				qtumd._tryAllClients.callCount.should.equal(0);
				getBlockHash.callCount.should.equal(0);
				hash.should.equal('qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX');
				done();
			});
		});
		it('will not get block hash with non zero-nine numeric string', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBlockHash = sinon.stub();
			sinon.spy(qtumd, '_tryAllClients');
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd._maybeGetBlockHash('109a', function(err, hash) {
				if (err) {
					return done(err);
				}
				getBlockHash.callCount.should.equal(0);
				qtumd._tryAllClients.callCount.should.equal(0);
				hash.should.equal('109a');
				done();
			});
		});
		it('will get the block hash if argument is a number', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlockHash = sinon.stub().callsArgWith(1, null, {
				result: 'blockhash'
			});
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd._maybeGetBlockHash(10, function(err, hash) {
				if (err) {
					return done(err);
				}
				hash.should.equal('blockhash');
				qtumd._tryAllClients.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				done();
			});
		});
		it('will get the block hash if argument is a number (as string)', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlockHash = sinon.stub().callsArgWith(1, null, {
				result: 'blockhash'
			});
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd._maybeGetBlockHash('10', function(err, hash) {
				if (err) {
					return done(err);
				}
				hash.should.equal('blockhash');
				qtumd._tryAllClients.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				done();
			});
		});
		it('will try multiple nodes if one fails', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlockHash = sinon.stub().callsArgWith(1, null, {
				result: 'blockhash'
			});
			getBlockHash.onCall(0).callsArgWith(1, { code: -1, message: 'test' });
			qtumd.tryAllInterval = 1;
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd._maybeGetBlockHash(10, function(err, hash) {
				if (err) {
					return done(err);
				}
				hash.should.equal('blockhash');
				qtumd._tryAllClients.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(2);
				done();
			});
		});
		it('will give error from getBlockHash', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlockHash = sinon.stub().callsArgWith(1, { code: -1, message: 'test' });
			qtumd.tryAllInterval = 1;
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd._maybeGetBlockHash(10, function(err, hash) {
				getBlockHash.callCount.should.equal(2);
				qtumd._tryAllClients.callCount.should.equal(1);
				err.should.be.instanceOf(Error);
				err.message.should.equal('test');
				err.code.should.equal(-1);
				done();
			});
		});
	});

	describe('#getBlockOverview', function() {
		var blockhash = 'a010c9c94c2eb1267ef00ea05218c414a8793e1ff7694a2fc20d02c365bdbb4a';
		it('will handle error from maybeGetBlockHash', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_maybeGetBlockHash');
			qtumd._maybeGetBlockHash = sinon.stub().callsArgWith(1, new Error('test'));
			qtumd.getBlockOverview(blockhash, function(err) {
				err.should.be.instanceOf(Error);
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				done();
			});
		});
		it('will give error from client.getBlock', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var getBlock = sinon.stub().callsArgWith(2, { code: -1, message: 'test' });
			qtumd.nodes.push({
				client: {
					getBlock: getBlock
				}
			});
			qtumd.getBlockOverview(blockhash, function(err) {
				err.should.be.instanceOf(Error);
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				err.message.should.equal('test');
				done();
			});
		});
		it('will give expected result', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var blockResult = {
				hash: blockhash,
				version: 536870912,
				confirmations: 16,
				height: 81419,
				chainwork: '00000000000000000000000000000000000000000000000d8ca593b057b4d64b',
				previousblockhash: 'a7efd3834b11c33c86841087d086d9c8a098c021b3c39c3133a085e32c7bdf46',
				nextblockhash: '82bf3c3f24e2f6dce455c135f0e4fada3b12cc6594ac6a0c3660caa365eee725',
				merkleroot: '91f07188d90aeeb6eb4c4dd49838fbdb46f3b90a685614333fe9787789bf6201',
				time: 1517843744,
				mediantime: 1517842912,
				nonce: 0,
				bits: '1a0ff41e',
				difficulty: 1051610.804201489,
			};
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: blockResult
			});
			qtumd.nodes.push({
				client: {
					getBlock: getBlock
				}
			});
			function checkBlock(blockOverview) {
				blockOverview.hash.should.equal('a010c9c94c2eb1267ef00ea05218c414a8793e1ff7694a2fc20d02c365bdbb4a');
				blockOverview.version.should.equal(536870912);
				blockOverview.confirmations.should.equal(16);
				blockOverview.height.should.equal(81419);
				blockOverview.chainWork.should.equal('00000000000000000000000000000000000000000000000d8ca593b057b4d64b');
				blockOverview.prevHash.should.equal('a7efd3834b11c33c86841087d086d9c8a098c021b3c39c3133a085e32c7bdf46');
				blockOverview.nextHash.should.equal('82bf3c3f24e2f6dce455c135f0e4fada3b12cc6594ac6a0c3660caa365eee725');
				blockOverview.merkleRoot.should.equal('91f07188d90aeeb6eb4c4dd49838fbdb46f3b90a685614333fe9787789bf6201');
				blockOverview.time.should.equal(1517843744);
				blockOverview.medianTime.should.equal(1517842912);
				blockOverview.nonce.should.equal(0);
				blockOverview.bits.should.equal('1a0ff41e');
				blockOverview.difficulty.should.equal(1051610.804201489);
			}
			qtumd.getBlockOverview(blockhash, function(err, blockOverview) {
				if (err) {
					return done(err);
				}
				checkBlock(blockOverview);
				qtumd.getBlockOverview(blockhash, function(err, blockOverview) {
					checkBlock(blockOverview);
					qtumd._maybeGetBlockHash.callCount.should.equal(2);
					getBlock.callCount.should.equal(1);
					done();
				});
			});
		});
	});

	describe('#estimateFee', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var estimateFee = sinon.stub().callsArgWith(1, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					estimateFee: estimateFee
				}
			});
			qtumd.estimateFee(1, function(err) {
				should.exist(err);
				estimateFee.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will call client estimateFee and give result', function(done) {
			var qtumd = new QtumService(baseConfig);
			var estimateFee = sinon.stub().callsArgWith(1, null, {
				result: -1
			});
			qtumd.nodes.push({
				client: {
					estimateFee: estimateFee
				}
			});
			qtumd.estimateFee(1, function(err, feesPerKb) {
				if (err) {
					return done(err);
				}
				estimateFee.callCount.should.equal(1);
				feesPerKb.should.equal(-1);
				done();
			});
		});
	});

	describe('#sendTransaction', function(done) {
		var tx = qtumcore.Transaction(txhex);
		it('will give rpc error', function() {
			var qtumd = new QtumService(baseConfig);
			var sendRawTransaction = sinon.stub().callsArgWith(2, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					sendRawTransaction: sendRawTransaction
				}
			});
			qtumd.sendTransaction(txhex, function(err) {
				should.exist(err);
				sendRawTransaction.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
			});
		});
		it('will send to client and get hash', function() {
			var qtumd = new QtumService(baseConfig);
			var sendRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: tx.hash
			});
			qtumd.nodes.push({
				client: {
					sendRawTransaction: sendRawTransaction
				}
			});
			qtumd.sendTransaction(txhex, function(err, hash) {
				if (err) {
					return done(err);
				}
				sendRawTransaction.callCount.should.equal(1);
				hash.should.equal(tx.hash);
			});
		});
		it('will send to client with absurd fees and get hash', function() {
			var qtumd = new QtumService(baseConfig);
			var sendRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: tx.hash
			});
			qtumd.nodes.push({
				client: {
					sendRawTransaction: sendRawTransaction
				}
			});
			qtumd.sendTransaction(txhex, { allowAbsurdFees: true }, function(err, hash) {
				if (err) {
					return done(err);
				}
				sendRawTransaction.callCount.should.equal(1);
				hash.should.equal(tx.hash);
			});
		});
		it('missing callback will throw error', function() {
			var qtumd = new QtumService(baseConfig);
			var sendRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: tx.hash
			});
			qtumd.nodes.push({
				client: {
					sendRawTransaction: sendRawTransaction
				}
			});
			var transaction = qtumcore.Transaction();
			(function() {
				qtumd.sendTransaction(transaction);
			}).should.throw(Error);
			sendRawTransaction.callCount.should.equal(1);
		});
	});

	describe('#getRawTransaction', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getRawTransaction = sinon.stub().callsArgWith(1, { message: 'error', code: -1 });
			sinon.spy(qtumd, '_tryAllClients');
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction
				}
			});
			qtumd.getRawTransaction('txid', function(err) {
				should.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will try all nodes', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.tryAllInterval = 1;
			sinon.spy(qtumd, '_tryAllClients');
			var getRawTransactionWithError = sinon.stub().callsArgWith(1, { message: 'error', code: -1 });
			var getRawTransaction = sinon.stub().callsArgWith(1, null, {
				result: txhex
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransactionWithError
				}
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransactionWithError
				}
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction
				}
			});
			qtumd.getRawTransaction('txid', function(err, tx) {
				if (err) {
					return done(err);
				}
				should.exist(tx);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				getRawTransactionWithError.callCount.should.equal(2);
				tx.should.be.an.instanceof(Buffer);
				done();
			});
		});
		it('will get from cache', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getRawTransaction = sinon.stub().callsArgWith(1, null, {
				result: txhex
			});
			sinon.spy(qtumd, '_tryAllClients');
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction
				}
			});
			qtumd.getRawTransaction('txid', function(err, tx) {
				if (err) {
					return done(err);
				}
				should.exist(tx);
				tx.should.be.an.instanceof(Buffer);

				qtumd.getRawTransaction('txid', function(err, tx) {
					should.exist(tx);
					tx.should.be.an.instanceof(Buffer);
					qtumd._tryAllClients.callCount.should.equal(1);
					getRawTransaction.callCount.should.equal(1);
					done();
				});
			});
		});
	});

	describe('#getTransaction', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getRawTransaction = sinon.stub().callsArgWith(1, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction
				}
			});
			qtumd.getTransaction('txid', function(err) {
				should.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will try all nodes', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.tryAllInterval = 1;
			sinon.spy(qtumd, '_tryAllClients');
			var getRawTransactionWithError = sinon.stub().callsArgWith(1, { message: 'error', code: -1 });
			var getRawTransaction = sinon.stub().callsArgWith(1, null, {
				result: txhex
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransactionWithError
				}
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransactionWithError
				}
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction
				}
			});
			qtumd.getTransaction('txid', function(err, tx) {
				if (err) {
					return done(err);
				}
				should.exist(tx);
				getRawTransactionWithError.callCount.should.equal(2);
				getRawTransaction.callCount.should.equal(1);
				qtumd._tryAllClients.callCount.should.equal(1);
				tx.should.be.an.instanceof(qtumcore.Transaction);
				done();
			});
		});
		it('will get from cache', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getRawTransaction = sinon.stub().callsArgWith(1, null, {
				result: txhex
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction
				}
			});
			qtumd.getTransaction('txid', function(err, tx) {
				if (err) {
					return done(err);
				}
				should.exist(tx);
				tx.should.be.an.instanceof(qtumcore.Transaction);

				qtumd.getTransaction('txid', function(err, tx) {
					should.exist(tx);
					qtumd._tryAllClients.callCount.should.equal(1);
					tx.should.be.an.instanceof(qtumcore.Transaction);
					getRawTransaction.callCount.should.equal(1);
					done();
				});

			});
		});
	});

	describe('#getDetailedTransaction', function() {
		var txBuffer = new Buffer('02000000014190bb2542efae983e73e5fe3f2b14af5b06d9901412ac103429cb5f25b3b7eb000000006a47304402206fbe6820216b707506a4ea6e9eb6fa76ba4735bd9d746f5b88f36392a540778d02203c5c719e01f612787358a7cda8bf81fc8286e31f649a69066b46d24c3feac48901210328d2c8d36467b08ec5446d2ead9d0f83e14712ef07b2adafccc4bb75b8d415defeffffff02e00cf80b000000001976a914691a4fda52341467991e030bca618c277798d01d88ac80a4bf07000000001976a91479e7486f7e119736fd736e2ae6fc53c8d795dbc688ac21690100', 'hex');

		var info = {
			blockHash: '71a74c43fcd63c32b75443b353ee5bed42a0246fc1c7546b59d943c13c40caab',
			height: 81802,
			timestamp: 1517898352,
			buffer: txBuffer
		};

		var rpcRawTransaction = {
			hex: txBuffer.toString('hex'),
			blockhash: info.blockHash,
			height: info.height,
			version: 2,
			locktime: 0,
			time: info.timestamp,
			vin: [
				{
					txid: '25c1a1aa519bd719ce403d4ab67df54a63fcc9463f5339d3a851677093c159ce',
					vout: 1,
					scriptSig: {
						asm: '304502210084aead70c437ccaf4c936afe06ccb3ffafc0850e1b7d23eed494cb6bc81269820220793b3861a24cb37ef06889c7ecae4aa92d6bfa387a2d68c7eafad20fab6ce11a[ALL]',
						hex: '48304502210084aead70c437ccaf4c936afe06ccb3ffafc0850e1b7d23eed494cb6bc81269820220793b3861a24cb37ef06889c7ecae4aa92d6bfa387a2d68c7eafad20fab6ce11a01'
					},
					value: 108.81000000,
					valueSat: 10881000000,
					address: 'qTTH1Yr2eKCuDLqfxUyBLCAjmomQ8pyrBt',
					sequence: 4294967295
				}
			],
			vout: [
				{
					value: 109.21000000,
					valueSat: 10921000000,
					n: 1,
					scriptPubKey: {
						asm: '03c62a4c93d5cdcd43000bb254af1f8457bb8312433cb19e496e29a485e279e809 OP_CHECKSIG',
						hex: '2103c62a4c93d5cdcd43000bb254af1f8457bb8312433cb19e496e29a485e279e809ac',
						reqSigs: 1,
						type: 'pubkey',
						addresses: [
							'qTTH1Yr2eKCuDLqfxUyBLCAjmomQ8pyrBt'
						]
					},
					"spentTxId": "adb8437e6685fa3a9f2472ee1ad31c4a63d0a2f8d3118a8230d1570abe95bfc2",
					"spentIndex": 1,
					"spentHeight": 81802
				},
			]
		};

		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			qtumd.nodes.push({
				client: {
					getRawTransaction: sinon.stub().callsArgWith(2, { code: -1, message: 'Test error' })
				}
			});
			var txid = '36b942e65c828af624c7a25de25027fba0dd89d4b29a46ddd2648af6e4db1955';
			qtumd.getDetailedTransaction(txid, function(err) {
				should.exist(err);
				err.should.be.instanceof(errors.RPCError);
				qtumd._tryAllClients.callCount.should.equal(1);
				done();
			});
		});
		it('should give a transaction with all properties', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: rpcRawTransaction
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction
				}
			});
			var txid = '36b942e65c828af624c7a25de25027fba0dd89d4b29a46ddd2648af6e4db1955';
			function checkTx(tx) {
				/* jshint maxstatements: 30 */
				should.exist(tx);
				should.not.exist(tx.coinbase);
				should.equal(tx.hex, txBuffer.toString('hex'));
				should.equal(tx.blockHash, '71a74c43fcd63c32b75443b353ee5bed42a0246fc1c7546b59d943c13c40caab');
				should.equal(tx.height, 81802);
				should.equal(tx.blockTimestamp, 1517898352);
				should.equal(tx.version, 2);
				should.equal(tx.locktime, 0);
				should.equal(tx.feeSatoshis, (10881000000 - 10921000000));
				should.equal(tx.inputSatoshis, 10881000000);
				should.equal(tx.outputSatoshis, 10921000000);
				should.equal(tx.hash, txid);
				var input = tx.inputs[0];
				should.equal(input.prevTxId, '25c1a1aa519bd719ce403d4ab67df54a63fcc9463f5339d3a851677093c159ce');
				should.equal(input.outputIndex, 1);
				should.equal(input.satoshis, 10881000000);
				should.equal(input.sequence, 4294967295);
				should.equal(input.script, '48304502210084aead70c437ccaf4c936afe06ccb3ffafc0850e1b7d23eed494cb6bc81269820220793b3861a24cb37ef06889c7ecae4aa92d6bfa387a2d68c7eafad20fab6ce11a01');
				should.equal(input.scriptAsm, '304502210084aead70c437ccaf4c936afe06ccb3ffafc0850e1b7d23eed494cb6bc81269820220793b3861a24cb37ef06889c7ecae4aa92d6bfa387a2d68c7eafad20fab6ce11a[ALL]');
				should.equal(input.address, 'qTTH1Yr2eKCuDLqfxUyBLCAjmomQ8pyrBt');
				var output = tx.outputs[0];
				should.equal(output.satoshis, 10921000000);
				should.equal(output.script, '2103c62a4c93d5cdcd43000bb254af1f8457bb8312433cb19e496e29a485e279e809ac');
				should.equal(output.scriptAsm, '03c62a4c93d5cdcd43000bb254af1f8457bb8312433cb19e496e29a485e279e809 OP_CHECKSIG');
				should.equal(output.address, 'qTTH1Yr2eKCuDLqfxUyBLCAjmomQ8pyrBt');
				// taken from livenet, testnet getrawtransaction result doesnt contain these fields
				should.equal(output.spentTxId, 'adb8437e6685fa3a9f2472ee1ad31c4a63d0a2f8d3118a8230d1570abe95bfc2');
				should.equal(output.spentIndex, 1);
				should.equal(output.spentHeight, 81802);
			}
			qtumd.getDetailedTransaction(txid, function(err, tx) {
				if (err) {
					return done(err);
				}
				checkTx(tx);
				qtumd.getDetailedTransaction(txid, function(err, tx) {
					if (err) {
						return done(err);
					}
					checkTx(tx);
					qtumd._tryAllClients.callCount.should.equal(1);
					getRawTransaction.callCount.should.equal(1);
					done();
				});
			});
		});
		it('should set coinbase to true', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
			delete rawTransaction.vin[0];
			rawTransaction.vin = [
				{
					coinbase: 'abcdef'
				}
			];
			var getRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: rawTransaction
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction,
				}
			});
			var txid = '36b942e65c828af624c7a25de25027fba0dd89d4b29a46ddd2648af6e4db1955';
			qtumd.getDetailedTransaction(txid, function(err, tx) {
				should.exist(tx);
				should.equal(tx.coinbase, true);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				tx.inputSatoshis.should.be.equal(0);
				tx.feeSatoshis.should.be.equal(0);
				done();
			});
		});
		it('will not include address if address length is zero', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
			rawTransaction.vout[0].scriptPubKey.addresses = [];
			var getRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: rawTransaction
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction
				}
			});
			var txid = '36b942e65c828af624c7a25de25027fba0dd89d4b29a46ddd2648af6e4db1955';
			qtumd.getDetailedTransaction(txid, function(err, tx) {
				should.exist(tx);
				qtumd._tryAllClients.callCount.should.equal(1);
				should.equal(tx.outputs[0].address, null);
				getRawTransaction.callCount.should.equal(1);
				done();
			});
		});
		it('will not include address if address length is greater than 1', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
			rawTransaction.vout[0].scriptPubKey.addresses = ['one', 'two'];
			var getRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: rawTransaction
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction,
				}
			});
			var txid = '36b942e65c828af624c7a25de25027fba0dd89d4b29a46ddd2648af6e4db1955';
			qtumd.getDetailedTransaction(txid, function(err, tx) {
				should.exist(tx);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				should.equal(tx.outputs[0].address, null);
				done();
			});
		});
		it('will handle scriptPubKey.addresses not being set', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
			delete rawTransaction.vout[0].scriptPubKey['addresses'];
			var getRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: rawTransaction
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction,
				}
			});
			var txid = '36b942e65c828af624c7a25de25027fba0dd89d4b29a46ddd2648af6e4db1955';
			qtumd.getDetailedTransaction(txid, function(err, tx) {
				should.exist(tx);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				should.equal(tx.outputs[0].address, null);
				done();
			});
		});
		it('will not include script if input missing scriptSig or coinbase', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
			delete rawTransaction.vin[0].scriptSig;
			delete rawTransaction.vin[0].coinbase;
			var getRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: rawTransaction
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction,
				}
			});
			var txid = '36b942e65c828af624c7a25de25027fba0dd89d4b29a46ddd2648af6e4db1955';
			qtumd.getDetailedTransaction(txid, function(err, tx) {
				should.exist(tx);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				should.equal(tx.inputs[0].script, null);
				done();
			});
		});
		it('will set height to -1 if missing height and get time from raw transaction', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
			delete rawTransaction.height;
			var getRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: rawTransaction
			});
			var getMempoolEntry = sinon.stub().callsArgWith(1, null, {
				result: {}
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction,
					getMempoolEntry: getMempoolEntry
				}
			});
			var txid = '36b942e65c828af624c7a25de25027fba0dd89d4b29a46ddd2648af6e4db1955';
			qtumd.getDetailedTransaction(txid, function(err, tx) {
				should.exist(tx);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				should.equal(tx.height, -1);
				should.equal(tx.blockTimestamp, 1517898352);
				done();
			});
		});
		it('will set height to -1 if missing height and get time from mempoolentry', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var rawTransaction = JSON.parse((JSON.stringify(rpcRawTransaction)));
			delete rawTransaction.time;
			delete rawTransaction.height;
			var getRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: rawTransaction
			});
			var getMempoolEntry = sinon.stub().callsArgWith(1, null, {
				result: {
					time: 1517898352
				}
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction,
					getMempoolEntry: getMempoolEntry
				}
			});
			var txid = '36b942e65c828af624c7a25de25027fba0dd89d4b29a46ddd2648af6e4db1955';
			qtumd.getDetailedTransaction(txid, function(err, tx) {
				should.exist(tx);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				should.equal(tx.height, -1);
				should.equal(tx.receivedTime, 1517898352);
				done();
			});
		});
	});

	describe('#getBestBlockHash', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBestBlockHash = sinon.stub().callsArgWith(0, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					getBestBlockHash: getBestBlockHash
				}
			});
			qtumd.getBestBlockHash(function(err) {
				should.exist(err);
				getBestBlockHash.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will call client getInfo and give result', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getBestBlockHash = sinon.stub().callsArgWith(0, null, {
				result: '0c9d2f58e10d9089c8543f1a519023eef5f73e659258b1a433e8cc9296a42e72'
			});
			qtumd.nodes.push({
				client: {
					getBestBlockHash: getBestBlockHash
				}
			});
			qtumd.getBestBlockHash(function(err, hash) {
				if (err) {
					return done(err);
				}
				getBestBlockHash.callCount.should.equal(1);
				should.exist(hash);
				hash.should.equal('0c9d2f58e10d9089c8543f1a519023eef5f73e659258b1a433e8cc9296a42e72');
				done();
			});
		});
	});

	describe('#getSpentInfo', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getSpentInfo = sinon.stub().callsArgWith(1, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					getSpentInfo: getSpentInfo
				}
			});
			qtumd.getSpentInfo({}, function(err) {
				should.exist(err);
				getSpentInfo.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will empty object when not found', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getSpentInfo = sinon.stub().callsArgWith(1, { message: 'test', code: -5 });
			qtumd.nodes.push({
				client: {
					getSpentInfo: getSpentInfo
				}
			});
			qtumd.getSpentInfo({}, function(err, info) {
				should.not.exist(err);
				getSpentInfo.callCount.should.equal(1);
				info.should.deep.equal({});
				done();
			});
		});
		it('will call client getSpentInfo and give result', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getSpentInfo = sinon.stub().callsArgWith(1, null, {
				result: {
					txid: 'txid',
					index: 10,
					height: 101
				}
			});
			qtumd.nodes.push({
				client: {
					getSpentInfo: getSpentInfo
				}
			});
			qtumd.getSpentInfo({}, function(err, info) {
				if (err) {
					return done(err);
				}
				getSpentInfo.callCount.should.equal(1);
				info.txid.should.equal('txid');
				info.index.should.equal(10);
				info.height.should.equal(101);
				done();
			});
		});
	});

	describe('#getInfo', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getInfo = sinon.stub().callsArgWith(0, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					getInfo: getInfo
				}
			});
			qtumd.getInfo(function(err) {
				should.exist(err);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will call client getInfo and give result', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.node.getNetworkName = sinon.stub().returns('testnet');
			var getInfo = sinon.stub().callsArgWith(0, null, {
				result: {
					"version": 140900,
					"protocolversion": 70016,
					"walletversion": 130000,
					"balance": 0.00000000,
					"stake": 0.00000000,
					"blocks": 81853,
					"timeoffset": 0,
					"connections": 8,
					"proxy": "",
					"difficulty": {
						"proof-of-work": 1.52587890625e-05,
						"proof-of-stake": 631574.5382418882
					},
					"testnet": true,
					"moneysupply": 100307412,
					"keypoololdest": 1517474513,
					"keypoolsize": 100,
					"paytxfee": 0.00000000,
					"relayfee": 0.00400000,
					"errors": ""
				}
			});

			qtumd.getSubsidy = sinon.stub().callsArgWith(1, null, 400000000);
			qtumd.nodes.push({
				client: {
					getInfo: getInfo,
				},
			});

			qtumd.getInfo(function(err, info) {
				if (err) {
					return done(err);
				}

				qtumd.getSubsidy.callCount.should.equal(1);
				qtumd.client.getInfo.callCount.should.equal(1);

				should.exist(info);
				should.equal(info.version, 140900);
				should.equal(info.protocolVersion, 70016);
				should.equal(info.walletversion, 130000);
				should.equal(info.balance, 0.00000000);
				should.equal(info.blocks, 81853);
				should.equal(info.timeOffset, 0);
				should.equal(info.connections, 8);
				should.equal(info.difficulty['proof-of-work'], 1.52587890625e-05);
				should.equal(info.difficulty['proof-of-stake'], 631574.5382418882);
				should.equal(info.testnet, true);
				should.equal(info.keypoololdest, 1517474513)
				should.equal(info.keypoolsize, 100)
				should.equal(info.network, 'testnet');
				should.equal(info.paytxfee, 0.00000000);
				should.equal(info.relayFee, 0.00400000);
				should.equal(info.reward, 400000000);
				should.equal(info.errors, '');

				done();
			});
		});
	});

	describe('#generateBlock', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var generate = sinon.stub().callsArgWith(1, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					generate: generate
				}
			});
			qtumd.generateBlock(10, function(err) {
				should.exist(err);
				generate.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will call client generate and give result', function(done) {
			var qtumd = new QtumService(baseConfig);
			var generate = sinon.stub().callsArgWith(1, null, {
				result: ['hash']
			});
			qtumd.nodes.push({
				client: {
					generate: generate
				}
			});
			qtumd.generateBlock(10, function(err, hashes) {
				if (err) {
					return done(err);
				}
				hashes.length.should.equal(1);
				generate.callCount.should.equal(1);
				hashes[0].should.equal('hash');
				done();
			});
		});
	});

	describe('#stop', function() {
		it('will callback if spawn is not set', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.stop(done);
		});
		it('will exit spawned process', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.spawn = {};
			qtumd.spawn.process = new EventEmitter();
			qtumd.spawn.process.kill = sinon.stub();
			qtumd.stop(done);
			qtumd.spawn.process.kill.callCount.should.equal(1);
			qtumd.spawn.process.kill.args[0][0].should.equal('SIGINT');
			qtumd.spawn.process.emit('exit', 0);
		});
		it('will give error with non-zero exit status code', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.spawn = {};
			qtumd.spawn.process = new EventEmitter();
			qtumd.spawn.process.kill = sinon.stub();
			qtumd.stop(function(err) {
				err.should.be.instanceof(Error);
				err.code.should.equal(1);
				done();
			});
			qtumd.spawn.process.kill.callCount.should.equal(1);
			qtumd.spawn.process.kill.args[0][0].should.equal('SIGINT');
			qtumd.spawn.process.emit('exit', 1);
		});
		it('will stop after timeout', function(done) {
			var qtumd = new QtumService(baseConfig);
			qtumd.shutdownTimeout = 300;
			qtumd.spawn = {};
			qtumd.spawn.process = new EventEmitter();
			qtumd.spawn.process.kill = sinon.stub();
			qtumd.stop(function(err) {
				err.should.be.instanceof(Error);
				done();
			});
			qtumd.spawn.process.kill.callCount.should.equal(1);
			qtumd.spawn.process.kill.args[0][0].should.equal('SIGINT');
		});
	});

	describe('#getAddressesMempoolBalance', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			var getAddressMempool = sinon.stub().callsArgWith(1, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					getAddressMempool: getAddressMempool,
				}
			});
			qtumd.getAddressesMempoolBalance([], {}, function(err, result) {
				should.exist(err);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				getAddressMempool.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will calc mempool balance', function(done) {
			var deltas = [
				{
					txid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					satoshis: -7679241,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 0,
					timestamp: 1461342704565,
				},
				{
					txid: 'e9dcf22807db77ac0276b03cc2d3a8b03c4837db8ac6650501ef45af1c807cce',
					satoshis: 7679241,
					address: 'qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX',
					index: 1,
					timestamp: 1461342707725,
					prevtxid: 'e44db713844ad64dc08268d50663fcd2c523427227f25427e8329ca56ffc1dd0',
					prevout: 2
				}
			];
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_normalizeAddressArg');
			sinon.spy(qtumd, '_getBalanceFromMempool');
			var getAddressMempool = sinon.stub().callsArgWith(1, null, {
				result: deltas
			});
			qtumd.nodes.push({
				client: {
					getAddressMempool: getAddressMempool,
				}
			});
			qtumd.getAddressesMempoolBalance([], {}, function(err, result) {
				should.not.exist(err);
				qtumd._getBalanceFromMempool.callCount.should.equal(1);
				qtumd._normalizeAddressArg.callCount.should.equal(1);
				getAddressMempool.callCount.should.equal(1);
				result.unconfirmedBalance.should.equal(0);
				done();
			});
		});
	});

	describe('#getJsonRawTransaction', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getRawTransaction = sinon.stub().callsArgWith(2, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction,
				}
			});
			qtumd.getJsonRawTransaction('8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae', function(err) {
				should.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give transaction', function(done) {
			var jsonRawTransaction = {
				"hex": "02000000012716bea30fcd23889cf358be0eacb1ccc9d63edb7873224deceffcbd238e23b001000000494830450221008c31b57b8c4743290a6e18d14270df9f9fb373ae4bb76a18707be7891ef34b1702200f5f1dc9fe7132e524d1687ee5ee7dc9bc16ed575ed3e88bb6dd64c32411438b01ffffffff0b000000000000000000400002750200000023210274c834f66294102b3009febd903a3e75adb3c2e0b081055516a3497acd1ff804ac005a6202000000001976a9145d0b9fff7d476fe0ab4d3167e76f3c2617b72dc088ac005a6202000000001976a914cf1537ab9e46ab673dbef21c145a48cdaf7a4d8b88ac005a6202000000001976a9149739ff641d773d3af8e2edaf638b68c16f02816d88ac005a6202000000001976a91443f7e8010ee0fb4a7ab4283dad38fb9ee3aa4ad988ac005a6202000000001976a914c6c08d9ecb35760356219860553bfc7c19c26b4488ac005a6202000000001976a914b6f603e399f673fee1ff82d27292a918f24b8e4a88ac005a6202000000001976a914e3c8033c2a416030ff221760542ba84ee5b9f43c88ac005a6202000000001976a914c6c08d9ecb35760356219860553bfc7c19c26b4488ac005a6202000000001976a914ddf3cb991927c637a162513f371be6c7c282cf6388ac00000000",
				"txid": "8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae",
				"size": 483,
				"version": 2,
				"locktime": 0,
				"vin": [
					{
						"txid": "b0238e23bdfcefec4d227378db3ed6c9ccb1ac0ebe58f39c8823cd0fa3be1627",
						"vout": 1,
						"scriptSig": {
							"asm": "30450221008c31b57b8c4743290a6e18d14270df9f9fb373ae4bb76a18707be7891ef34b1702200f5f1dc9fe7132e524d1687ee5ee7dc9bc16ed575ed3e88bb6dd64c32411438b[ALL]",
							"hex": "4830450221008c31b57b8c4743290a6e18d14270df9f9fb373ae4bb76a18707be7891ef34b1702200f5f1dc9fe7132e524d1687ee5ee7dc9bc16ed575ed3e88bb6dd64c32411438b01"
						},
						"value": 105.13000000,
						"valueSat": 10513000000,
						"address": "qMDYc9oXQK19dmLSCQNs5okRt8z4XeMr1X",
						"sequence": 4294967295
					}
				],
				"vout": [
					{
						"value": 0.00000000,
						"valueSat": 0,
						"n": 0,
						"scriptPubKey": {
							"asm": "",
							"hex": "",
							"type": "nonstandard"
						}
					},
					{
						"value": 105.53000000,
						"valueSat": 10553000000,
						"n": 1,
						"scriptPubKey": {
							"asm": "0274c834f66294102b3009febd903a3e75adb3c2e0b081055516a3497acd1ff804 OP_CHECKSIG",
							"hex": "210274c834f66294102b3009febd903a3e75adb3c2e0b081055516a3497acd1ff804ac",
							"reqSigs": 1,
							"type": "pubkey",
							"addresses": [
								"qMDYc9oXQK19dmLSCQNs5okRt8z4XeMr1X"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 2,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 5d0b9fff7d476fe0ab4d3167e76f3c2617b72dc0 OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a9145d0b9fff7d476fe0ab4d3167e76f3c2617b72dc088ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 3,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 cf1537ab9e46ab673dbef21c145a48cdaf7a4d8b OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914cf1537ab9e46ab673dbef21c145a48cdaf7a4d8b88ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qcSLSxN1sngCWSrKFZ6UC7ri4hhVSdq9SU"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 4,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 9739ff641d773d3af8e2edaf638b68c16f02816d OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a9149739ff641d773d3af8e2edaf638b68c16f02816d88ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qXLzfk3yjP5rmGiDbJMoQJBgmt5hYcxTH5"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 5,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 43f7e8010ee0fb4a7ab4283dad38fb9ee3aa4ad9 OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a91443f7e8010ee0fb4a7ab4283dad38fb9ee3aa4ad988ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qPkmQiKky5pz8XYMzg4kHc24HntFWWHgag"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 6,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 c6c08d9ecb35760356219860553bfc7c19c26b44 OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914c6c08d9ecb35760356219860553bfc7c19c26b4488ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qbgHcqxXYHVJZXHheGpHwLJsB5epDUtWxe"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 7,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 b6f603e399f673fee1ff82d27292a918f24b8e4a OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914b6f603e399f673fee1ff82d27292a918f24b8e4a88ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qaEnrNyKxqGegoTv5PYgx6h6W41jZ9ANJL"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 8,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 e3c8033c2a416030ff221760542ba84ee5b9f43c OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914e3c8033c2a416030ff221760542ba84ee5b9f43c88ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 9,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 c6c08d9ecb35760356219860553bfc7c19c26b44 OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914c6c08d9ecb35760356219860553bfc7c19c26b4488ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qbgHcqxXYHVJZXHheGpHwLJsB5epDUtWxe"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 10,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 ddf3cb991927c637a162513f371be6c7c282cf63 OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914ddf3cb991927c637a162513f371be6c7c282cf6388ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qdnxYcwsL9JQobgzbtEAJephdePGbhXg7u"
							]
						}
					}
				],
				"blockhash": "2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23",
				"height": 80000,
				"confirmations": 3458,
				"time": 1517638448,
				"blocktime": 1517638448
			};
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: jsonRawTransaction,
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction,
				}
			});
			qtumd.getJsonRawTransaction('8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae', function(err, response) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				response.should.deep.equal(jsonRawTransaction);
				done();
			});
		});
		it('will give transaction from cache', function(done) {
			var jsonRawTransaction = {
				"hex": "02000000012716bea30fcd23889cf358be0eacb1ccc9d63edb7873224deceffcbd238e23b001000000494830450221008c31b57b8c4743290a6e18d14270df9f9fb373ae4bb76a18707be7891ef34b1702200f5f1dc9fe7132e524d1687ee5ee7dc9bc16ed575ed3e88bb6dd64c32411438b01ffffffff0b000000000000000000400002750200000023210274c834f66294102b3009febd903a3e75adb3c2e0b081055516a3497acd1ff804ac005a6202000000001976a9145d0b9fff7d476fe0ab4d3167e76f3c2617b72dc088ac005a6202000000001976a914cf1537ab9e46ab673dbef21c145a48cdaf7a4d8b88ac005a6202000000001976a9149739ff641d773d3af8e2edaf638b68c16f02816d88ac005a6202000000001976a91443f7e8010ee0fb4a7ab4283dad38fb9ee3aa4ad988ac005a6202000000001976a914c6c08d9ecb35760356219860553bfc7c19c26b4488ac005a6202000000001976a914b6f603e399f673fee1ff82d27292a918f24b8e4a88ac005a6202000000001976a914e3c8033c2a416030ff221760542ba84ee5b9f43c88ac005a6202000000001976a914c6c08d9ecb35760356219860553bfc7c19c26b4488ac005a6202000000001976a914ddf3cb991927c637a162513f371be6c7c282cf6388ac00000000",
				"txid": "8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae",
				"size": 483,
				"version": 2,
				"locktime": 0,
				"vin": [
					{
						"txid": "b0238e23bdfcefec4d227378db3ed6c9ccb1ac0ebe58f39c8823cd0fa3be1627",
						"vout": 1,
						"scriptSig": {
							"asm": "30450221008c31b57b8c4743290a6e18d14270df9f9fb373ae4bb76a18707be7891ef34b1702200f5f1dc9fe7132e524d1687ee5ee7dc9bc16ed575ed3e88bb6dd64c32411438b[ALL]",
							"hex": "4830450221008c31b57b8c4743290a6e18d14270df9f9fb373ae4bb76a18707be7891ef34b1702200f5f1dc9fe7132e524d1687ee5ee7dc9bc16ed575ed3e88bb6dd64c32411438b01"
						},
						"value": 105.13000000,
						"valueSat": 10513000000,
						"address": "qMDYc9oXQK19dmLSCQNs5okRt8z4XeMr1X",
						"sequence": 4294967295
					}
				],
				"vout": [
					{
						"value": 0.00000000,
						"valueSat": 0,
						"n": 0,
						"scriptPubKey": {
							"asm": "",
							"hex": "",
							"type": "nonstandard"
						}
					},
					{
						"value": 105.53000000,
						"valueSat": 10553000000,
						"n": 1,
						"scriptPubKey": {
							"asm": "0274c834f66294102b3009febd903a3e75adb3c2e0b081055516a3497acd1ff804 OP_CHECKSIG",
							"hex": "210274c834f66294102b3009febd903a3e75adb3c2e0b081055516a3497acd1ff804ac",
							"reqSigs": 1,
							"type": "pubkey",
							"addresses": [
								"qMDYc9oXQK19dmLSCQNs5okRt8z4XeMr1X"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 2,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 5d0b9fff7d476fe0ab4d3167e76f3c2617b72dc0 OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a9145d0b9fff7d476fe0ab4d3167e76f3c2617b72dc088ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 3,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 cf1537ab9e46ab673dbef21c145a48cdaf7a4d8b OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914cf1537ab9e46ab673dbef21c145a48cdaf7a4d8b88ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qcSLSxN1sngCWSrKFZ6UC7ri4hhVSdq9SU"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 4,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 9739ff641d773d3af8e2edaf638b68c16f02816d OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a9149739ff641d773d3af8e2edaf638b68c16f02816d88ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qXLzfk3yjP5rmGiDbJMoQJBgmt5hYcxTH5"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 5,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 43f7e8010ee0fb4a7ab4283dad38fb9ee3aa4ad9 OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a91443f7e8010ee0fb4a7ab4283dad38fb9ee3aa4ad988ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qPkmQiKky5pz8XYMzg4kHc24HntFWWHgag"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 6,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 c6c08d9ecb35760356219860553bfc7c19c26b44 OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914c6c08d9ecb35760356219860553bfc7c19c26b4488ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qbgHcqxXYHVJZXHheGpHwLJsB5epDUtWxe"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 7,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 b6f603e399f673fee1ff82d27292a918f24b8e4a OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914b6f603e399f673fee1ff82d27292a918f24b8e4a88ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qaEnrNyKxqGegoTv5PYgx6h6W41jZ9ANJL"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 8,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 e3c8033c2a416030ff221760542ba84ee5b9f43c OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914e3c8033c2a416030ff221760542ba84ee5b9f43c88ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 9,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 c6c08d9ecb35760356219860553bfc7c19c26b44 OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914c6c08d9ecb35760356219860553bfc7c19c26b4488ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qbgHcqxXYHVJZXHheGpHwLJsB5epDUtWxe"
							]
						}
					},
					{
						"value": 0.40000000,
						"valueSat": 40000000,
						"n": 10,
						"scriptPubKey": {
							"asm": "OP_DUP OP_HASH160 ddf3cb991927c637a162513f371be6c7c282cf63 OP_EQUALVERIFY OP_CHECKSIG",
							"hex": "76a914ddf3cb991927c637a162513f371be6c7c282cf6388ac",
							"reqSigs": 1,
							"type": "pubkeyhash",
							"addresses": [
								"qdnxYcwsL9JQobgzbtEAJephdePGbhXg7u"
							]
						}
					}
				],
				"blockhash": "2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23",
				"height": 80000,
				"confirmations": 3458,
				"time": 1517638448,
				"blocktime": 1517638448
			};
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getRawTransaction = sinon.stub().callsArgWith(2, null, {
				result: jsonRawTransaction,
			});
			qtumd.nodes.push({
				client: {
					getRawTransaction: getRawTransaction,
				}
			});
			qtumd.getJsonRawTransaction('8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae', function(err, response) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getRawTransaction.callCount.should.equal(1);
				qtumd.getJsonRawTransaction('8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae', function(err, response) {
					should.not.exist(err);
					qtumd._tryAllClients.callCount.should.equal(1);
					getRawTransaction.callCount.should.equal(1);
					response.should.deep.equal(jsonRawTransaction);
					done();
				});
			});
		});
	});

	describe('#getSubsidy', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getSubsidy = sinon.stub().callsArgWith(1, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					getSubsidy: getSubsidy,
				}
			});
			qtumd.getSubsidy(0, function(err) {
				should.exist(err);
				getSubsidy.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give subsidy', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getSubsidy = sinon.stub().callsArgWith(1, null, {
				result: 2000000000000
			});
			qtumd.nodes.push({
				client: {
					getSubsidy: getSubsidy,
				}
			});
			qtumd.getSubsidy(0, function(err, result) {
				should.not.exist(err);
				getSubsidy.callCount.should.equal(1);
				result.should.equal(2000000000000);
				done();
			});
		});
		it('will give subsidy from cache', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getSubsidy = sinon.stub().callsArgWith(1, null, {
				result: 2000000000000
			});
			qtumd.nodes.push({
				client: {
					getSubsidy: getSubsidy,
				}
			});
			qtumd.getSubsidy(0, function(err, result) {
				should.not.exist(err);
				qtumd.getSubsidy(0, function(err, result) {
					should.not.exist(err);
					getSubsidy.callCount.should.equal(1);
					result.should.equal(2000000000000);
					done();
				});
			});
		});
	});

	describe('#getJsonBlock', function() {
		it('will give rpc error from getBlockHash', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlockHash = sinon.stub().callsArgWith(1, { code: -1, message: 'Test error' });
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash
				}
			});
			qtumd.getJsonBlock(0, function(err) {
				should.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give rpc error from getBlock', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getBlock = sinon.stub().callsArgWith(2, { code: -1, message: 'Test error' });
			qtumd.nodes.push({
				client: {
					getBlock: getBlock
				}
			});
			qtumd.getJsonBlock('2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23', function(err) {
				should.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getBlock.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give jsonBlock using block height', function(done) {
			var jsonBlock = {
				"hash": "2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23",
				"confirmations": 3458,
				"strippedsize": 847,
				"size": 883,
				"weight": 3424,
				"height": 80000,
				"version": 536870912,
				"versionHex": "20000000",
				"merkleroot": "ab94a1cde28642273f1f8c611e6960ea1943898a7127c20e6f0f7769fa500f28",
				"hashStateRoot": "c85ef2e09f71361784db209d62874a9ee355227f4d9b91103b0646082de7b11c",
				"hashUTXORoot": "aa8fabe99364e121070947fa1af05ff198854ed66088774d62edcb42701354ad",
				"tx": [
					"e8c7c961a5a0cf1f91fe56bc171bcd81f9e39b5fde55b0ecf8c751e61cac1c7b",
					"8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae"
				],
				"time": 1517638448,
				"mediantime": 1517637808,
				"nonce": 0,
				"bits": "1a16a074",
				"difficulty": 741465.0869531205,
				"chainwork": "00000000000000000000000000000000000000000000000d4111df8e1a8a3ad3",
				"previousblockhash": "0e58e8fd0b9d59b539f19684b38856a38898c4a3be12c4c59d9e672a0a03f132",
				"nextblockhash": "6dbb25e29bf0b1184ab398f9b782e38c66158cff45bc154802e14a13b9e22729",
				"flags": "proof-of-stake",
				"proofhash": "0000000000000000000000000000000000000000000000000000000000000000",
				"modifier": "45d77baa32c1efcd3c6781d493b797beadb797ccac2bc9d2fcdcd0d2be5a8d9b",
				"signature": "30440220692319536ca710ee3a88ab1a7340836580e36e238a6832e1d8e524f144bba95b0220299bde798cf5190fa3022058d3d3cf6a0383b57277fc193aeebd7c9ba33194de"
			};
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var getBlockHash = sinon.stub().callsArgWith(1, null, {
				result: '2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23',
			});
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: jsonBlock,
			});
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash,
					getBlock: getBlock,
				}
			});
			qtumd.getJsonBlock(80000, function(err, result) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(2);
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				getBlock.callCount.should.equal(1);
				result.should.deep.equal(jsonBlock);
				done();
			});
		});
		it('will give jsonBlock using blockhash', function(done) {
			var jsonBlock = {
				"hash": "2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23",
				"confirmations": 3458,
				"strippedsize": 847,
				"size": 883,
				"weight": 3424,
				"height": 80000,
				"version": 536870912,
				"versionHex": "20000000",
				"merkleroot": "ab94a1cde28642273f1f8c611e6960ea1943898a7127c20e6f0f7769fa500f28",
				"hashStateRoot": "c85ef2e09f71361784db209d62874a9ee355227f4d9b91103b0646082de7b11c",
				"hashUTXORoot": "aa8fabe99364e121070947fa1af05ff198854ed66088774d62edcb42701354ad",
				"tx": [
					"e8c7c961a5a0cf1f91fe56bc171bcd81f9e39b5fde55b0ecf8c751e61cac1c7b",
					"8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae"
				],
				"time": 1517638448,
				"mediantime": 1517637808,
				"nonce": 0,
				"bits": "1a16a074",
				"difficulty": 741465.0869531205,
				"chainwork": "00000000000000000000000000000000000000000000000d4111df8e1a8a3ad3",
				"previousblockhash": "0e58e8fd0b9d59b539f19684b38856a38898c4a3be12c4c59d9e672a0a03f132",
				"nextblockhash": "6dbb25e29bf0b1184ab398f9b782e38c66158cff45bc154802e14a13b9e22729",
				"flags": "proof-of-stake",
				"proofhash": "0000000000000000000000000000000000000000000000000000000000000000",
				"modifier": "45d77baa32c1efcd3c6781d493b797beadb797ccac2bc9d2fcdcd0d2be5a8d9b",
				"signature": "30440220692319536ca710ee3a88ab1a7340836580e36e238a6832e1d8e524f144bba95b0220299bde798cf5190fa3022058d3d3cf6a0383b57277fc193aeebd7c9ba33194de"
			};
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var getBlockHash = sinon.stub();
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: jsonBlock,
			});
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash,
					getBlock: getBlock,
				}
			});
			qtumd.getJsonBlock('2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23', function(err, result) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(0);
				getBlock.callCount.should.equal(1);
				result.should.deep.equal(jsonBlock);
				done();
			});
		});
		it('will give jsonBlock using block height from cache', function(done) {
			var jsonBlock = {
				"hash": "2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23",
				"confirmations": 3458,
				"strippedsize": 847,
				"size": 883,
				"weight": 3424,
				"height": 80000,
				"version": 536870912,
				"versionHex": "20000000",
				"merkleroot": "ab94a1cde28642273f1f8c611e6960ea1943898a7127c20e6f0f7769fa500f28",
				"hashStateRoot": "c85ef2e09f71361784db209d62874a9ee355227f4d9b91103b0646082de7b11c",
				"hashUTXORoot": "aa8fabe99364e121070947fa1af05ff198854ed66088774d62edcb42701354ad",
				"tx": [
					"e8c7c961a5a0cf1f91fe56bc171bcd81f9e39b5fde55b0ecf8c751e61cac1c7b",
					"8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae"
				],
				"time": 1517638448,
				"mediantime": 1517637808,
				"nonce": 0,
				"bits": "1a16a074",
				"difficulty": 741465.0869531205,
				"chainwork": "00000000000000000000000000000000000000000000000d4111df8e1a8a3ad3",
				"previousblockhash": "0e58e8fd0b9d59b539f19684b38856a38898c4a3be12c4c59d9e672a0a03f132",
				"nextblockhash": "6dbb25e29bf0b1184ab398f9b782e38c66158cff45bc154802e14a13b9e22729",
				"flags": "proof-of-stake",
				"proofhash": "0000000000000000000000000000000000000000000000000000000000000000",
				"modifier": "45d77baa32c1efcd3c6781d493b797beadb797ccac2bc9d2fcdcd0d2be5a8d9b",
				"signature": "30440220692319536ca710ee3a88ab1a7340836580e36e238a6832e1d8e524f144bba95b0220299bde798cf5190fa3022058d3d3cf6a0383b57277fc193aeebd7c9ba33194de"
			};
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var getBlockHash = sinon.stub().callsArgWith(1, null, {
				result: '2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23',
			});
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: jsonBlock,
			});
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash,
					getBlock: getBlock,
				}
			});
			qtumd.getJsonBlock(80000, function(err, result) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(2);
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(1);
				getBlock.callCount.should.equal(1);
				qtumd.getJsonBlock(80000, function(err, result) {
					should.not.exist(err);
					qtumd._tryAllClients.callCount.should.equal(3);
					qtumd._maybeGetBlockHash.callCount.should.equal(2);
					getBlockHash.callCount.should.equal(2);
					getBlock.callCount.should.equal(1);
					result.should.deep.equal(jsonBlock);
					done();
				});
			});
		});
		it('will give jsonBlock using blockhash from cache', function(done) {
			var jsonBlock = {
				"hash": "2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23",
				"confirmations": 3458,
				"strippedsize": 847,
				"size": 883,
				"weight": 3424,
				"height": 80000,
				"version": 536870912,
				"versionHex": "20000000",
				"merkleroot": "ab94a1cde28642273f1f8c611e6960ea1943898a7127c20e6f0f7769fa500f28",
				"hashStateRoot": "c85ef2e09f71361784db209d62874a9ee355227f4d9b91103b0646082de7b11c",
				"hashUTXORoot": "aa8fabe99364e121070947fa1af05ff198854ed66088774d62edcb42701354ad",
				"tx": [
					"e8c7c961a5a0cf1f91fe56bc171bcd81f9e39b5fde55b0ecf8c751e61cac1c7b",
					"8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae"
				],
				"time": 1517638448,
				"mediantime": 1517637808,
				"nonce": 0,
				"bits": "1a16a074",
				"difficulty": 741465.0869531205,
				"chainwork": "00000000000000000000000000000000000000000000000d4111df8e1a8a3ad3",
				"previousblockhash": "0e58e8fd0b9d59b539f19684b38856a38898c4a3be12c4c59d9e672a0a03f132",
				"nextblockhash": "6dbb25e29bf0b1184ab398f9b782e38c66158cff45bc154802e14a13b9e22729",
				"flags": "proof-of-stake",
				"proofhash": "0000000000000000000000000000000000000000000000000000000000000000",
				"modifier": "45d77baa32c1efcd3c6781d493b797beadb797ccac2bc9d2fcdcd0d2be5a8d9b",
				"signature": "30440220692319536ca710ee3a88ab1a7340836580e36e238a6832e1d8e524f144bba95b0220299bde798cf5190fa3022058d3d3cf6a0383b57277fc193aeebd7c9ba33194de"
			};
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			sinon.spy(qtumd, '_maybeGetBlockHash');
			var getBlockHash = sinon.stub();
			var getBlock = sinon.stub().callsArgWith(2, null, {
				result: jsonBlock,
			});
			qtumd.nodes.push({
				client: {
					getBlockHash: getBlockHash,
					getBlock: getBlock,
				}
			});
			qtumd.getJsonBlock('2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23', function(err, result) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				qtumd._maybeGetBlockHash.callCount.should.equal(1);
				getBlockHash.callCount.should.equal(0);
				getBlock.callCount.should.equal(1);
				qtumd.getJsonBlock('2f46b26835e9d768edd2afd393bdaf16cb141a95a663dc1c303e086a8af05d23', function(err, result) {
					should.not.exist(err);
					qtumd._tryAllClients.callCount.should.equal(1);
					qtumd._maybeGetBlockHash.callCount.should.equal(2);
					getBlockHash.callCount.should.equal(0);
					getBlock.callCount.should.equal(1);
					result.should.deep.equal(jsonBlock);
					done();
				});
			});
		});
	});

	describe('#subscribeBalance', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will not add an invalid address', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter = new EventEmitter();
			qtumd.subscribeBalance(emitter, ['invalidaddress']);
			should.not.exist(qtumd.subscriptions.balance['invalidaddress']);
			log.info.callCount.should.equal(1);
		});
		it('will add a valid address', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter = new EventEmitter();
			qtumd.subscribeBalance(emitter, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			should.exist(qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			log.info.callCount.should.equal(1);

		});
		it('will handle multiple address subscribers', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscribeBalance(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscribeBalance(emitter2, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			should.exist(qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(2);
			log.info.callCount.should.equal(2);
		});
		it('will not add the same emitter twice', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			qtumd.subscribeBalance(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscribeBalance(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			should.exist(qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
			log.info.callCount.should.equal(2);
		});
	});

	describe('#unsubscribeBalance', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('it will remove a subscription', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscribeBalance(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscribeBalance(emitter2, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			should.exist(qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(2);
			qtumd.unsubscribeBalance(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
			log.info.callCount.should.equal(3);
		});
		it('will unsubscribe subscriptions for an emitter', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter1, emitter2];
			qtumd.unsubscribeBalance(emitter1);
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
			log.info.callCount.should.equal(1);
		});
		it('will NOT unsubscribe subscription with missing address', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter1, emitter2];
			qtumd.unsubscribeBalance(emitter1, ['qNq9mhTgH7KzKKDDwQ87Ain7mtyktheXyX']);
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(2);
			log.info.callCount.should.equal(1);
		});
		it('will NOT unsubscribe subscription with missing emitter', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter2];
			qtumd.unsubscribeBalance(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'][0].should.equal(emitter2);
			log.info.callCount.should.equal(1);
		});
		it('will remove empty addresses', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter1, emitter2];
			qtumd.unsubscribeBalance(emitter1, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.unsubscribeBalance(emitter2, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			should.not.exist(qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			log.info.callCount.should.equal(2);
		});
		it('will unsubscribe emitter for all addresses', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter1, emitter2];
			qtumd.subscriptions.balance['qRRv2uwzP5YSfWcnkcEUP25jvEDW7BJz1a'] = [emitter1, emitter2];
			sinon.spy(qtumd, 'unsubscribeBalanceAll');
			qtumd.unsubscribeBalance(emitter1);
			qtumd.unsubscribeBalanceAll.callCount.should.equal(1);
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
			qtumd.subscriptions.balance['qRRv2uwzP5YSfWcnkcEUP25jvEDW7BJz1a'].length.should.equal(1);
			log.info.callCount.should.equal(1);
		});
	});

	describe('#unsubscribeBalanceAll', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will unsubscribe emitter for all addresses', function() {
			var qtumd = new QtumService(baseConfig);
			var emitter1 = new EventEmitter();
			var emitter2 = new EventEmitter();
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'] = [emitter1, emitter2];
			qtumd.subscriptions.balance['qRRv2uwzP5YSfWcnkcEUP25jvEDW7BJz1a'] = [emitter1, emitter2];
			qtumd.subscriptions.balance['qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2'] = [emitter2];
			qtumd.subscriptions.balance['qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR'] = [emitter1];
			qtumd.unsubscribeBalanceAll(emitter1);
			qtumd.subscriptions.balance['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'].length.should.equal(1);
			qtumd.subscriptions.balance['qRRv2uwzP5YSfWcnkcEUP25jvEDW7BJz1a'].length.should.equal(1);
			qtumd.subscriptions.balance['qeKn9hTqktwBRNGthi7YTfr8W7VKvZSgU2'].length.should.equal(1);
			should.not.exist(qtumd.subscriptions.balance['qS3MvbBY8y8xNZx2GVyMEdnQJTCPWoPLUR']);
			log.info.callCount.should.equal(1);
		});
	});

	describe('#_notifyBalanceSubscribers', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will notify balance subscribers', function(done) {
			var emitter = new EventEmitter();
			sinon.spy(emitter, 'emit');

			var addresses = [
				'qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'
			];
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_notifyBalanceSubscriber');
			qtumd._getAddressesFromTransaction = sinon.stub().returns(addresses);
			qtumd.getAddressSummary = sinon.stub().callsArgWith(2, null, {
				address: 'qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z',
				txid: '8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae',
				totalReceived: 2,
				totalSpent: 1,
				balance: 1,
				unconfirmedBalance: 50
			});


			emitter.on('quantumd/addressbalance', function(data) {
				data.balance.should.equal(1);
				data.totalReceived.should.equal(2);
				data.totalSpent.should.equal(1);
				data.unconfirmedBalance.should.equal(50);
				data.address.should.equal(addresses[0]);
				data.txid.should.equal('8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae');
				qtumd._notifyBalanceSubscriber.callCount.should.equal(1);
				qtumd._getAddressesFromTransaction.callCount.should.equal(1);
				emitter.emit.callCount.should.equal(1);
				done();
			});


			let transaction = {};

			qtumd.subscribeBalance(emitter, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);

			qtumd._notifyBalanceSubscribers('8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae', transaction);

		})
	});

	describe('#_notifyBalanceSubscriber', function() {
		var sandbox = sinon.sandbox.create();
		beforeEach(function() {
			sandbox.stub(log, 'info');
		});
		afterEach(function() {
			sandbox.restore();
		});
		it('will notify balance subscriber', function(done) {
			var emitter = new EventEmitter();
			sinon.spy(emitter, 'emit');
			var qtumd = new QtumService(baseConfig);
			qtumd.subscribeBalance(emitter, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);
			qtumd.getAddressSummary = sinon.stub().callsArgWith(2, null, {
				address: 'qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z',
				txid: '8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae',
				totalReceived: 10,
				totalSpent: 10,
				balance: 0,
				unconfirmedBalance: 100
			});

			emitter.on('quantumd/addressbalance', function(data) {
				data.balance.should.equal(0);
				data.totalReceived.should.equal(10);
				data.totalSpent.should.equal(10);
				data.unconfirmedBalance.should.equal(100);
				data.address.should.equal('qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z');
				data.txid.should.equal('8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae');
				emitter.emit.callCount.should.equal(1);
				qtumd.getAddressSummary.callCount.should.equal(1);
				done();
			});

			let transaction = {};

			qtumd.subscribeBalance(emitter, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z']);

			qtumd._notifyBalanceSubscriber('qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z', '8aad6af88ad09d8ce12c09586695c2abf8e5e38908f775e2d0c4b457ee0f4eae');

		});
	});

	describe('#listUnspent', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var listUnspent = sinon.stub().callsArgWith(3, { message: 'error', code: -1 });
			qtumd.nodes.push({
				client: {
					listUnspent: listUnspent,
				}
			});
			qtumd.listUnspent(0, 65000, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'], function(err) {
				should.exist(err);
				listUnspent.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give array of unspent transaction outputs', function(done) {
			var list = [
				{
					"txid": "3f3ebee841352f9d569f2533e7cf7c8d70ee118b70a99fcfd142db87a084c212",
					"vout": 1,
					"address": "qZLdL7mAQNPHYeBHHtLerPPWNXTTPucEGA",
					"account": "",
					"scriptPubKey": "76a914ad186fd2df3a809d578bb4b991df4b455dc7ba7488ac",
					"amount": 22.00000000,
					"confirmations": 482,
					"spendable": true,
					"solvable": true
				}
			];
			var qtumd = new QtumService(baseConfig);
			var listUnspent = sinon.stub().callsArgWith(3, null, {
				result: list
			});
			qtumd.nodes.push({
				client: {
					listUnspent: listUnspent,
				}
			});
			qtumd.listUnspent(0, 65000, ['qfFYCmU7ACsDUbor4Do9AP1XxkocEKhs3z'], function(err, result) {
				should.not.exist(err);
				listUnspent.callCount.should.equal(1);
				result.should.deep.equal(list);
				done();
			});
		});
	});

	describe('#getNewAddress', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getNewAddress = sinon.stub().callsArgWith(0, { message: 'Test error', code: -1 });
			qtumd.nodes.push({
				client: {
					getNewAddress: getNewAddress,
				}
			});
			qtumd.getNewAddress(function(err, result) {
				should.exist(err);
				getNewAddress.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give new address', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getNewAddress = sinon.stub().callsArgWith(0, null, {
				result: 'qZLdL7mAQNPHYeBHHtLerPPWNXTTPucEGA',
			});
			qtumd.nodes.push({
				client: {
					getNewAddress: getNewAddress,
				}
			});
			qtumd.getNewAddress(function(err, result) {
				should.not.exist(err);
				getNewAddress.callCount.should.equal(1);
				result.address.should.equal('qZLdL7mAQNPHYeBHHtLerPPWNXTTPucEGA');
				done();
			});
		});
	});

	describe('#callContract', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var callContract = sinon.stub().callsArgWith(3, { message: 'Test error', code: -1 });
			qtumd.nodes.push({
				client: {
					callContract: callContract,
				}
			});
			qtumd.callContract('f6177bc9812eeb531907621af6641a41133dea9e', 'd7bb99ba', {}, function(err, result) {
				should.exist(err);
				callContract.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will call contract', function(done) {
			var callContractResult = {
				"address": "f6177bc9812eeb531907621af6641a41133dea9e",
				"executionResult": {
					"gasUsed": 39999999,
					"excepted": "BadInstruction",
					"newAddress": "f6177bc9812eeb531907621af6641a41133dea9e",
					"output": "",
					"codeDeposit": 0,
					"gasRefunded": 0,
					"depositSize": 0,
					"gasForDeposit": 0
				},
				"transactionReceipt": {
					"stateRoot": "b1f9756ec0e984cf3d16e79ccf97b09f62380ae27acd97570b4188d3a7fc225b",
					"gasUsed": 39999999,
					"bloom": "00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
					"log": [
					]
				}
			};

			var qtumd = new QtumService(baseConfig);
			var callContract = sinon.stub().callsArgWith(3, null, {
				result: callContractResult,
			});
			qtumd.nodes.push({
				client: {
					callContract: callContract,
				}
			});
			qtumd.callContract('f6177bc9812eeb531907621af6641a41133dea9e', 'd7bb99ba', {}, function(err, result) {
				should.not.exist(err);
				callContract.callCount.should.equal(1);
				result.should.deep.equal(callContractResult);
				done();
			});
		});
	});

	describe('#getAccountInfo', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			var getAccountInfo = sinon.stub().callsArgWith(1, { message: 'Test error', code: -1 });
			qtumd.nodes.push({
				client: {
					getAccountInfo: getAccountInfo,
				}
			});
			qtumd.getAccountInfo('f6177bc9812eeb531907621af6641a41133dea9e', function(err, result) {
				should.exist(err);
				getAccountInfo.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give account info', function(done) {
			var accountInfo = {
				"address": "f6177bc9812eeb531907621af6641a41133dea9e",
				"balance": 0,
				"storage": {
					"009a2b421862c6c177f73ea9aedc2fb304cbc8ba07c0182ad262376b40a312ce": {
						"663540ddc64f774b1fca9d6648812c62d228d87fb662c87ed694d9006c9e07b1": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"009b7389e13c8bfcc9a54fc2784d36f157bd4b9f5791def237b06b600f65d28c": {
						"1be5c4b3ce6b6886670905fd4c7e94befea3a78d5a0a5cd98d65f415978ec488": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"035706c3d8c01427e7494f5899d7d0a0a64baf091c977972a86b1fd31eb9dcd7": {
						"bcff6fa977df4c2fcfab392417a84c0c8db603c01dd998e79d49816688e841d7": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"03fac7d0ed7c64751ebc5d6cc9bf86a98b2109c28bb87d95632c271bc24d05ba": {
						"13b341a87c086406cf7b24df82e44cd3fadff78d2bd9004a6602f1003152dc48": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"043d89be10f41acf80d84cb1810dd6ae063f992d56f020e38c9435e84c539bda": {
						"de0e82bd3345ec62fd5603593c9fb1c83fc5ce9c7b2ed9bc5a85de6180ed9069": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"049717866026eba65730a30785b74c6fce0e868c3593def765886c0a0e61b455": {
						"11d2d4002957397bd2fcec1da3e7dce21ad1fd3c0630d31adaa0f9a6ac1dc39d": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"06abc767b02cbc4d203e21709503f3d6d3ba49815e1a7bfccd6d28c895516279": {
						"464213a8f2d5b0b30d125b8dee2197e233fc664697582f03d9aa6599007d52b6": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"0e2a62813965eccc555197736a3b37610ce7fb578c4f3ea3f36c8e7a155466cd": {
						"6aa337f243172b485a2db2cd3ba1d6d71476ed87b3453868474b1c0cc1c16599": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"0e38604526dbbd9cfc2d9e86ce74dcc343f76b0e8b01a3f40ab73d9f565614ca": {
						"983b962fad52c6105d205e41ae84fc333edfe14858ee72851dee9b381ce26615": "000000000000000000000000000000000000000000000000000000e6f1c7d3c2"
					},
					"0f02f48f81634d7ea4f39a9dd3de6a5da0552195529622b5c322df03f258753f": {
						"d53cbad8dbafb95d26132f34d1f5f1be227a5741e5b74134949170eac0c744f7": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"0f7bba643a141e6da4e04815cf0099309bcdd03af111ef283f94723d52efb75e": {
						"7943c117b898acacae69ff9f3709d8bdb0e0927625f29bbeccd15898dba5c4f9": "000000000000000000000000000000000000000000000000000000020c855800"
					},
					"17a6bb9e66e3cf1d6b6bb8a24d25f6fd63dbd2ab667b244aa50c82b8636b5c09": {
						"f04e0f494c28474a0afcfab428dfe33daa4dd175cd4f2956492d90b0e91da4ed": "00000000000000000000000000000000000000000000000000000002cb417800"
					},
					"19389e6e94e9e637396314b19d4a5c96003fdc414ba39d7947a0adca4763ce8b": {
						"6edf6f2b630ab4cf0926dcaa0537256fdec103dd59c0ae4f8a6c10349f823fbf": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"1cd207727899f940916a489fe09777fe222be32abbd8e5344982ab4efa7e0bf3": {
						"fd3d620a9271ef935665147d7f3ce78bcc5bcc5f505baea03389883f6d78a1cd": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"2120e5b90ba4e799ab857a160c4f5da8a3571eab452a80f434765adc193126cc": {
						"86c11fcf7c8282c331f78dc1b397828978c2556c4cd1285accffa467a624dc09": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"233906d427d2b2e700762551dc0d2117fb63ae145a6b5bd468b485c83e54c1e9": {
						"0e21514b1d113b6205f97c0db8f450f0902b02a9eca194086f62c878290cfdb2": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"26076385a0a0f1713233a3e9bea9c292cd851f3425e8791ee760ce1fc9bc6a36": {
						"19143f581a38d6d2da44bd9facd00c8db4bdc5562582812bafa9ce1cbd54d925": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"2788b211dd8d849efde5402e56eda4351160f1ec78d098853bbdda9125d1fe39": {
						"e1771052e330aaf938c0739ee1e2bb45d30fdf745cd4d67a5fa2f8283306a882": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e563": {
						"0000000000000000000000000000000000000000000000000000000000000000": "00000000000000000000000000000000000000000000000000001e03694713e8"
					},
					"3083cdf4ec0ac7e07f9edf4b45663a65bb356791dfbcc1cef9738d97835a1ee3": {
						"5b5a68b84a7eeba16e158cb2f3a95f949de5088e7caaf02d06b22132ef2f2965": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"30f00ee1082be33b36fd38d331ce2590f6dbcf73c48bee5c5137e5ea6fae933f": {
						"51317341d8eb85c204c8f54e689bf61855b81d2d372954bfe73dce7dc0cdd5a4": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"30f5cd1dc3d45f79da20eea1dc8f18504988bff3fc63cdc25a1f7562f4bb1ab5": {
						"1dc05471537869659dd07f446e077fbe92d7edf63b61d3c8b1a5efac8d152e77": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"322bfb0e8d4731e9066c88cae0766c40e54a4cca3aa0871451c2c152257aa463": {
						"02ab553a8a6175aaca5b853d0a4b51469f0cb5a4dc4b3e23030ecc0b1c2b46ed": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"33e072ea5749ff15c19e7ba1d9809b7278e93958f78f644779a002cd60cb72ce": {
						"88234c2d3b9b2e09774f802ebdb74a13b8fe731929a59faa4e70e09391d7832a": "00000000000000000000000000000000000000000000000000000002e90edd00"
					},
					"348dd9d4e33a9bf8a49e625df0da167a7d606ceb71a320b7de3797f2f025e26c": {
						"bd7ea43c0fc4083385183cc47594b379b82990a3aa87be221b39ca7a0e7d6d19": "000000000000000000000000000000000000000000000000000000029da1c800"
					},
					"359210b063e25d1cd0edd4832c8def9f3e3a28b0ef979e3c14f26c827d46291d": {
						"dc871ce9ab6de8cfd568287c94e9ed7805a8a1adf4579bd3fac1e8444fcab5d7": "000000000000000000000000000000000000000000000000000000009502f900"
					},
					"3b326f1bf15e9c8466fece1c2c33a0c0d74dfdea701d7e09192a791bc38e6c60": {
						"3c8e07b0def0140679abcbab6cfc5fd613ef4da63ed271e694e10e501ffec54e": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"3b8e6393bf202a5c658cda7569c9048d30e96013e1df9ef0eb8bb5b9e3b201b4": {
						"53efa8257358856921f24943a5197f477a495243fe2f6384470d14c5a98a2210": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"3cdc51be7fcc5d60eb808086e7364216f60145b42007e550b025cc6a721f815e": {
						"2ef1ba9ec283d894c2bbf8d704c2c0cedc7259c6dc6b4bacc1a12881ac72ddaf": "0000000000000000000000000000000000000000000000000000000000000001"
					},
					"3fef5cedb9f3152d82a903db1ab87f927f4550cd60095ea04f6803007457e26f": {
						"71cb74ba14346e91feb6b8238072fef7617fb716262f26cf336688fa28e8cccc": "000000000000000000000000000000000000000000000000000000028fa6ae00"
					},
					"44001c1bacd37376473ed6a8d15ed1fec322682c628f8436adc473288082b16e": {
						"4f12a674fd3865ed2e9afac7b542e5b539a590a4f28925242aa012dd17720e36": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"4542b1e0e2ce87dfdfe8c5ea896fc099481f63bedec4df21f16a0c8866033990": {
						"497d5b0800045319ae398da9a5311898df3f030135988b510d343b1aba472a79": "000000000000000000000000000000000000000000000000000000037e11d600"
					},
					"45d498ac7b2062354d1e6fd0be3c8dc40bbfbc65a6706df8df2267e3be7d670a": {
						"ad3f1e54c090dbc223cc79b02ae43876361b29e2c9af3c5bc0c94a0dd4977d0f": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"4d284cc823eeb96683c7bd2be80f1a077f95be6f3ac6584737e2bba162257c5d": {
						"2b8d9a08c99aa90a937559789b3eaa0e7fe7b7b282e45e3b4b4f3f3b9b470355": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"4d89d69e8bf349d26e57c15844bddf6aa916aeba1a936134de0dc410d01d54d2": {
						"77b0cba284d509069fe998102ea71732c330244eff1eb85e00fb00af7fcecc10": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"4e5d8d3f272da5c7e607f95f6838a33cfa5eb069cdfef70e4bb85c60e87294b5": {
						"987bd0a38dbe69f2df4cdacbe7e9641887165e587895321cd6cafec4649ba378": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"4e8137ba407c23aa21f68aedd1a260e08b664b04f858285cd0be5099e77baef4": {
						"64cd09fd19228158f7e610dd01d19eca0e0f1e6f628f999a0759e9ce94757b1c": "0000000000000000000000000000000000000000000000000000000077359400"
					},
					"51254dd134044398cfb06f4c8260369da6f7bcd17f8c1dffbb4f42260c5ac68c": {
						"49bc4a48bdaa87add8e961df1289cd6fb485662563483e166fa639db8b071399": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"542f4689aff99c358438bef4c7aa9bf062e94bea873f0a2a2c00d6f7c6ae05b0": {
						"620c3d43d40218472ee97e619812e80af4529e0032220f62ec5312d70ab26f88": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"5810a2dc803764471e12a0dda0bb85efc858a8617def8f970c720b673e42069e": {
						"7d03521874d1115e076f1cf6b6b8b0a24258fb3de0ceeac31ede154065cbf85b": "000000000000000000000000000000000000000000000000000000003b9aca00"
					},
					"5967a3b65681a8aa091fac0394d1e01dfeb1e0797819b5860afe1cb25cf723ae": {
						"19abecae09eefa76c7e335d7768715b77b6bf18929c5e92b652374f82ddad01a": "000000000000000000000000000000000000000000000000000000000000000a"
					},
					"5af370445ca664e04deb37836ff079df941c30212334bd5ea3190fc76f814447": {
						"f0387cf5b5e0df6a560e4635a7887075f8642ec320b80c618571dbea57f939b2": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"607dd0265ee373c818e006532112d9265a9909149a902bc925965087c6a446a5": {
						"f8459452bbe11636151dbfbb5176832eb7c28fa16718158358aae5fcb358423d": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"60aa9da25947625bc9b671cdab357470145a2f7d271c3c81e6a86428c7ad0dee": {
						"891c53d8ff6e939b495290389a9f3bb953e5e5d549507a9a345bdc2858120c8a": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"67a06faf92ffe1563d422561104f2958383a7fc301d5033207ec28e2065fe65b": {
						"f2657c27ee80b98953a44b78dd3774ea1416c35b4f8858863e50bb51a2a4e091": "000000000000000000000000000000000000000000000000000000000000000a"
					},
					"6c24fe3288315c73f9a418931945708ce540e070a6340b7c43f64adf59cc7467": {
						"5a420b07615d7a309f69bf4a1ab467d1262a64c0c79ea9c4b7fd87764176a97d": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"6f0adee86c9973bdd3d8c3296afe1d0cdf77c857ec733859028d2164cc11824b": {
						"57e52c10b709eb5546333765453b3d05bfbd5f87729f139c11031de0d2acf329": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"70f7a6a9c51c7ec91914b5bb2357e08793842ce8a0dadca61f8e5aef8e28e532": {
						"44657161781e816502992ec670cd3c9f66a49505d9c6eee666151f4d4b02f2d4": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"7311e52c663c2f0f6b90f6771112fbd03d78e069fa5d7734891e207be82814a2": {
						"2b53baeef7a4f49badbc12bbd1a73a8b25fbbd7b7d100465c5438099c7e7288c": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"79142149bebe5783e29393658bf8da348b4dce6059dcf03d58d9bdbd495b1861": {
						"2542cfcc6c2995816905a6552011e2ddeb8be560b0188f77a5cdec207d523e09": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"79defe99e7df4f6fbd8f65cd320f5c35dbbe574701c957ca05266895c64b10ed": {
						"59a0de65a1280c37ed0f0bd1467785774c27e0c93d057d2035ad954ebca919b0": "7159635532473166346b57475a58676b573268364555705850354b5134786656"
					},
					"7b3bc2e650324cd1ea217c25024626d32809ddce99aa49fa93b52b14626e55cb": {
						"c2fdc17b25909e0125d08a51e567e770a8f6b862d293adb37756229fde05a350": "000000000000000000000000000000000000000000000000000000012a05f200"
					},
					"852b5c456dbb1fa03e70a9a6b886b3896a3c8b0934e9e39e9702a2a42e7d3d8c": {
						"e836ead38b31cefd99489067397c2af3c791a0e0b24248fb9ce020b19bb0b684": "0000000000000000000000000000000000000000000000000000000000000001"
					},
					"8568295bd78d84b5440d8871431707ab29ce98253271648b8ebc1c1f7b198a66": {
						"6cdedfb9b5df610fda85aa60650b74f325690c4191f1f0faaf2106d5fe285f59": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"8ba5eb72c234509661e3452adc1a32a9b963fd2b1aa13a8a6b582c8dfcd87834": {
						"a9b534480a53c53f52226143e033968fd51dbf502a4919a2b9ac42da2d05ef25": "0000000000000000000000000000000000000000000000000000074294a5d519"
					},
					"91aac22870fde5fc0d1ec958b573295a6dabdf0193ca03d9cc7126e5c06795d7": {
						"1979f1c0531dac24dc1176436c76482b905b66c5aa3d0d209762a829bf533e19": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"91fe4a7f9634c949aa41121024f218c161c7ff5edb2f8d670c283f3fad0452cc": {
						"8df8644c476b0d2d017a0a32d74ba5c411deef626a41b203d0b7175141c11831": "00000000000000000000000000000000000000000000000000000002540be40a"
					},
					"998c6b5b0deddd48cafb7a0cb9dc2a89704dee81d7b24c82134fb98e2fb33dcd": {
						"7234597846b50c9e7f64c7bef40a37200b0e2a3b8ca98776d72fda92c1e522d8": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"a0ad3f72c0847f6051585fc91c2d095b3d157c91bdbb9a524560fa17e7313f91": {
						"0ce742d8d383847d87937210d5f9ef3371331fbbccffc9d60d9c714d7c2cf9c4": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"a245a773eac9b400bb198bdafd419a9106c190ac23c164fc6e437480d4cdbfbb": {
						"970d5f273ddbb7caba0537f79967ebd5f9c6e0730717ee8b1b35cbcb9bbf60fa": "00000000000000000000000000000000000000000000000000000915fa66bfe8"
					},
					"a28c945b4cc3d680d5d5a13da836658eadd0659edafa3f3c15abad018c605bd0": {
						"da97364e168b2635ea97af2b5210549308cb64eb99a27908a15858c9cb110f7c": "00000000000000000000000000000000000000000000000000000002540be432"
					},
					"a28e2719bfc3b7fb10860faa0cb625c015d177e8a01adbce0417a50449eec9a7": {
						"aa57d922e3d2fe8da71cb413cc35250ac392d9807ac60b5848404daaad9e55ec": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"a6564cfcbb9773261fb21d1a38ab7af4d37b5ff396cf4bdbe8c6f77089dfbb2e": {
						"6013bd72ced209a6f54b34f5fabbf9915f5cca79d038818c783e6739d14d5fab": "00000000000000000000000000000000000000000000000000000002910c1de8"
					},
					"ab60ea49be1285e2cb6cad2320f6739524664d84eb13c08e9074be2d57d0789f": {
						"6432cd35f4401f03abdfd47f78483622adec3e8b33a8f9931faaba026534244f": "00000000000000000000000000000000000000000000000000000002ad741300"
					},
					"b66c6d396603b69ab6d50d7025d5ccbe1bb05ef2d599c3deaceef1f597c52f6f": {
						"4fc46ce8e5228e8ffcc5305e749ce2c74b68859fa5eb8048630f8a66ef7cb007": "0000000000000000000000000000000000000000000000000000000005f5e100"
					},
					"bad6d73abc7635e8fba872b09459943e77e350baa4351f62f77f5f52a0623fc0": {
						"9f1035aacb0392f80e461806e1c70a3e71f05eb8bb539ece0160cc348aeb52eb": "000000000000000000000000000000000000000000000000000000000000000c"
					},
					"bc42b6d8dc1b9f5b24fdccad8683b0e46c1d7c4fba4b44c72188904195e0f3a5": {
						"9fbd21b7ad14c20e39db55f8d917bb3202f10866ccd2e4f87f82aeb4a122594e": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"bc977d00f5516d21e4bd65cc724a8f219bdc6f53e80898dbcfb5f4ad8fda1115": {
						"ea6db618abcbb3f8af7366d45823f75abf135968d6f109b934b61b499b22d68a": "000000000000000000000000000000000000000000000000000008dcc28f5280"
					},
					"bcbeb48cbbc17c589448bd4dc73e3667ae6a239c19477c19a5c2c4312d9c95de": {
						"9d36d14e19c8f4c4f31ae67a88cd5f09c500c086499e4f1c10a21e6f0226f9c1": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"bcfd63bd71a685f270c569e70b6785d48039cf9e0b97ef9cd46a8533c51cd0b1": {
						"2224361133f993469dc9a0ec4f71ae1c80bb7e81347d0454bbd3e4f133032e78": "000000000000000000000000000000000000000000000000000000029b927000"
					},
					"c2575a0e9e593c00f959f8c92f12db2869c3395a3b0502d05e2516446f71f85b": {
						"0000000000000000000000000000000000000000000000000000000000000003": "00000000000000000000000017e7888aa7412a735f336d2f6d784caefabb6fa3"
					},
					"c48703c106935d95645bd129361b76712715d41211dacdb636ede69ca441f1ae": {
						"cef71aefb63af86c7b6ee8e8c95ab03ea074083e779b28a3777ecb2213948bfc": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"c4f50a1c5ad95c4875fe956da795de81afc67bb2affe43af02378988d982204d": {
						"e0ad1445db81a934f4a54d83777fc163f65a0b44e1ae58505d094ac0b794e259": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"c80509a2fbcc80df0aacaf4fbdf505944c20cd331ec9929e0eda5f751309eab7": {
						"4b2a3553362c642d0384b2a095441822a521aa46c2f090f40a526c2c54ea4121": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"cd33094f6afa14bd36cb60a72ba773cf83cce831e45506f1fb3a3e84c38c52a9": {
						"8ae6064399d7d9d1bb0cc6cfefedc8685bb531ee6061591d79b705af0ceca1d4": "00000000000000000000000000000000000000000000000000000004a817c800"
					},
					"cff5fd3c407d5ad62fd257d4f935e90df611cb7f375f43a19f6999f75ce8526c": {
						"6b3e36ee77f2fb92a761b20af1bf79ff27c594524f3dcf3eb08c72377f374886": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"d4d24ff04ad34050243000e1dabf4f87828d330c01c5e1342b7e7e4abb29c660": {
						"0b97e69040c29d4e7d87d687dab69fcac6bf9af6ad83fab38b0d05f9962b0747": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"dd24c304f143c9acd35c1fdf71ac3edffed043cb243a2a36f05bf3271a2efdea": {
						"a94930ba8ef352bce94fc61e9f0df4f35cff395f43ba8a2697023f407cc1d5ea": "000000000000000000000000000000000000000000000000000000000000000a"
					},
					"e21a9801f607a25fdb53fd69ee887d047a2a10c1a49f021c162a38c2ba92565a": {
						"a86a065ec3af032ab66977ea73266e0beb5264a6b90d8955705e5a46415dfb1e": "000000000000000000000000000000000000000000000000000000089d5f3200"
					},
					"e28e0ab75fa0735c1a4a9fb78e67ef699768c36a39643ea9c865492410256c74": {
						"102273155742adfa07e24cc042397f0577dff443f50109b9b9551178fd56e8ba": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"e9ebff39b44a68a7eb91de566b4a3f418d1db66c07d132fb23ae38f238e9f920": {
						"dbed892eabddaf89270a9a7091ba583d5364614333e6698200b1e8f9dee6f0c5": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"ec1d66db71a5220235164a82e361643b2c8771fe22145d8929632def53d6d428": {
						"aadf29015e736e4e272a8dc1e2821fdcd6af6324bcd0ce866df18b13bbe7e848": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"efa8a2633cb90403163d211cc6211e810faca078ad0419cd9a3a859b692a0f34": {
						"7affbdecd64e2a7dc92dd34bc4c892bfb558e80a5e9e76120f719a35e672b993": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"f04f18bad6e9cb3ce99f5ae3b67e297fbcf9ac6b7220aa2ab57849a54a1177d3": {
						"d74bc04c26f81f9df0fe78a5c0eb3b34af2d717831e47d3d4cce2d09b298ef71": "000000000000000000000000000000000000000000000000000000161e70f600"
					},
					"f0c0622403ac7246fda31cd4f4a0e7fa3920a383d1b3781e4295b516bcc61b4a": {
						"47cb1e2e1925a4969589fe2a066412f699bcbbd27c2e7b4d325d3b101178e8c8": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"f3fa8d84b5c25771cc5df1dc914b43dc815cdf9c370120cfb62401f9c45b254d": {
						"d7c41a8c3d181df6ee6b89b0022f2667c8266329035f636d71f3e89ccafb436f": "00000000000000000000000000000000000000000000000000000002bc5ac580"
					},
					"f58a893d86e387f1b5f9f752095c934df95f2ad8a21ebeacaa53e4f93806ebd1": {
						"0f11d949cbefb4c8bf3f3fcee584943a05a7c90913ea68bf5e31eabc7d85b04a": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"f8569540de05b88afdde8e10d22d93f615317f9e23a5914cc0abc866597f1454": {
						"282653cfbdcda5424a57d803761b589e7e146b2855329d2129d69e6e1d836513": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"f9d2129566cee49719acd58b142bd30979ec2e4bff15036634f23919f1ab304e": {
						"275c28e6b14382e9729bdf527bc2a66df3e0b85a137b800aa00539cda1d2ea83": "000000000000000000000000000000000000000000000000000000174876e800"
					},
					"fa1ca39b574e72994caf558edcc638369f0b473e284c9d62fd163a6a3332777b": {
						"d5856d561c79744665a63b916e14df22c6d8815d8f343675d506ab3f968948eb": "000000000000000000000000000000000000000000000000000000e51af87000"
					},
					"fea81dac36263daab207358382272071e4c70aa173ce0ac9ef3a3b080c94f45d": {
						"d76f9f77b0960e67284c08cd8f5bfe49759183257a752ea6d0870005c7e9ce75": "00000000000000000000000000000000000000000000000000000002540be400"
					},
					"ff1eecab0ffb79b92193853adabfd379e0af50a057618910f4f3f7d6d8d90688": {
						"9a4f5b02a151772646fdb341fde160ebb117d86d48d661ee9b181b3ffb56471e": "000000000000000000000000000000000000000000000000000000e8d4a51000"
					},
					"ff314ad1dc7a59d6b6228c0c08722ec2d84820b3a848282e89edee9881847e47": {
						"7e06189c1fb75c598c4dab17aac7a15eb1563721083bf89610132a77c7c0de2b": "000000000000000000000000000000000000000000000000000000174876e800"
					}
				},
				"code": "6060604052600436106100c45763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166306fdde0381146100c9578063095ea7b31461015357806318160ddd1461018957806323b872dd146101ae578063313ce567146101d65780633542aee2146101e957806370a082311461020b5780638da5cb5b1461022a57806395d89b4114610259578063a9059cbb1461026c578063dd62ed3e1461028e578063f2fde38b146102b3578063f7abab9e146102d4575b600080fd5b34156100d457600080fd5b6100dc6102e7565b60405160208082528190810183818151815260200191508051906020019080838360005b83811015610118578082015183820152602001610100565b50505050905090810190601f1680156101455780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b341561015e57600080fd5b610175600160a060020a036004351660243561031e565b604051901515815260200160405180910390f35b341561019457600080fd5b61019c6103c4565b60405190815260200160405180910390f35b34156101b957600080fd5b610175600160a060020a03600435811690602435166044356103ca565b34156101e157600080fd5b61019c6104f4565b34156101f457600080fd5b610175600160a060020a03600435166024356104f9565b341561021657600080fd5b61019c600160a060020a0360043516610528565b341561023557600080fd5b61023d610543565b604051600160a060020a03909116815260200160405180910390f35b341561026457600080fd5b6100dc610552565b341561027757600080fd5b610175600160a060020a0360043516602435610589565b341561029957600080fd5b61019c600160a060020a036004358116906024351661065f565b34156102be57600080fd5b6102d2600160a060020a036004351661068a565b005b34156102df57600080fd5b61019c6106e9565b60408051908101604052600b81527f426f64686920546f6b656e000000000000000000000000000000000000000000602082015281565b60008115806103505750600160a060020a03338116600090815260026020908152604080832093871683529290522054155b151561035b57600080fd5b600160a060020a03338116600081815260026020908152604080832094881680845294909152908190208590557f8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b9259085905190815260200160405180910390a350600192915050565b60005481565b600080600160a060020a03841615156103e257600080fd5b50600160a060020a03808516600081815260026020908152604080832033909516835293815283822054928252600190529190912054610428908463ffffffff6106f416565b600160a060020a03808716600090815260016020526040808220939093559086168152205461045d908463ffffffff61070616565b600160a060020a038516600090815260016020526040902055610486818463ffffffff6106f416565b600160a060020a03808716600081815260026020908152604080832033861684529091529081902093909355908616917fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9086905190815260200160405180910390a3506001949350505050565b600881565b60035460009033600160a060020a0390811691161461051757600080fd5b6105218383610715565b9392505050565b600160a060020a031660009081526001602052604090205490565b600354600160a060020a031681565b60408051908101604052600381527f424f540000000000000000000000000000000000000000000000000000000000602082015281565b6000600160a060020a03831615156105a057600080fd5b600160a060020a0333166000908152600160205260409020546105c9908363ffffffff6106f416565b600160a060020a0333811660009081526001602052604080822093909355908516815220546105fe908363ffffffff61070616565b600160a060020a0380851660008181526001602052604090819020939093559133909116907fddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef9085905190815260200160405180910390a350600192915050565b600160a060020a03918216600090815260026020908152604080832093909416825291909152205490565b60035433600160a060020a039081169116146106a557600080fd5b600160a060020a03811615156106ba57600080fd5b6003805473ffffffffffffffffffffffffffffffffffffffff1916600160a060020a0392909216919091179055565b662386f26fc1000081565b60008282111561070057fe5b50900390565b60008282018381101561052157fe5b60008054819061072b908463ffffffff61070616565b9050662386f26fc1000081111561074157600080fd5b6000805484018155600160a060020a03851681526001602052604090205461076f908463ffffffff61070616565b600160a060020a038516600081815260016020526040808220939093555490917f4e3883c75cc9c752bb1db2e406a822e4a75067ae77ad9a0a4d179f2709b9e1f6919086905191825260208201526040908101905180910390a250600193925050505600a165627a7a723058209fee18012e751567d5362aa378208f048925363b5acd296dcdaddf8ea8eeb8d50029"
			};

			var qtumd = new QtumService(baseConfig);
			var getAccountInfo = sinon.stub().callsArgWith(1, null, {
				result: accountInfo,
			});
			qtumd.nodes.push({
				client: {
					getAccountInfo: getAccountInfo,
				}
			});
			qtumd.getAccountInfo('f6177bc9812eeb531907621af6641a41133dea9e', function(err, result) {
				should.not.exist(err);
				getAccountInfo.callCount.should.equal(1);
				result.should.deep.equal(accountInfo);
				done();
			});
		});
	});

	describe('#getTransactionReceipt', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getTransactionReceipt = sinon.stub().callsArgWith(1, { message: 'Test error', code: -1 });
			qtumd.nodes.push({
				client: {
					getTransactionReceipt: getTransactionReceipt,
				}
			});
			qtumd.getTransactionReceipt('51b34cbcaf6fe3b687bf3d954f3baaeb377f5d0a3a8cdd29d899c049f6954a49', function(err, result) {
				should.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getTransactionReceipt.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give transaction receipt', function(done) {
			var transactionReceipt = [
				{
					"blockHash": "bc15b598d45d6396944580f8339cea891aa2b1673dc88a470ec1f0ac8a532d6c",
					"blockNumber": 87202,
					"transactionHash": "51b34cbcaf6fe3b687bf3d954f3baaeb377f5d0a3a8cdd29d899c049f6954a49",
					"transactionIndex": 2,
					"from": "17e7888aa7412a735f336d2f6d784caefabb6fa3",
					"to": "f6177bc9812eeb531907621af6641a41133dea9e",
					"cumulativeGasUsed": 51725,
					"gasUsed": 51725,
					"contractAddress": "f6177bc9812eeb531907621af6641a41133dea9e",
					"log": [
						{
							"address": "f6177bc9812eeb531907621af6641a41133dea9e",
							"topics": [
								"4e3883c75cc9c752bb1db2e406a822e4a75067ae77ad9a0a4d179f2709b9e1f6",
								"0000000000000000000000008854c923be4eff843358cbd7d7536b173a74cbd1"
							],
							"data": "00000000000000000000000000000000000000000000000000001e77d39abfaa0000000000000000000000000000000000000000000000000000000000009c40"
						}
					]
				}
			];
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getTransactionReceipt = sinon.stub().callsArgWith(1, null, {
				result: transactionReceipt,
			});
			qtumd.nodes.push({
				client: {
					getTransactionReceipt: getTransactionReceipt,
				}
			});
			qtumd.getTransactionReceipt('51b34cbcaf6fe3b687bf3d954f3baaeb377f5d0a3a8cdd29d899c049f6954a49', function(err, result) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getTransactionReceipt.callCount.should.equal(1);
				result.should.deep.equal(transactionReceipt);
				done();
			});
		});
		it('will give transaction receipt using cache', function(done) {
			var transactionReceipt = [
				{
					"blockHash": "bc15b598d45d6396944580f8339cea891aa2b1673dc88a470ec1f0ac8a532d6c",
					"blockNumber": 87202,
					"transactionHash": "51b34cbcaf6fe3b687bf3d954f3baaeb377f5d0a3a8cdd29d899c049f6954a49",
					"transactionIndex": 2,
					"from": "17e7888aa7412a735f336d2f6d784caefabb6fa3",
					"to": "f6177bc9812eeb531907621af6641a41133dea9e",
					"cumulativeGasUsed": 51725,
					"gasUsed": 51725,
					"contractAddress": "f6177bc9812eeb531907621af6641a41133dea9e",
					"log": [
						{
							"address": "f6177bc9812eeb531907621af6641a41133dea9e",
							"topics": [
								"4e3883c75cc9c752bb1db2e406a822e4a75067ae77ad9a0a4d179f2709b9e1f6",
								"0000000000000000000000008854c923be4eff843358cbd7d7536b173a74cbd1"
							],
							"data": "00000000000000000000000000000000000000000000000000001e77d39abfaa0000000000000000000000000000000000000000000000000000000000009c40"
						}
					]
				}
			];
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getTransactionReceipt = sinon.stub().callsArgWith(1, null, {
				result: transactionReceipt,
			});
			qtumd.nodes.push({
				client: {
					getTransactionReceipt: getTransactionReceipt,
				}
			});
			qtumd.getTransactionReceipt('51b34cbcaf6fe3b687bf3d954f3baaeb377f5d0a3a8cdd29d899c049f6954a49', function(err, result) {
				should.not.exist(err);
				getTransactionReceipt.callCount.should.equal(1);
				qtumd._tryAllClients.callCount.should.equal(1);
				qtumd.getTransactionReceipt('51b34cbcaf6fe3b687bf3d954f3baaeb377f5d0a3a8cdd29d899c049f6954a49', function(err, result) {
					should.not.exist(err);
					qtumd._tryAllClients.callCount.should.equal(1);
					getTransactionReceipt.callCount.should.equal(1);
					result.should.deep.equal(transactionReceipt);
					done();
				});
			});
		});
	});

	describe('#getDgpInfo', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getDgpInfo = sinon.stub().callsArgWith(0, { message: 'Test error', code: -1 });
			qtumd.nodes.push({
				client: {
					getDgpInfo: getDgpInfo,
				}
			});
			qtumd.getDgpInfo(function(err, result) {
				should.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getDgpInfo.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give dgp info', function(done) {
			var dpgInfo = {
				"maxblocksize": 2000000,
				"mingasprice": 40,
				"blockgaslimit": 40000000
			};

			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getDgpInfo = sinon.stub().callsArgWith(0, null, {
				result: dpgInfo,
			});
			qtumd.nodes.push({
				client: {
					getDgpInfo: getDgpInfo,
				}
			});
			qtumd.getDgpInfo(function(err, result) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getDgpInfo.callCount.should.equal(1);
				result.should.deep.equal(dpgInfo);
				done();
			});
		});
		it('will give dgp info using cache', function(done) {
			var dpgInfo = {
				"maxblocksize": 2000000,
				"mingasprice": 40,
				"blockgaslimit": 40000000
			};

			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getDgpInfo = sinon.stub().callsArgWith(0, null, {
				result: dpgInfo,
			});
			qtumd.nodes.push({
				client: {
					getDgpInfo: getDgpInfo,
				}
			});
			qtumd.getDgpInfo(function(err, result) {
				should.not.exist(err);
				getDgpInfo.callCount.should.equal(1);
				qtumd._tryAllClients.callCount.should.equal(1);
				qtumd.getDgpInfo(function(err, result) {
					should.not.exist(err);
					qtumd._tryAllClients.callCount.should.equal(1);
					getDgpInfo.callCount.should.equal(1);
					result.should.deep.equal(dpgInfo);
					done();
				});
			});
		});
	});

	describe('#getMiningInfo', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getMiningInfo = sinon.stub().callsArgWith(0, { message: 'Test error', code: -1 });
			qtumd.nodes.push({
				client: {
					getMiningInfo: getMiningInfo,
				}
			});
			qtumd.getMiningInfo(function(err, result) {
				should.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getMiningInfo.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give mining info', function(done) {
			var miningInfo = {
				"blocks": 87815,
				"currentblocksize": 0,
				"currentblockweight": 0,
				"currentblocktx": 0,
				"difficulty": {
					"proof-of-work": 1.52587890625e-05,
					"proof-of-stake": 550014.4572990186,
					"search-interval": 0
				},
				"blockvalue": 400000000,
				"netmhashps": 0,
				"netstakeweight": 432592955734210.6,
				"errors": "",
				"networkhashps": 30072589331206.01,
				"pooledtx": 0,
				"stakeweight": {
					"minimum": 0,
					"maximum": 0,
					"combined": 0
				},
				"chain": "test"
			};

			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getMiningInfo = sinon.stub().callsArgWith(0, null, {
				result: miningInfo,
			});
			qtumd.nodes.push({
				client: {
					getMiningInfo: getMiningInfo,
				}
			});
			qtumd.getMiningInfo(function(err, result) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getMiningInfo.callCount.should.equal(1);
				result.should.deep.equal(miningInfo);
				done();
			});
		});
		it('will give mining info using cache', function(done) {
			var miningInfo = {
				"blocks": 87815,
				"currentblocksize": 0,
				"currentblockweight": 0,
				"currentblocktx": 0,
				"difficulty": {
					"proof-of-work": 1.52587890625e-05,
					"proof-of-stake": 550014.4572990186,
					"search-interval": 0
				},
				"blockvalue": 400000000,
				"netmhashps": 0,
				"netstakeweight": 432592955734210.6,
				"errors": "",
				"networkhashps": 30072589331206.01,
				"pooledtx": 0,
				"stakeweight": {
					"minimum": 0,
					"maximum": 0,
					"combined": 0
				},
				"chain": "test"
			};

			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getMiningInfo = sinon.stub().callsArgWith(0, null, {
				result: miningInfo,
			});
			qtumd.nodes.push({
				client: {
					getMiningInfo: getMiningInfo,
				}
			});
			qtumd.getMiningInfo(function(err, result) {
				should.not.exist(err);
				getMiningInfo.callCount.should.equal(1);
				qtumd._tryAllClients.callCount.should.equal(1);
				qtumd.getMiningInfo(function(err, result) {
					should.not.exist(err);
					qtumd._tryAllClients.callCount.should.equal(1);
					getMiningInfo.callCount.should.equal(1);
					result.should.deep.equal(miningInfo);
					done();
				});
			});
		});
	});

	describe('#getStakingInfo', function() {
		it('will give rpc error', function(done) {
			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getStakingInfo = sinon.stub().callsArgWith(0, { message: 'Test error', code: -1 });
			qtumd.nodes.push({
				client: {
					getStakingInfo: getStakingInfo,
				}
			});
			qtumd.getStakingInfo(function(err, result) {
				should.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getStakingInfo.callCount.should.equal(1);
				err.should.be.an.instanceof(errors.RPCError);
				done();
			});
		});
		it('will give staking info', function(done) {
			var stakingInfo = {
				"enabled": true,
				"staking": false,
				"errors": "",
				"currentblocksize": 0,
				"currentblocktx": 0,
				"pooledtx": 0,
				"difficulty": 322205.4518648589,
				"search-interval": 0,
				"weight": 0,
				"netstakeweight": 423659055700798,
				"expectedtime": 0
			};

			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getStakingInfo = sinon.stub().callsArgWith(0, null, {
				result: stakingInfo,
			});
			qtumd.nodes.push({
				client: {
					getStakingInfo: getStakingInfo,
				}
			});
			qtumd.getStakingInfo(function(err, result) {
				should.not.exist(err);
				qtumd._tryAllClients.callCount.should.equal(1);
				getStakingInfo.callCount.should.equal(1);
				result.should.deep.equal(stakingInfo);
				done();
			});
		});
		it('will give staking info using cache', function(done) {
			var stakingInfo = {
				"enabled": true,
				"staking": false,
				"errors": "",
				"currentblocksize": 0,
				"currentblocktx": 0,
				"pooledtx": 0,
				"difficulty": 322205.4518648589,
				"search-interval": 0,
				"weight": 0,
				"netstakeweight": 423659055700798,
				"expectedtime": 0
			};

			var qtumd = new QtumService(baseConfig);
			sinon.spy(qtumd, '_tryAllClients');
			var getStakingInfo = sinon.stub().callsArgWith(0, null, {
				result: stakingInfo,
			});
			qtumd.nodes.push({
				client: {
					getStakingInfo: getStakingInfo,
				}
			});
			qtumd.getStakingInfo(function(err, result) {
				should.not.exist(err);
				getStakingInfo.callCount.should.equal(1);
				qtumd._tryAllClients.callCount.should.equal(1);
				qtumd.getStakingInfo(function(err, result) {
					should.not.exist(err);
					qtumd._tryAllClients.callCount.should.equal(1);
					getStakingInfo.callCount.should.equal(1);
					result.should.deep.equal(stakingInfo);
					done();
				});
			});
		});
	});
});