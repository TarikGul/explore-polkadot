import fetch from 'node-fetch';

import { KeyringPair, OptionsWithMeta } from '@substrate/txwrapper';

/**
 * 
 * @param method JSONRPC request method
 * @param params JSONRPC request params
 */
export const rpcToNode = (method: string, params: any[] = []) => {
    const body = {
        id: 1, // Always takes in a id 
        jsonrpc: '2.0',
        method, 
        params
    }
    // Default header for JSON-RPC
    const requestHeaders = {
        'Content-Type': 'application/json',
    }
    // When making calls to JSON-RPC it always takes a POST method
    const requestMethod = 'POST';
    
    return fetch('http://localhost:9933', {
        body: JSON.stringify(body),
        headers: requestHeaders, 
        method: requestMethod
    })
        .then(response => response.json())
        .then(({ error, result }) => {
            if (error) {
                throw new Error(
                    `${error.code} ${error.message} ${JSON.stringify(error.data)}`
                )
            }

            return result
        });
}
