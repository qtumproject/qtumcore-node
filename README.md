Qtumcore Node
============

A QTUM full node for building applications and services with Node.js. A node is extensible and can be configured to run additional services. At the minimum a node has an interface to [Bitcoin Core with additional indexing](https://github.com/bitpay/bitcoin/tree/0.12.1-bitcore) for more advanced address queries. Additional services can be enabled to make a node more useful such as exposing new APIs, running a block explorer and wallet service.

## Install

```bash
npm install -g qtumcore-node
qtumcore-node start
```

## Configuration

Qtumcore includes a Command Line Interface (CLI) for managing, configuring and interfacing with your Qtumcore Node.

```bash
qtumcore-node create -d <qtum-data-dir> mynode
cd mynode
qtumcore-node install <service>
qtumcore-node install https://github.com/yourname/helloworld
```

This will create a directory with configuration files for your node and install the necessary dependencies. For more information about (and developing) services, please see the [Service Documentation](docs/services.md).

## Add-on Services

There are several add-on services available to extend the functionality of Qtumcore:

- [Insight API](https://github.com/qtumproject/insight-api)
- [Qtum Explorer](https://github.com/qtumproject/qtum-explorer)

## Contributing



## License
