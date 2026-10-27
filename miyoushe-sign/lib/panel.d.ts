import { Context } from 'koishi';
import { GameRole } from './accounts';
import { AccountOverview, PanelData } from './records';
export interface PanelSnapshot {
    id: string;
    platform: string;
    userId: string;
    game: string;
    uid: string;
    title: string;
    lines: string;
    data?: string;
    updatedAt: string;
}
declare module 'koishi' {
    interface Tables {
        miyoushe_panel: PanelSnapshot;
    }
}
export declare function createPanel(ctx: Context): {
    renderAccount(data: AccountOverview, userAvatar?: string): Promise<string>;
    renderRecordOverview(data: AccountOverview, userAvatar?: string): Promise<string>;
    save(role: GameRole, title: string, summary: string, data?: PanelData): Promise<PanelSnapshot>;
    get(platform: string, userId: string, role: GameRole): Promise<PanelSnapshot>;
    remove(platform: string, userId: string, roles: GameRole[]): Promise<void>;
    render(row: PanelSnapshot): Promise<string>;
};
