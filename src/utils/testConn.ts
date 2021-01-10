// Import
import { ApiPromise } from '@polkadot/api';
import { WsProvider } from '@polkadot/rpc-provider';
import { cryptoWaitReady } from '@polkadot/util-crypto';

import chalk from 'chalk';
/**
 * Initialize a test connection
 * This is an example usage of Polkadots API
 * @param wsProvder => 
 */
export const initTestConnection = async (wsProvider: string) => {

    await cryptoWaitReady();

    // Web Socket connection
    const api = await ApiPromise.create({
        provider: new WsProvider(wsProvider)
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

    let count         : number = 0;
    let multiCount    : number = 0;
    let isMultiUnsub  : boolean = false;
    let isSingleUnsub : boolean = false;

    const unsubHeads = await api.rpc.chain.subscribeNewHeads((lastHeader) => {
        console.log(chalk.cyan(`> ${chain}: last block #${chalk.yellow(lastHeader.number)} has hash ${chalk.yellow(lastHeader.hash)}`));

        if (!lastHeader || ++count === 10) {
            // Finished sending requests
            isSingleUnsub = true;
            // Unsubscribe
            console.log(chalk.cyan(`${chalk.red(`> Unsubscribing Headers..`)}`));
            unsubHeads();
        }

        // Will only terminate if all other requests are finished
        terminate();
    });

    // Subscribe to Multi Queries
    console.log(
        chalk.cyan(
            `> Subscribing to multi queries:`
        )
    )

    const multiUnsub = await api.queryMulti([
        api.query.timestamp.now,
        [api.query.system.account, ADDR]
    ], ([now, data]) => {
        console.log(chalk.cyan(`> ${now}: data: ${chalk.yellow(data)}`));

        if (multiCount === 3) {
            // Finished Sending Requests
            isMultiUnsub = true;
            // Unsubscribe
            console.log(chalk.cyan(`> ${chalk.red(`> Unsubscribing Multi Query..`)}`));
            multiUnsub();

            // Will only terminate if all other requests are finished
            terminate();
        };
    })

    const terminate = () => {
        if (isMultiUnsub && isSingleUnsub) {
            throw new Error(`Successfully connected to ${wsProvider}. Terminating test`)
        }
    }
}
