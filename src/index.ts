// Import
import { ApiPromise, Keyring } from '@polkadot/api';
import { WsProvider } from '@polkadot/rpc-provider';
import { cryptoWaitReady } from '@polkadot/util-crypto';

import {
    createSignedTx,
    createSigningPayload,
    decode,
    deriveAddress,
    getRegistry,
    getTxHash,
    methods,
    POLKADOT_SS58_FORMAT,
} from '@substrate/txwrapper';

import { rpcToNode } from './rpcToNode';

import chalk from 'chalk';
import { ArgumentParser } from 'argparse';

/**
 * Initialize a test connection
 * This is an example usage of Polkadots API
 */
const initTestConnection = async () => {
    
    // Web Socket connection
    const api = await ApiPromise.create({ 
        provider: new WsProvider('wss://rpc.polkadot.io') 
    });

    console.log(
        chalk.cyan(
            `> [CONNECTION]: ${chalk.yellow('wss://rpc.polkadot.io')}`
        )
    )

    console.log(
        chalk.cyan(
            `> Polkadot.js API genesis hash ${chalk.yellow(api.genesisHash.toHex())}`
        )
    );

    // Test address - Example 
    const ADDR: string = '5DTestUPts3kjeXSTMyerHihn1uwMfLj8vU8sqF7qYrFabHE';

    const [now, { nonce, data: balances }] = await Promise.all([
        api.query.timestamp.now(),
        api.query.system.account(ADDR)
    ]);

    console.log(
        chalk.cyan(
            `> Last Timestamp ${chalk.red(now)}: 
                Balance => ${chalk.yellow(balances.free)}, 
                Nonce   => ${chalk.yellow(nonce)}`
        )
    );

    // Chain Data
    const [chain, chainType, header, finalizedHead] = await Promise.all([
        api.rpc.system.chain(),
        api.rpc.system.chainType(),
        api.rpc.chain.getHeader(),
        api.rpc.chain.getFinalizedHead()
    ]);

    console.log(
        chalk.cyan(
            `> Chain Data:
                Chain         => ${chalk.yellow(chain)}
                ChainType     => ${chalk.yellow(chainType)}
                FinalizedHead => ${chalk.yellow(finalizedHead)}
                Header:
                    Number                 => ${chalk.yellow(header.number)}
                    ParentHash             => ${chalk.yellow(header.parentHash)}
                    ExtrinsicsRoot         => ${chalk.yellow(header.extrinsicsRoot)}`
        )
    )

    // Suscribe to new headers
    console.log(
        chalk.cyan(
            `> Subscribing to latest headers:`
        )
    )

    let count: number  = 0;

    const unsubHeads = await api.rpc.chain.subscribeNewHeads((lastHeader) => {
        console.log(chalk.cyan(`> ${chain}: last block #${chalk.yellow(lastHeader.number)} has hash ${chalk.yellow(lastHeader.hash)}`));

        if (!lastHeader || ++count === 10) {
            // Unsubscribe
            console.log(chalk.cyan(`${chalk.red(`> Unsubscribing Headers..`)}`));
            unsubHeads();
        }
    });

    // Subscribe to Multi Queries
    console.log(
        chalk.cyan(
            `> Subscribing to multi queries:`
        )
    )

    let multiCount: number = 0;

    const multiUnsub = await api.queryMulti([
        api.query.timestamp.now,
        [api.query.system.account, ADDR]
    ], ([now, data]) => {
            console.log(chalk.cyan(`> ${now}: data: ${chalk.yellow(data)}`));

            if (multiCount === 3) {
                // Unsubscribe
                console.log(chalk.cyan(`> ${chalk.red(`> Unsubscribing Multi Query..`)}`));
                multiUnsub();
            };
    })
}

/**
 * DEV -- Initialize a connection to node
 * If connecting to a local node, transactions are permitted for testing
 * If connecting to a global node, transactions are not permitted for testing
 * @param wsProvider string
 */
const initNetworkConnection = async (wsProvider: string) => {
    
    // Establish a connection
    const api = await ApiPromise.create({
        provider: new WsProvider(wsProvider)
    });

    console.log(
        chalk.cyan(
            `> [CONNECTION]: ${chalk.yellow(wsProvider)}`
        )
    )

    /**
     * META DATA
     * This is static data, if updated with a runtime update it wouldn't know
     * This is one method of receiving runtime constants
     */
    const genesisHash = api.genesisHash.toHex();
    const runtimeMetadata = api.runtimeMetadata.toJSON();
    const runtimeVersion = api.runtimeVersion.toArray();
    const magicNumber = runtimeMetadata.magicNumber;

    console.log(
        chalk.cyan(
            `> Meta Data:
                GenesisHash     => ${chalk.yellow(genesisHash)}
                Runtime Version => ${chalk.yellow(runtimeVersion)}
                MagicNumber     => ${chalk.yellow(magicNumber)}`
        )
    )

    return api;
}

/**
 * DEV -- create a mock transaction
 * @param api ApiPromise
 */
const initTransaction = async (api: ApiPromise) => {
    // Await for promise to resolve before creating a keyring
    // One can also use .then(() => ())
    await cryptoWaitReady();

    /**
     * Block Information
     * All relevant information to create a transaction
     */
    const [
        { block },
        blockHash,
        genesisHash,
        metadataRpc,
        { specVersion, transactionVersion }
    ] = await Promise.all([
        rpcToNode('chain_getBlock'),
        rpcToNode('chain_getBlockHash'),
        rpcToNode('chain_getBlockHash', [0]),
        rpcToNode('state_getMetadata'),
        rpcToNode('state_getRuntimeVersion')
    ]);

    // Initialize keyring object
    const keyring = new Keyring();
    // Polkadot type registry
    const registry = getRegistry('Polkadot', 'polkadot', specVersion);

    /**
     * Below are will be two entities involved in the transaction
     * Alice we will create, and we will assume a transaction amount as well
     * as Janice's ADDR
     */

    // Create Alice => implied dev seed
    const alice = keyring.addFromUri('//Alice', { name: 'Alice' }, 'sr25519');
    // Retrieve Alice Address => SS58-Encoded Address
    const aliceADDR = deriveAddress(alice.publicKey, POLKADOT_SS58_FORMAT);
    
    // Janice credentials, and value
    const janiceADDR = '5DTestUPts3kjeXSTMyerHihn1uwMfLj8vU8sqF7qYrFabHE';
    const transactionValue = 12345;

    /**
     * Below is the unsigned transaction method
     * transfer takes in 3 parameters
     * @param args => args specific to the method in the case transfering
     * @param info => info required to construct transaction
     * @param options => Registry and metadata used for constructing a method
     */
    const txOptions = { metadataRpc, registry }

    const unsigned = methods.balances.transfer(
        {
            value: transactionValue,
            dest: janiceADDR
        },
        {
            address: aliceADDR,
            blockHash,
            blockNumber: registry
                .createType('BlockNumber', block.header.number)
                .toNumber(),
            eraPeriod: 64,
            genesisHash,
            metadataRpc,
            nonce: 0,
            specVersion,
            tip: 0,
            transactionVersion
        },
        txOptions
    );


    /**
     * decode takes in 3 arguments
     * @param unsignedTx => the data to parse as an unsigned transaction
     * @param options => Runtime-specific data used for decoding the transaction
     * @param toInt => whether or not to forcibly serialize integers in the call args to base-10
     * If toInt is false then integers will either be a number or hex
     */
    const decodeUnsigned = decode(
        unsigned,
        txOptions,
        true
    );

    console.log(
        chalk.cyan(
            `> Decoded Transaction:
                To: ${chalk.yellow(decodeUnsigned.method.args.dest)}
                Amount: ${chalk.yellow(decodeUnsigned.method.args.value)}`
        )
    );
}

// Arg parser

const parser = new ArgumentParser({});

parser.add_argument('-w', '--ws', { choices: ['polkadot-global', 'polkadot-dev', 'test'], required: true });

const args = parser.parse_args();

if (require.main === module) {

    if(args.ws === 'test') {

        initTestConnection();

    } else if (args.ws === 'polkadot-dev') {
        // Local port 9944
        initNetworkConnection('ws://localhost:9944')
            .then((api) => {
                initTransaction(api);
            })

    } else if (args.ws === 'polkadot-global') {
        // We dont want to test transactions on the public network
        initNetworkConnection('wss://rpc.polkadot.io')

    }

}