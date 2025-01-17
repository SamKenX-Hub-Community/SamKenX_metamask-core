import {
  BaseControllerV2,
  RestrictedControllerMessenger,
} from '@metamask/base-controller';
import {
  normalizeEnsName,
  isValidHexAddress,
  toChecksumHexAddress,
} from '@metamask/controller-utils';

const name = 'EnsController';

/**
 * @type EnsEntry
 *
 * ENS entry representation
 * @property chainId - Id of the associated chain
 * @property ensName - The ENS name
 * @property address - Hex address with the ENS name, or null
 */
export type EnsEntry = {
  chainId: string;
  ensName: string;
  address: string | null;
};

/**
 * @type EnsControllerState
 *
 * ENS controller state
 * @property ensEntries - Object of ENS entry objects
 */
export type EnsControllerState = {
  ensEntries: {
    [chainId: string]: {
      [ensName: string]: EnsEntry;
    };
  };
};

export type EnsControllerMessenger = RestrictedControllerMessenger<
  typeof name,
  never,
  never,
  never,
  never
>;

const metadata = {
  ensEntries: { persist: true, anonymous: false },
};

const defaultState = {
  ensEntries: {},
};

/**
 * Controller that manages a list ENS names and their resolved addresses
 * by chainId. A null address indicates an unresolved ENS name.
 */
export class EnsController extends BaseControllerV2<
  typeof name,
  EnsControllerState,
  EnsControllerMessenger
> {
  /**
   * Creates an EnsController instance.
   *
   * @param options - Constructor options.
   * @param options.messenger - A reference to the messaging system.
   * @param options.state - Initial state to set on this controller.
   */
  constructor({
    messenger,
    state,
  }: {
    messenger: EnsControllerMessenger;
    state?: Partial<EnsControllerState>;
  }) {
    super({
      name,
      metadata,
      messenger,
      state: {
        ...defaultState,
        ...state,
      },
    });
  }

  /**
   * Remove all chain Ids and ENS entries from state.
   */
  clear() {
    this.update((state) => {
      state.ensEntries = {};
    });
  }

  /**
   * Delete an ENS entry.
   *
   * @param chainId - Parent chain of the ENS entry to delete.
   * @param ensName - Name of the ENS entry to delete.
   * @returns Boolean indicating if the entry was deleted.
   */
  delete(chainId: string, ensName: string): boolean {
    const normalizedEnsName = normalizeEnsName(ensName);
    if (
      !normalizedEnsName ||
      !this.state.ensEntries[chainId] ||
      !this.state.ensEntries[chainId][normalizedEnsName]
    ) {
      return false;
    }

    this.update((state) => {
      delete state.ensEntries[chainId][normalizedEnsName];

      if (Object.keys(state.ensEntries[chainId]).length === 0) {
        delete state.ensEntries[chainId];
      }
    });
    return true;
  }

  /**
   * Retrieve a DNS entry.
   *
   * @param chainId - Parent chain of the ENS entry to retrieve.
   * @param ensName - Name of the ENS entry to retrieve.
   * @returns The EnsEntry or null if it does not exist.
   */
  get(chainId: string, ensName: string): EnsEntry | null {
    const normalizedEnsName = normalizeEnsName(ensName);

    // TODO Explicitly handle the case where `normalizedEnsName` is `null`
    // eslint-disable-next-line no-implicit-coercion
    return !!normalizedEnsName && this.state.ensEntries[chainId]
      ? this.state.ensEntries[chainId][normalizedEnsName] || null
      : null;
  }

  /**
   * Add or update an ENS entry by chainId and ensName.
   *
   * A null address indicates that the ENS name does not resolve.
   *
   * @param chainId - Id of the associated chain.
   * @param ensName - The ENS name.
   * @param address - Associated address (or null) to add or update.
   * @returns Boolean indicating if the entry was set.
   */
  set(chainId: string, ensName: string, address: string | null): boolean {
    if (
      !Number.isInteger(Number.parseInt(chainId, 10)) ||
      !ensName ||
      typeof ensName !== 'string' ||
      (address && !isValidHexAddress(address))
    ) {
      throw new Error(
        `Invalid ENS entry: { chainId:${chainId}, ensName:${ensName}, address:${address}}`,
      );
    }

    const normalizedEnsName = normalizeEnsName(ensName);
    if (!normalizedEnsName) {
      throw new Error(`Invalid ENS name: ${ensName}`);
    }

    const normalizedAddress = address ? toChecksumHexAddress(address) : null;
    const subState = this.state.ensEntries[chainId];

    if (
      subState?.[normalizedEnsName] &&
      subState[normalizedEnsName].address === normalizedAddress
    ) {
      return false;
    }

    this.update((state) => {
      state.ensEntries = {
        ...this.state.ensEntries,
        [chainId]: {
          ...this.state.ensEntries[chainId],
          [normalizedEnsName]: {
            address: normalizedAddress,
            chainId,
            ensName: normalizedEnsName,
          },
        },
      };
    });
    return true;
  }
}

export default EnsController;
