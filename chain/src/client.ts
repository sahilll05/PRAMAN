import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type WalletClient,
  type Account,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export interface ChainConfig {
  rpcUrl: string;
  privateKey?: Hex | undefined;
  easAddress: Address;
  registryAddress: Address;
  schemaRegistryAddress?: Address | undefined;
}

export interface PramanaClients {
  publicClient: PublicClient;
  walletClient?: WalletClient | undefined;
  account?: Account | undefined;
  easAddress: Address;
  registryAddress: Address;
}

export function createPramanaClients(config: ChainConfig): PramanaClients {
  const publicClient = createPublicClient({
    transport: http(config.rpcUrl),
  });

  let walletClient: WalletClient | undefined;
  let account: Account | undefined;

  if (config.privateKey) {
    account = privateKeyToAccount(config.privateKey);
    walletClient = createWalletClient({
      account,
      transport: http(config.rpcUrl),
    });
  }

  return {
    publicClient,
    walletClient,
    account,
    easAddress: config.easAddress,
    registryAddress: config.registryAddress,
  };
}
