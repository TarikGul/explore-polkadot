import { TypeRegistry } from '@polkadot/types';

/**
 * Runtime-specific options for encoding transactions. Pass these options to
 * functions that only require registry.
 */
export interface Options {
    /**
     * The type registry of the runtime.
     */
    registry: TypeRegistry;
}

/**
 * Runtime-specific options for encoding/decoding transactions. Pass these
 * options to functions that require registry and metadata.
 */
export interface OptionsWithMeta extends Options {
    /**
     * The metadata of the runtime.
     */
    metadataRpc: string;
}