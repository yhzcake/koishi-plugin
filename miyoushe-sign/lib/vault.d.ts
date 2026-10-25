import { Context } from 'koishi';
export interface SignAccount {
    id: string;
    platform: string;
    userId: string;
    slot: string;
    kind: string;
    uid: string;
    region: string;
    enabled: boolean;
    ciphertext: string;
    lastDay: string;
}
export interface SignDevice {
    id: string;
    platform: string;
    userId: string;
    slot: string;
    ciphertext: string;
}
export interface DeviceInfo {
    deviceId: string;
    deviceFp: string;
}
declare module 'koishi' {
    interface Tables {
        miyoushe_sign_account: SignAccount;
        miyoushe_sign_device: SignDevice;
    }
}
export declare function accountId(platform: string, userId: string, slot: string): string;
export declare function createVault(ctx: Context, keyText: string): {
    owned: (platform: string, userId: string, slot: string) => Promise<SignAccount>;
    list(platform: string, userId: string): Promise<SignAccount[]>;
    all(): Promise<SignAccount[]>;
    put(platform: string, userId: string, slot: string, kind: string, uid: string, region: string, secret: string): Promise<void>;
    use<T>(platform: string, userId: string, slot: string, callback: (secret: string, account: SignAccount) => Promise<T>): Promise<T>;
    putDevice(platform: string, userId: string, slot: string, device: DeviceInfo): Promise<boolean>;
    useDevice<T>(platform: string, userId: string, slot: string, callback: (device?: DeviceInfo) => Promise<T>): Promise<T>;
    removeDevice(platform: string, userId: string, slot: string): Promise<boolean>;
    enable(platform: string, userId: string, slot: string, enabled: boolean): Promise<boolean>;
    mark(platform: string, userId: string, slot: string, day: string): Promise<void>;
    remove(platform: string, userId: string, slot: string): Promise<boolean>;
};
