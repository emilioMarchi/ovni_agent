export interface CalendarTokens {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
}
export declare function getCalendarClient(clientId: string): Promise<{
    events: {
        insert: (options: any) => Promise<{
            data: any;
        }>;
        patch: (options: any) => Promise<{
            data: any;
        }>;
        delete: (options: any) => Promise<void>;
    };
}>;
export declare function createCalendarEvent(clientId: string, meetingData: {
    date: string;
    time: string;
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    topic?: string;
    status?: string;
}): Promise<any>;
export declare function updateCalendarEvent(clientId: string, eventId: string, meetingData: Partial<{
    date: string;
    time: string;
    topic: string;
    status: string;
    customerName: string;
    customerEmail: string;
}>): Promise<any>;
export declare function deleteCalendarEvent(clientId: string, eventId: string): Promise<void>;
export declare function getAuthUrl(clientId: string): string;
export declare function handleOAuthCallback(code: string, clientId: string): Promise<any>;
export declare function isCalendarConnected(clientId: string): Promise<boolean>;
