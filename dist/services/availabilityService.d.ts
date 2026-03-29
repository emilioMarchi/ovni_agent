interface BusinessHours {
    enabled: boolean;
    ranges: Array<{
        start: string;
        end: string;
    }>;
}
interface AvailableSlots {
    availableSlots: string[];
    availableRanges: string[];
    bookedSlots: string[];
    businessHours: BusinessHours;
}
export declare function getAvailableSlots(clientId: string, date: string): Promise<AvailableSlots>;
export declare function formatAvailabilityMessage(clientId: string, date: string): Promise<string>;
export {};
