import { createAccounts, GameRole, Passport } from './accounts';
export declare function runAutoPassport(passport: Passport, roles: GameRole[], date: string, accounts: ReturnType<typeof createAccounts>, attempted: Map<string, {
    date: string;
    count: number;
}>, active: Set<string>, signRole: (role: GameRole) => Promise<{
    retry: boolean;
}>, runCommunitySign: (role: GameRole) => Promise<void>): Promise<void>;
