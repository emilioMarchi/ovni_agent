/**
 * Notifica al usuario que su solicitud fue recibida (Paso 1).
 */
export declare function sendRequestReceivedToUser(customerEmail: string, meetingData: {
    customerName: string;
    date: string;
    time: string;
    topic?: string;
}): Promise<import("resend").CreateEmailResponse>;
/**
 * Notifica al admin para que confirme o rechace (Paso 2).
 */
export declare function sendMeetingRequestToAdmin(adminEmail: string, meetingData: {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    date: string;
    time: string;
    topic?: string;
    meetingId?: string;
}): Promise<import("resend").CreateEmailResponse>;
/**
 * Notifica al usuario de la confirmación final (Paso 3).
 */
export declare function sendMeetingConfirmationToUser(customerEmail: string, meetingData: {
    customerName: string;
    date: string;
    time: string;
    topic?: string;
    eventLink?: string;
}): Promise<import("resend").CreateEmailResponse>;
export declare function sendMeetingCancellationToUser(customerEmail: string, meetingData: {
    customerName: string;
    date: string;
    time: string;
}): Promise<import("resend").CreateEmailResponse>;
